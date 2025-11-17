import fp from "fastify-plugin";
import jwt from "jsonwebtoken";

export default fp(async (fastify, opts) => {
  // connection maps
  // userId -> ws
  const connections = new Map();
  // emergencyId -> Set of userIds (responders/users)
  const rooms = new Map();

  fastify.decorate("wsConnections", connections);
  fastify.decorate("wsRooms", rooms);

  // register a websocket endpoint
  fastify.get("/ws", { websocket: true }, (connection, req) => {
    // parse token from query or headers: ws://.../ws?token=...
    const token = req.url.split("?token=")[1];
    if (!token) {
      connection.socket.send(
        JSON.stringify({ type: "error", message: "No token provided" })
      );
      connection.socket.close();
      return;
    }

    try {
      const payload = jwt.verify(
        decodeURIComponent(token),
        process.env.JWT_SECRET
      );
      const userId = payload.id;
      // store connection
      connections.set(String(userId), connection.socket);

      // send ack
      connection.socket.send(JSON.stringify({ type: "connected", userId }));

      connection.socket.on("message", (msg) => {
        try {
          const data = JSON.parse(msg.toString());
          // Handle client messages: joinRoom, leaveRoom, locationUpdate
          if (data.type === "joinRoom") {
            const { emergencyId } = data;
            if (!rooms.has(String(emergencyId)))
              rooms.set(String(emergencyId), new Set());
            rooms.get(String(emergencyId)).add(String(userId));
          } else if (data.type === "leaveRoom") {
            const { emergencyId } = data;
            if (rooms.has(String(emergencyId)))
              rooms.get(String(emergencyId)).delete(String(userId));
          } else if (data.type === "locationUpdate") {
            // broadcast location update inside room
            const { emergencyId, latitude, longitude } = data;
            if (rooms.has(String(emergencyId))) {
              const members = Array.from(rooms.get(String(emergencyId)));
              const payload = {
                type: "locationUpdate",
                emergencyId,
                userId,
                latitude,
                longitude,
                timestamp: Date.now(),
              };
              members.forEach((memberId) => {
                const sock = connections.get(memberId);
                if (sock && sock.readyState === 1)
                  sock.send(JSON.stringify(payload));
              });
            }
          }
        } catch (e) {
          connection.socket.send(
            JSON.stringify({ type: "error", message: "Invalid message format" })
          );
        }
      });

      connection.socket.on("close", () => {
        connections.delete(String(userId));
        // optionally remove from rooms
        rooms.forEach((set) => set.delete(String(userId)));
      });
    } catch (err) {
      connection.socket.send(
        JSON.stringify({ type: "error", message: "Invalid token" })
      );
      connection.socket.close();
    }
  });

  // helper to send to single user
  fastify.decorate("sendToUser", (userId, payload) => {
    const sock = connections.get(String(userId));
    if (sock && sock.readyState === 1) {
      sock.send(JSON.stringify(payload));
    }
  });

  // helper to broadcast to multiple userIds
  fastify.decorate("broadcastToUsers", (userIds = [], payload) => {
    userIds.forEach((id) => {
      const s = connections.get(String(id));
      if (s && s.readyState === 1) s.send(JSON.stringify(payload));
    });
  });

  // helper to broadcast to a room (emergency)
  fastify.decorate("broadcastToRoom", (emergencyId, payload) => {
    const set = rooms.get(String(emergencyId));
    if (!set) return;
    set.forEach((userId) => {
      const s = connections.get(String(userId));
      if (s && s.readyState === 1) s.send(JSON.stringify(payload));
    });
  });
});
// this keeps connections and allows broadcasting to user/responder sockets and to "rooms" per emergency