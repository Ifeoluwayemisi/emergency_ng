"use client";

import { useState, useEffect } from "react";
import { api, setAuthToken } from "../utils/api";
import { getToken } from "../utils/auth";
import { createWsClient } from "../utils/wsClient";
import MapLive from "../components/MapLive";

export default function UserDashboard() {
  const [location, setLocation] = useState(null);
  const [responders, setResponders] = useState([]);
  const [description, setDescription] = useState("");
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) window.location.href = "/login";
    setAuthToken(token);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => console.log("Location error:", err)
    );
  }, []);

  useEffect(() => {
    if (!location) return;
    const token = getToken();
    const socket = createWsClient(token);
    setWs(socket);

    socket.on("responder_accepted", (data) => {
      alert(`Responder accepted your emergency: ${data.responder.name}`);
    });

    socket.on("location_update", (data) => {
      setResponders((prev) =>
        prev.map((r) =>
          r.id === data.responderId
            ? { ...r, latitude: data.latitude, longitude: data.longitude }
            : r
        )
      );
    });
  }, [location]);

  const createEmergency = async () => {
    const res = await api.post("/emergency", {
      description,
      latitude: location.lat,
      longitude: location.lng,
    });

    alert("Emergency created! Rescuers are being notified...");
    ws.joinRoom(`user:${res.data.emergency.id}`);
  };

  if (!location) return <p>Loading location…</p>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-red-600 mb-4">User Dashboard</h1>

      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <h2 className="text-xl font-semibold mb-2 text-gray-800">
          Create Emergency
        </h2>
        <textarea
          className="w-full border p-2 rounded bg-gray-50"
          rows={3}
          placeholder="Describe your emergency..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          onClick={createEmergency}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Send Alert
        </button>
      </div>

      <MapLive userLocation={location} responders={responders} />
    </div>
  );
}