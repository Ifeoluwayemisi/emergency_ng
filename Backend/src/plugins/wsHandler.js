import fp from "fastify-plugin";
import IORedis from "ioredis";
import jwt from "jsonwebtoken";

export default fp(async (fastify, opts) => {
  const REDIS_URL = process.env.REDIS_URL;
  const pub = new IORedis(REDIS_URL);
  const sub = new IORedis(REDIS_URL);

  // Local registries
  const connections = new Map(); // userId -> ws
  const rooms = new Map(); // roomId (emergencyId or 'responders') -> Set(userId)

  // Subscribe to room channels pattern: room:*
  await sub.psubscribe("room:*");

  sub.on("pmessage", (pattern, channel, message) => {
    try {
      const roomId = channel.split(":")[1];
      const payload = JSON.parse(message);
      const members = rooms.get(String(roomId));
      if (!members) return;
      members.forEach((memberId) => {
        const sock = connections.get(String(memberId));
        if (sock && sock.readyState === 1) {
          try {
            sock.send(JSON.stringify(payload));
          } catch (e) {
            /* ignore */
          }
        }
      });
    } catch (err) {
      fastify.log.error("Redis pmessage handler error", err);
    }
  });

  // Helpers
  function localSendToUser(userId, payload) {
    const sock = connections.get(String(userId));
    if (sock && sock.readyState === 1) {
      try {
        sock.send(JSON.stringify(payload));
      } catch (e) {
        /* ignore */
      }
      return true;
    }
    return false;
  }

  async function wsSendToUser(userId, payload) {
    // attempt local send
    const sent = localSendToUser(userId, payload);
    if (!sent) {
      // nothing connected locally: publish to user's personal channel (optional) or fallback to queue
      // We'll publish to room:user:<userId> so other instances can deliver if connected there
      await pub.publish(`room:user:${userId}`, JSON.stringify(payload));
    }
  }

  async function wsBroadcastToUsers(userIds = [], payload) {
    const localDelivered = [];
    const remote = [];
    userIds.forEach((id) => {
      const sent = localSendToUser(id);
      if (!sent) remote.push(id);
      else localDelivered.push(id);
    });
    if (remote.length) {
      // publish a message to a dedicated channel; other instances should have room membership
      // we publish per-user for reliability
      await Promise.all(
        remote.map((id) =>
          pub.publish(`room:user:${id}`, JSON.stringify(payload))
        )
      );
    }
  }

  async function wsBroadcastToRoom(roomId, payload) {
    // local deliver
    const members = rooms.get(String(roomId));
    if (members) {
      members.forEach((memberId) => {
        const sock = connections.get(String(memberId));
        if (sock && sock.readyState === 1) {
          try {
            sock.send(JSON.stringify(payload));
          } catch (e) {
            /* ignore */
          }
        }
      });
    }
    // publish to redis channel so other instances pick it up
    await pub.publish(`room:${roomId}`, JSON.stringify(payload));
  }

  fastify.decorate("wsSendToUser", wsSendToUser);
  fastify.decorate("wsBroadcastToUsers", wsBroadcastToUsers);
  fastify.decorate("wsBroadcastToRoom", wsBroadcastToRoom);
  fastify.decorate("wsConnections", connections);
  fastify.decorate("wsRooms", rooms);

  // WebSocket endpoint
  fastify.get("/ws", { websocket: true }, (connection, req) => {
    // token in query: /ws?token=...
    const url = req.url || "";
    const tokenMatch = url.split("?token=")[1];
    const token = tokenMatch
      ? decodeURIComponent(tokenMatch.split("&")[0])
      : null;

    if (!token) {
      connection.socket.send(
        JSON.stringify({ type: "error", message: "No token provided" })
      );
      connection.socket.close();
      return;
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      connection.socket.send(
        JSON.stringify({ type: "error", message: "Invalid token" })
      );
      connection.socket.close();
      return;
    }

    const userId = String(payload.id);
    // register connection
    connections.set(userId, connection.socket);

    // send ack
    connection.socket.send(JSON.stringify({ type: "connected", userId }));

    // message handler
    connection.socket.on("message", async (msg) => {
      let data;
      try {
        data = JSON.parse(msg.toString());
      } catch (e) {
        connection.socket.send(
          JSON.stringify({ type: "error", message: "Invalid JSON" })
        );
        return;
      }

      const type = data.type;
      try {
        if (type === "join_room") {
          const { roomId } = data; // use roomId instead of emergencyId (flexible)
          if (!roomId) {
            connection.socket.send(
              JSON.stringify({ type: "error", message: "roomId required" })
            );
            return;
          }
          if (!rooms.has(String(roomId))) rooms.set(String(roomId), new Set());
          rooms.get(String(roomId)).add(userId);
          connection.socket.send(
            JSON.stringify({ type: "joined_room", roomId })
          );
          return;
        }

        if (type === "leave_room") {
          const { roomId } = data;
          if (roomId && rooms.has(String(roomId)))
            rooms.get(String(roomId)).delete(userId);
          connection.socket.send(JSON.stringify({ type: "left_room", roomId }));
          return;
        }

        if (type === "location_update") {
          const { roomId, latitude, longitude } = data;
          if (
            !roomId ||
            typeof latitude !== "number" ||
            typeof longitude !== "number"
          ) {
            connection.socket.send(
              JSON.stringify({
                type: "error",
                message: "invalid location_update",
              })
            );
            return;
          }
          // publish to room so every instance delivers to local members
          await pub.publish(
            `room:${roomId}`,
            JSON.stringify({
              type: "responder_location",
              roomId,
              responderId: userId,
              latitude,
              longitude,
              timestamp: Date.now(),
            })
          );
          return;
        }

        // responder_accept via ws
        if (type === "responder_accept") {
          const { emergencyId } = data;
          if (!emergencyId) {
            connection.socket.send(
              JSON.stringify({ type: "error", message: "emergencyId required" })
            );
            return;
          }
          // let controllers handle DB changes via REST or internal call — but we can notify
          await pub.publish(
            `room:${emergencyId}`,
            JSON.stringify({
              type: "responder_accept_request",
              emergencyId,
              responderId: userId,
            })
          );
          return;
        }

        // other message types forwarded as-is to the room
        if (type === "generic_broadcast" && data.roomId) {
          await pub.publish(
            `room:${data.roomId}`,
            JSON.stringify(data.payload)
          );
          return;
        }

        connection.socket.send(
          JSON.stringify({ type: "error", message: "Unknown message type" })
        );
      } catch (err) {
        connection.socket.send(
          JSON.stringify({ type: "error", message: err.message })
        );
      }
    });

    connection.socket.on("close", () => {
      connections.delete(userId);
      // remove userId from rooms
      rooms.forEach((set) => set.delete(userId));
    });
  });
});
