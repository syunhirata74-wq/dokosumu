"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = defaultIcon;

type Facility = {
  name: string;
  type: string;
  lat: number;
  lng: number;
  rating: number | null;
  address: string | null;
};

type Props = {
  facilities: Facility[];
  typeIcons: Record<string, string>;
};

export default function FacilityMap({ facilities, typeIcons }: Props) {
  if (facilities.length === 0) return null;

  // Center on average of all facilities
  const centerLat = facilities.reduce((s, f) => s + f.lat, 0) / facilities.length;
  const centerLng = facilities.reduce((s, f) => s + f.lng, 0) / facilities.length;

  return (
    <div className="h-64 rounded-lg overflow-hidden border mt-3">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={15}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {facilities.map((f, i) => (
          <Marker key={i} position={[f.lat, f.lng]}>
            <Popup>
              <div className="text-sm">
                <div className="font-bold">{typeIcons[f.type] ?? "📍"} {f.name}</div>
                {f.rating && <div>★ {f.rating}</div>}
                {f.address && <div className="text-xs text-gray-500">{f.address}</div>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
