import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import { LatLngExpression, LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface RouteData {
  geometry: [number, number][];
  distance: number;
  duration: number;
  instructions?: string[];
}

interface RoutePlannerMapProps {
  startLocation: LatLng | null;
  route: RouteData | null;
  onLocationSelect: (latlng: LatLng) => void;
}

// Component to handle map clicks
function MapClickHandler({ onLocationSelect }: { onLocationSelect: (latlng: LatLng) => void }) {
  useMapEvents({
    click: (e) => {
      onLocationSelect(e.latlng);
    },
  });
  return null;
}

export default function RoutePlannerMap({ startLocation, route, onLocationSelect }: RoutePlannerMapProps) {
  // Default map center (can be user's location or a default city)
  const defaultCenter: LatLngExpression = [40.7128, -74.0060]; // New York City

  return (
    <MapContainer
      center={defaultCenter}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      className="rounded-lg"
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />

      <MapClickHandler onLocationSelect={onLocationSelect} />

      {startLocation && (
        <Marker position={startLocation}>
          <Popup>
            <div className="text-sm">
              <strong>Start Location</strong><br />
              {startLocation.lat.toFixed(4)}, {startLocation.lng.toFixed(4)}
            </div>
          </Popup>
        </Marker>
      )}

      {route && (
        <Polyline
          positions={route.geometry}
          color="#FC4C02"
          weight={4}
          opacity={0.8}
        />
      )}
    </MapContainer>
  );
}