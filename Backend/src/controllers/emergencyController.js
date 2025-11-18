import { prisma } from "../utils/prisma.js";
import { haversineDistance } from "../utils/geo.js";
import { enqueueNotification } from "../queues/notificationQueue.js";

const FIND_RADIUS_KM = 6;

export async function createEmergency(request, reply) {
  try {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });
    const userId = request.user.id;
    const user = request.user;

    const { description, category, latitude, longitude, address } =
      request.body;
    if (!latitude || !longitude) {
      return reply.code(400).send({ error: "latitude and longitude required" });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    // Create emergency record
    const emergency = await prisma.emergency.create({
      data: {
        userId,
        description,
        category,
        latitude: lat,
        longitude: lng,
        address,
      },
    });

    // Find nearby responders
    const candidates = await prisma.user.findMany({
      where: {
        role: "RESPONDER",
        verified: true,
        latitude: { not: null },
        longitude: { not: null },
      },
    });

    const respondersWithDistance = candidates
      .map((r) => ({
        responder: r,
        distanceKm: haversineDistance(lat, lng, r.latitude, r.longitude),
      }))
      .filter((x) => x.distanceKm <= FIND_RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const selected = respondersWithDistance.slice(0, 6);

    //Link responders to emergency
    await Promise.all(
      selected.map((s) =>
        prisma.responderEmergency.create({
          data: { emergencyId: emergency.id, responderId: s.responder.id },
        })
      )
    );

    // Build notification payload
    const basePayload = {
      title: "New emergency near you",
      body: `${emergency.description} — ${
        emergency.address || `${lat},${lng}`
      }`,
      sms: `Emergency: ${emergency.description}. Loc: ${lat},${lng}`,
      html: `<p>${emergency.description}</p><p>Location: ${
        emergency.address || `${lat},${lng}`
      }</p>`,
    };

    //Create and enqueue notifications for responders
    for (const s of selected) {
      const notif = await prisma.notification.create({
        data: {
          emergencyId: emergency.id,
          recipientId: s.responder.id,
          channel: "TERMII_SMS",
          priority: 1,
          meta: { responderName: s.responder.name },
        },
      });

      await enqueueNotification({
        notificationId: notif.id,
        emergencyId: emergency.id,
        recipientId: s.responder.id,
        payload: { ...basePayload, responderName: s.responder.name },
      });
    }

    //Admin alerts
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

      await enqueueNotification({
        notificationId: notif.id,
        emergencyId: emergency.id,
        recipientId: null,
        payload: { ...basePayload, sms: `ADMIN ALERT: ${basePayload.sms}` },
      });
    }

    // WebSocket broadcast to responders
    const responderIds = selected.map((s) => s.responder.id);
    request.server.broadcastToUsers(responderIds, {
      type: "newEmergency",
      emergency,
    });

    //Response
    return reply.send({ emergency, notifiedResponders: responderIds });
  } catch (err) {
    console.error(err);
    return reply.code(500).send({ error: err.message });
  }
}

export async function cancelEmergency(request, reply) {
  const { id } = request.params;
  const userId = request.user.id;
  const emergency = await prisma.emergency.findUnique({
    where: { id: parseInt(id) },
  });
  if (!emergency) return reply.code(404).send({ error: "Not found" });
  if (emergency.userId !== userId)
    return reply.code(403).send({ error: "Not your emergency" });

  const updated = await prisma.emergency.update({
    where: { id: parseInt(id) },
    data: { status: "CANCELLED" },
  });

  // notify responders in the room
  request.server.broadcastToRoom(id, {
    type: "emergencyCancelled",
    emergencyId: id,
  });

  reply.send(updated);
}

export async function responderAccept(request, reply) {
  const { id } = request.params; // emergency id
  const responderId = request.user.id;
  // update ResponderEmergency record
  const re = await prisma.responderEmergency.updateMany({
    where: { emergencyId: parseInt(id), responderId: responderId },
    data: { accepted: true, respondedAt: new Date() },
  });
  // set emergency status to ACCEPTED if needed
  const updatedEmergency = await prisma.emergency.update({
    where: { id: parseInt(id) },
    data: { status: "ACCEPTED" },
  });

  // Notify emergency creator (user)
  const em = await prisma.emergency.findUnique({ where: { id: parseInt(id) } });
  request.server.sendToUser(em.userId, {
    type: "responderAccepted",
    emergencyId: id,
    responderId,
  });

  // Also notify other responders (optional) to stop trying
  request.server.broadcastToRoom(id, {
    type: "responderAcceptedBroadcast",
    emergencyId: id,
    responderId,
  });

  return reply.send({ success: true, updatedEmergency });
}

export async function responderReject(request, reply) {
  const { id } = request.params;
  const responderId = request.user.id;
  await prisma.responderEmergency.updateMany({
    where: { emergencyId: parseInt(id), responderId },
    data: { accepted: false, respondedAt: new Date() },
  });
  request.server.broadcastToRoom(id, {
    type: "responderRejected",
    emergencyId: id,
    responderId,
  });
  return reply.send({ success: true });
}
