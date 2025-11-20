export function createWsClient(jwt) {
  const ws = new WebSocket(
    `ws://localhost:4000/ws?token=${encodeURIComponent(jwt)}`
  );

  ws.onopen = () => console.log("WS connected");
  ws.onclose = () => console.log("WS disconnected");
  ws.onerror = (err) => console.error("WS error", err);

  const listeners = {};

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type && listeners[data.type]) {
      listeners[data.type].forEach((cb) => cb(data));
    }
  };

  return {
    ws,
    on: (type, cb) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(cb);
    },
    send: (payload) => ws.send(JSON.stringify(payload)),
    joinRoom: (roomId) =>
      ws.send(JSON.stringify({ type: "join_room", roomId })),
    leaveRoom: (roomId) =>
      ws.send(JSON.stringify({ type: "leave_room", roomId })),
    sendLocation: (roomId, lat, lng) =>
      ws.send(
        JSON.stringify({
          type: "location_update",
          roomId,
          latitude: lat,
          longitude: lng,
        })
      ),
  };
}