import { useState, useEffect } from "react";
import RoleLayout from "../../../components/RoleLayout";
import MapLive from "../../../components/MapLive";
import { getToken } from "../../../utils/auth";
import { connectWS } from "../../../utils/wsClient";

export default function CreateEmergency() {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState([6.5244, 3.3792]); // Default Lagos
  const [responders, setResponders] = useState([]);
  const token = getToken();

  // Connect WebSocket
  useEffect(() => {
    if (!token) return;
    const ws = connectWS(token, (data) => {
      if (data.type === "responder_location") {
        setResponders((prev) =>
          prev.map((r) =>
            r.id === data.id ? { ...r, lat: data.lat, lng: data.lng } : r
          )
        );
      }
      if (data.type === "responder_accepted") {
        console.log("Responder accepted:", data);
      }
    });

    return () => ws.close();
  }, [token]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
      });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("http://localhost:4000/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          lat: userLocation[0],
          lng: userLocation[1],
        }),
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || "Failed to create emergency");

      alert("Emergency created successfully!");
      setDescription("");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleLayout role="user">
      <h1 className="text-2xl font-bold mb-4">Create Emergency</h1>

      <form onSubmit={handleSubmit} className="mb-6 space-y-4">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the emergency..."
          className="w-full p-3 border rounded"
          required
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Emergency"}
        </button>
      </form>

      <MapLive userLocation={userLocation} responders={responders} />
    </RoleLayout>
  );
}
