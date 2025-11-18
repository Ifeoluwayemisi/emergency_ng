import { prisma } from "../utils/prisma.js";
import { haversineDistance } from "../utils/geo.js";
import { enqueueNotification } from "../queue/notificationQueue.js";
import Redis from "ioredis";
import { z } from "zod";

/* ---------- Config ---------- */
const MAX_SELECTED_RESPONDERS = 6;
const RATE_LIMIT_SECONDS = 40; // per-user minimum interval between emergency creations

const RADIUS_MAP = {
  URBAN: 6,
  SEMI_URBAN: 10,
  RURAL: 15,
};

// optional Redis client (only if REDIS_URL is provided)
const redis =
  process.env.REDIS_URL && process.env.REDIS_URL.length
    ? new Redis(process.env.REDIS_URL)
    : null;

/* ---------- Schemas ---------- */
const createEmergencySchema = z.object({
  description: z.string().min(1),
  category: z.string().optional().nullable(),
  latitude: z.preprocess((v) => (v === "" ? null : Number(v)), z.number()),
  longitude: z.preprocess((v) => (v === "" ? null : Number(v)), z.number()),
  address: z.string().optional().nullable(),
  radius: z
    .preprocess((v) => (v === "" ? null : Number(v)), z.number().nullable())
    .optional(),
});

/* ---------- Helpers ---------- */
function safeWsBroadcast(server, methodNames = [], ...args) {
  const candidates = methodNames.concat([
    "broadcastToUsers",
    "wsBroadcastToUsers",
    "sendToUsers",
  ]);
  for (const name of candidates) {
    if (server && typeof server[name] === "function") {
      try {
        return server[name](...args);
      } catch (e) {
        server.log?.error?.(e);
      }
    }
  }
  return null;
}

async function rateLimitCreateEmergency(userId) {
  if (redis) {
    const key = `user:${userId}:lastEmergency`;
    const now = Date.now();
    const last = await redis.get(key);
    if (last && now - Number(last) < RATE_LIMIT_SECONDS * 1000) return false;
    await redis.set(key, String(now), "EX", RATE_LIMIT_SECONDS);
    return true;
  }

  const cutoff = new Date(Date.now() - RATE_LIMIT_SECONDS * 1000);
  const recent = await prisma.emergency.findFirst({
    where: { userId, createdAt: { gt: cutoff } },
    select: { id: true },
  });
  return !recent;
}

/* ---------- Controller: createEmergency ---------- */
export async function createEmergency(request, reply) {
  try {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });
    const user = request.user;
    const userId = user.id;

    // validate body
    const parseResult = createEmergencySchema.safeParse(request.body || {});
    if (!parseResult.success) {
      return reply
        .code(400)
        .send({ error: "Invalid input", details: parseResult.error.errors });
    }
    const { description, category, latitude, longitude, address, radius } =
      parseResult.data;

    if (latitude == null || longitude == null) {
      return reply.code(400).send({ error: "latitude and longitude required" });
    }

    // rate limit
    const allowed = await rateLimitCreateEmergency(userId);
    if (!allowed)
      return reply
        .code(429)
        .send({ error: "Please wait before creating another emergency" });

    // determine effective radius
    const effectiveRadius =
      typeof radius === "number" && !Number.isNaN(radius)
        ? radius
        : RADIUS_MAP[user.locationType] || RADIUS_MAP.URBAN;

    const lat = Number(latitude);
    const lng = Number(longitude);

    // create emergency record
    const emergency = await prisma.emergency.create({
      data: {
        userId,
        description,
        category,
        latitude: lat,
        longitude: lng,
        address,
        status: "PENDING",
      },
    });

    // fetch candidate responders
    const candidates = await prisma.user.findMany({
      where: {
        role: "RESPONDER",
        verified: true,
        available: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { id: true, name: true, latitude: true, longitude: true },
    });

    // compute distances & filter by effective radius
    const respondersWithDistance = candidates
      .map((r) => ({
        responder: r,
        distanceKm: haversineDistance(lat, lng, r.latitude, r.longitude),
      }))
      .filter((x) => x.distanceKm <= effectiveRadius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const selected = respondersWithDistance.slice(0, MAX_SELECTED_RESPONDERS);

    // link responders
    if (selected.length > 0) {
      await prisma.responderEmergency.createMany({
        data: selected.map((s) => ({
          emergencyId: emergency.id,
          responderId: s.responder.id,
        })),
        skipDuplicates: true,
      });
    }

    // build base payload
    const basePayload = {
      title: "New emergency nearby",
      body: `${description} — ${address || `${lat},${lng}`}`,
      sms: `Emergency: ${description}. Loc: ${lat},${lng}`,
      html: `<p>${description}</p><p>Location: ${
        address || `${lat},${lng}`
      }</p>`,
    };

    // create & enqueue notifications
    const notificationPromises = selected.map(async (s) => {
      const notif = await prisma.notification.create({
        data: {
          emergencyId: emergency.id,
          recipientId: s.responder.id,
          channel: "TERMII_SMS",
          priority: 1,
          meta: { responderName: s.responder.name },
        },
      });

      return enqueueNotification({
        notificationId: notif.id,
        emergencyId: emergency.id,
        recipientId: s.responder.id,
        payload: { ...basePayload, responderName: s.responder.name },
      });
    });

    // fallback for admins if no responders
    if (selected.length === 0) {
      const adminPhones = (process.env.ADMIN_PHONES || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      for (const phone of adminPhones) {
        const notif = await prisma.notification.create({
          data: {
            emergencyId: emergency.id,
            recipientId: null,
            channel: "TERMII_SMS",
            priority: 0,
            meta: { adminPhone: phone },
          },
        });

        notificationPromises.push(
          enqueueNotification({
            notificationId: notif.id,
            emergencyId: emergency.id,
            recipientId: null,
            payload: {
              ...basePayload,
              sms: `ADMIN ALERT: ${basePayload.sms}`,
              adminPhone: phone,
            },
          })
        );
      }
    }

    await Promise.all(notificationPromises);

    // WebSocket broadcast
    const responderIds = selected.map((s) => s.responder.id);
    const wsPayload = {
      type: "newEmergency",
      emergency: {
        id: emergency.id,
        description: emergency.description,
        category: emergency.category,
        latitude: emergency.latitude,
        longitude: emergency.longitude,
        address: emergency.address,
        createdAt: emergency.createdAt,
      },
    };
    safeWsBroadcast(
      request.server,
      ["wsBroadcastToUsers", "broadcastToUsers", "sendToUsers"],
      responderIds,
      wsPayload
    );

    return reply
      .code(201)
      .send({ emergency, notifiedResponders: responderIds });
  } catch (err) {
    request.log?.error?.(err);
    console.error("createEmergency error:", err);
    return reply.code(500).send({ error: "Internal Server Error" });
  }
}

/* ---------- Controller: cancelEmergency ---------- */

/* ---------- Controller: cancelEmergency ---------- */
export async function cancelEmergency(request, reply) {
  try {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });

    const userId = request.user.id;
    const eid = parseInt(request.params.id, 10);

    const emergency = await prisma.emergency.findUnique({ where: { id: eid } });
    if (!emergency) return reply.code(404).send({ error: "Not found" });
    if (emergency.userId !== userId)
      return reply.code(403).send({ error: "Not your emergency" });

    const updated = await prisma.emergency.update({
      where: { id: eid },
      data: { status: "CANCELLED" },
    });

    // Broadcast cancellation to responders
    if (request.server && typeof request.server.broadcastToRoom === "function") {
      request.server.broadcastToRoom(String(eid), {
        type: "emergencyCancelled",
        emergencyId: eid,
      });
    } else {
      // fallback: notify linked responders directly
      const linked = await prisma.responderEmergency.findMany({
        where: { emergencyId: eid },
        select: { responderId: true },
      });
      const responderIds = linked.map((l) => l.responderId);
      safeWsBroadcast(
        request.server,
        ["wsBroadcastToUsers", "broadcastToUsers"],
        responderIds,
        { type: "emergencyCancelled", emergencyId: eid }
      );
    }

    return reply.send(updated);
  } catch (err) {
    request.log?.error?.(err);
    return reply.code(500).send({ error: "Internal Server Error" });
  }
}

/* ---------- Controller: responderAccept ---------- */
export async function responderAccept(request, reply) {
  try {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });

    const responderId = request.user.id;
    const eid = parseInt(request.params.id, 10);

    // Fetch emergency and emergency creator
    const emergency = await prisma.emergency.findUnique({
      where: { id: eid },
      include: { user: true },
    });
    if (!emergency)
      return reply.code(404).send({ error: "Emergency not found" });

    const creator = emergency.user;
    if (!creator)
      return reply.code(500).send({ error: "Emergency owner missing" });

    // Compute max allowed radius based on creator's location type
    const effectiveRadius = RADIUS_MAP[creator.locationType] || 6;

    // Check if responder is within allowed radius
    if (
      emergency.latitude != null &&
      emergency.longitude != null &&
      request.user.latitude != null &&
      request.user.longitude != null
    ) {
      const distance = haversineDistance(
        emergency.latitude,
        emergency.longitude,
        request.user.latitude,
        request.user.longitude
      );

      if (distance > effectiveRadius) {
        return reply
          .code(403)
          .send({ error: `Responder too far: ${distance.toFixed(2)} km` });
      }
    }

    // Ensure this responder was invited
    const link = await prisma.responderEmergency.findFirst({
      where: { emergencyId: eid, responderId },
    });
    if (!link)
      return reply.code(403).send({ error: "Not assigned to this emergency" });

    const now = new Date();

    // mark responder as accepted
    await prisma.responderEmergency.updateMany({
      where: { emergencyId: eid, responderId },
      data: { accepted: true, respondedAt: now },
    });

    // transition emergency to ACCEPTED only if PENDING
    const updated = await prisma.emergency.updateMany({
      where: { id: eid, status: "PENDING" },
      data: { status: "ACCEPTED", acceptedAt: now },
    });

    // notify emergency owner
    if (creator.id) {
      safeWsBroadcast(
        request.server,
        ["sendToUser", "wsSendToUser"],
        creator.id,
        { type: "responderAccepted", emergencyId: eid, responderId }
      );
    }

    // notify other responders in the room
    if (
      request.server &&
      typeof request.server.broadcastToRoom === "function"
    ) {
      request.server.broadcastToRoom(String(eid), {
        type: "responderAcceptedBroadcast",
        emergencyId: eid,
        responderId,
      });
    } else {
      safeWsBroadcast(
        request.server,
        ["wsBroadcastToUsers", "broadcastToUsers"],
        [],
        { type: "responderAcceptedBroadcast", emergencyId: eid, responderId }
      );
    }

    return reply.send({
      success: true,
      acceptedEmergencyTransitioned: updated.count > 0,
    });
  } catch (err) {
    request.log?.error?.(err);
    return reply.code(500).send({ error: "Internal Server Error" });
  }
}

/* ---------- Controller: responderReject ---------- */
export async function responderReject(request, reply) {
  try {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });

    const responderId = request.user.id;
    const eid = parseInt(request.params.id, 10);

    // Ensure responder was actually invited to this emergency
    const link = await prisma.responderEmergency.findFirst({
      where: { emergencyId: eid, responderId },
    });
    if (!link)
      return reply.code(403).send({ error: "Not assigned to this emergency" });

    const now = new Date();

    // Mark responder as rejected
    await prisma.responderEmergency.updateMany({
      where: { emergencyId: eid, responderId },
      data: { accepted: false, respondedAt: now },
    });

    // Broadcast rejection to other responders / emergency room
    if (request.server && typeof request.server.broadcastToRoom === "function") {
      request.server.broadcastToRoom(String(eid), {
        type: "responderRejected",
        emergencyId: eid,
        responderId,
      });
    } else {
      // fallback: broadcast directly via WebSocket helper
      const responderIds = []; // optionally could include all linked responders if needed
      if (typeof request.server?.wsBroadcastToUsers === "function") {
        request.server.wsBroadcastToUsers(responderIds, {
          type: "responderRejected",
          emergencyId: eid,
          responderId,
        });
      }
    }

    return reply.send({ success: true, message: "Responder rejected the emergency" });
  } catch (err) {
    request.log?.error(err);
    return reply.code(500).send({ error: "Internal Server Error" });
  }
}

// Get a single emergency by ID
export async function getEmergency(request, reply) {
  try {
    const eid = parseInt(request.params.id, 10);
    if (isNaN(eid)) return reply.code(400).send({ error: "Invalid emergency ID" });

    const emergency = await prisma.emergency.findUnique({
      where: { id: eid },
      include: {
        user: true, // include creator info
        responderEmergencies: { include: { responder: true } }, // include responders linked
      },
    });

    if (!emergency) return reply.code(404).send({ error: "Emergency not found" });

    return reply.send(emergency);
  } catch (err) {
    request.log?.error(err);
    return reply.code(500).send({ error: "Internal Server Error" });
  }
}
