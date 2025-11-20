// "use client";

// import { useEffect, useState } from "react";
// import { api, setAuthToken } from "../../../utils/api";
// import { getToken } from "../../../utils/auth";
// import { createWsClient } from "../../../utils/wsClient";
// import MapLive from "../../../components/MapLive";

// export default function ResponderDashboard() {
//   const [emergency, setEmergency] = useState(null);
//   const [location, setLocation] = useState(null);
//   const [ws, setWs] = useState(null);

//   useEffect(() => {
//     const token = getToken();
//     if (!token) window.location.href = "/login";
//     setAuthToken(token);

//     navigator.geolocation.watchPosition((pos) => {
//       setLocation({
//         lat: pos.coords.latitude,
//         lng: pos.coords.longitude,
//       });
//     });
//   }, []);

//   useEffect(() => {
//     const token = getToken();
//     const socket = createWsClient(token);
//     setWs(socket);

//     socket.on("new_emergency", (data) => {
//       setEmergency(data.emergency);
//     });
//   }, []);

//   const acceptEmergency = async () => {
//     await api.post(`/emergency/${emergency.id}/accept`);
//     ws.joinRoom(`emergency:${emergency.id}`);
//     alert("Emergency accepted!");
//   };

//   if (!location) return <p>Tracking your location…</p>;

//   return (
//     <div className="p-6">
//       <h1 className="text-3xl text-red-600 font-bold mb-4">
//         Responder Dashboard
//       </h1>

//       {!emergency && (
//         <p className="text-gray-700">Waiting for emergency alerts…</p>
//       )}

//       {emergency && (
//         <div className="bg-white p-4 rounded shadow mb-4">
//           <h2 className="text-xl font-semibold">Emergency Alert</h2>
//           <p className="text-gray-600">{emergency.description}</p>
//           <button
//             onClick={acceptEmergency}
//             className="mt-3 px-4 py-2 bg-teal-600 text-white rounded"
//           >
//             Accept Emergency
//           </button>
//         </div>
//       )}

//       <MapLive userLocation={location} responders={[]} />
//     </div>
//   );
// }


"use client";
import { createWsClient } from "../../utils/wsClient";
import { getToken } from "../../utils/auth";
import MapLive from "../../components/MapLive";

export default function UserDashboardPage({ userLocation, initialResponders }) {
  // Create WebSocket client once per page render
  const wsClient = createWsClient(getToken());

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">User Dashboard</h1>

      <MapLive
        userLocation={userLocation}
        initialResponders={initialResponders}
        wsClient={wsClient}
      />
    </div>
  );
}
