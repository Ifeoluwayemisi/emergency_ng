"use client";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState, useRef } from "react";
import L from "leaflet";

// Custom icons
const userIcon = new L.Icon({
  iconUrl: "/icons/user-pin.png",
  iconSize: [35, 35],
});

const responderIcon = new L.Icon({
  iconUrl: "/icons/responder-pin.png",
  iconSize: [35, 35],
});

// Hook to smoothly move a marker
function AnimatedMarker({ position, icon, children }) {
  const markerRef = useRef(null);
  const [currentPos, setCurrentPos] = useState(position);

  useEffect(() => {
    if (!markerRef.current) return;
    const marker = markerRef.current;

    const latDiff = position[0] - currentPos[0];
    const lngDiff = position[1] - currentPos[1];

    let frame = 0;
    const frames = 20; // number of animation frames
    const interval = setInterval(() => {
      frame++;
      const lat = currentPos[0] + (latDiff * frame) / frames;
      const lng = currentPos[1] + (lngDiff * frame) / frames;
      marker.setLatLng([lat, lng]);
      if (frame === frames) {
        clearInterval(interval);
        setCurrentPos(position); // update current position
      }
    }, 50); // 50ms per frame (~1 second animation)

    return () => clearInterval(interval);
  }, [position]);

  return (
    <Marker ref={markerRef} position={currentPos} icon={icon}>
      {children}
    </Marker>
  );
}

// Center map on user location when it changes
function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

export default function MapLive({ userLocation, initialResponders, wsClient }) {
  const [responders, setResponders] = useState(initialResponders || []);

  // WebSocket updates
  useEffect(() => {
    if (!wsClient) return;

    wsClient.on("location_update", (data) => {
      setResponders((prev) => {
        const idx = prev.findIndex((r) => r.id === data.responderId);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            latitude: data.latitude,
            longitude: data.longitude,
          };
          return updated;
        } else {
          return [
            ...prev,
            {
              id: data.responderId,
              name: data.name,
              latitude: data.latitude,
              longitude: data.longitude,
            },
          ];
        }
      });
    });
  }, [wsClient]);

  return (
    <MapContainer
      center={[userLocation.lat, userLocation.lng]}
      zoom={13}
      style={{ height: "400px", width: "100%" }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {/* Center map on user */}
      <RecenterMap lat={userLocation.lat} lng={userLocation.lng} />

      {/* User marker */}
      <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
        <Popup>You are here</Popup>
      </Marker>

      {/* Responder markers */}
      {responders.map((r) => (
        <AnimatedMarker
          key={r.id}
          position={[r.latitude, r.longitude]}
          icon={responderIcon}
        >
          <Popup>{r.name}</Popup>
        </AnimatedMarker>
      ))}
    </MapContainer>
  );
}
