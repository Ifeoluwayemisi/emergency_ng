import fp from "fastify-plugin";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma.js";
import { haversineDistance } from "../utils/geo.js";

/** websocket handler plugin for emergency help
 * 
 * Responsibiliteis:
 * - Authenticate socket connections via jwt
 * - manage connection registry (userId -> ws)
 * - handle incoming messages:
 *   - join_room / leave_room (emergencyId), location_update, responder_accept, responder_reject, complete_emergency
 * -  Broadcast server -> client messages:
 *   - to specific users (e.g. notify user when responder accepts)
 *   - to rooms (e.g. broadcast location updates to all in emergency room)
 * - Maintain in-memory registries of connections and "rooms" per emergency
 * 
 *  **/

export default fp(async (fastify, opts) => {
  // in memory registries
  const connections = new Map(); // userId -> ws
  const rooms = new Map(); // emergencyId -> Set<userId>
  const socketToUser = new WeakMap();

  // helpers
  function sendToUser(userId, payload) {
    const sock = connections.get(String(userId));
    if (sock && sock.readyState === 1) sock.send(JSON.stringify(payload));
  }

  function broadcastToUsers(userIds = [], payload) {
    userIds.forEach((id) => sendToUser(id, payload));
  }

  function broadcastToRoom(emergencyId, payload) {
    const set = rooms.get(String(emergencyId));
    if (!set) return;
    set.forEach((userId) => sendToUser(userId, payload));
  }

  // attach helpers to Fastify instance
  fastify.decorate("wsConnections", connections);
  fastify.decorate("wsRooms", rooms);
  fastify.decorate("wsSendToUser", sendToUser);
  fastify.decorate("wsBroadcastToUsers", broadcastToUsers);
  fastify.decorate("wsBroadcastToRoom", broadcastToRoom);

  // compute rough ETA in minutes
  function computeEtaKm(distanceKm) {
    const avgKmPerMin = 40 / 60; // 40 km/h
    return `${Math.max(1, Math.round(distanceKm / avgKmPerMin))} mins`;
  }

  // === WebSocket endpoint ===
  fastify.get("/ws", { websocket: true }, async (connection, req) => {
    const token = req.url.split("?token=")[1];
    if (!token) {
      connection.socket.send(
        JSON.stringify({ type: "error", message: "No token provided" })
      );
      connection.socket.close();
      return;
    }

    let payload;
    try {
      payload = jwt.verify(decodeURIComponent(token), process.env.JWT_SECRET);
    } catch {
      connection.socket.send(
        JSON.stringify({ type: "error", message: "Invalid token" })
      );
      connection.socket.close();
      return;
    }

    const userId = String(payload.id);
    connections.set(userId, connection.socket);
    socketToUser.set(connection.socket, userId);
    connection.socket.send(JSON.stringify({ type: "connected", userId }));

    // === message handler ===
    connection.socket.on("message", async (msg) => {
      let data;
      try {
        data = JSON.parse(msg.toString());
      } catch {
        connection.socket.send(
          JSON.stringify({ type: "error", message: "Invalid JSON" })
        );
        return;
      }

      const type = data.type;

      try {
        // --- JOIN ROOM ---
        if (type === "join_room") {
          const { emergencyId } = data;
          if (!emergencyId) throw new Error("emergencyId required");
          if (!rooms.has(emergencyId)) rooms.set(emergencyId, new Set());
          rooms.get(emergencyId).add(userId);
          connection.socket.send(
            JSON.stringify({ type: "joined_room", room: emergencyId })
          );
          return;
        }

        // --- LEAVE ROOM ---
        if (type === "leave_room") {
          const { emergencyId } = data;
          rooms.get(emergencyId)?.delete(userId);
          connection.socket.send(
            JSON.stringify({ type: "left_room", room: emergencyId })
          );
          return;
        }

        // --- LOCATION UPDATE ---
        if (type === "location_update") {
          const { emergencyId, latitude, longitude } = data;
          if (
            !emergencyId ||
            typeof latitude !== "number" ||
            typeof longitude !== "number"
          ) {
            throw new Error("Invalid location_update payload");
          }

          // update responder location in DB (non-blocking)
          try {
            await prisma.user.update({
              where: { id: parseInt(userId) },
              data: { latitude, longitude },
            });
          } catch {}

          // compute ETA to emergency
          let eta = null;
          const emergency = await prisma.emergency.findUnique({
            where: { id: parseInt(emergencyId) },
          });
          if (emergency) {
            const dist = haversineDistance(
              latitude,
              longitude,
              emergency.latitude,
              emergency.longitude
            );
            eta = computeEtaKm(dist);
          }

          broadcastToRoom(emergencyId, {
            type: "responder_location",
            emergencyId,
            responderId: userId,
            latitude,
            longitude,
            eta,
            timestamp: Date.now(),
          });
          return;
        }

        // --- RESPONDER ACCEPT ---
        if (type === "responder_accept") {
          const { emergencyId } = data;
          await prisma.responderEmergency.updateMany({
            where: {
              emergencyId: parseInt(emergencyId),
              responderId: parseInt(userId),
            },
            data: { accepted: true, respondedAt: new Date() },
          });

          await prisma.emergency.update({
            where: { id: parseInt(emergencyId) },
            data: { status: "ACCEPTED" },
          });

          const em = await prisma.emergency.findUnique({
            where: { id: parseInt(emergencyId) },
          });
          if (em)
            sendToUser(String(em.userId), {
              type: "responder_accepted",
              emergencyId,
              responderId: userId,
            });

          broadcastToRoom(emergencyId, {
            type: "responderAcceptedBroadcast",
            emergencyId,
            responderId: userId,
          });
          return;
        }

        // --- RESPONDER REJECT ---
        if (type === "responder_reject") {
          const { emergencyId } = data;
          await prisma.responderEmergency.updateMany({
            where: {
              emergencyId: parseInt(emergencyId),
              responderId: parseInt(userId),
            },
            data: { accepted: false, respondedAt: new Date() },
          });
          broadcastToRoom(emergencyId, {
            type: "responder_rejected",
            emergencyId,
            responderId: userId,
          });
          return;
        }

        // --- COMPLETE EMERGENCY ---
        if (type === "complete_emergency") {
          const { emergencyId } = data;
          await prisma.emergency.update({
            where: { id: parseInt(emergencyId) },
            data: { status: "COMPLETED" },
          });
          broadcastToRoom(emergencyId, {
            type: "emergency_completed",
            emergencyId,
          });
          return;
        }

        // --- UNKNOWN ---
        connection.socket.send(
          JSON.stringify({ type: "error", message: "Unknown message type" })
        );
      } catch (err) {
        connection.socket.send(
          JSON.stringify({
            type: "error",
            message: err.message || "Server error",
          })
        );
      }
    });

    // --- cleanup ---
    connection.socket.on("close", () => {
      connections.delete(userId);
      rooms.forEach((set) => set.delete(userId));
    });
  });
});

// this keeps connections and allows broadcasting to user/responder sockets and to "rooms" per emergency
