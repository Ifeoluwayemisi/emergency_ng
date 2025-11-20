import RoleLayout from "../../../components/RoleLayout";

export default function UserDashboard() {
  return (
    <RoleLayout role="user">
      <h1 className="text-2xl font-bold mb-4">User Dashboard</h1>
      {/* Emergency creation component or live map will go here */}
    </RoleLayout>
  );
}


'use client';
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
