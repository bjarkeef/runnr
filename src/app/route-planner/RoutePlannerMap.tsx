import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
import { LatLngExpression, LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
import L from 'leaflet';
// @ts-ignore - leaflet's types don't expose _getIconUrl
delete (L.Icon.Default.prototype as any)._getIconUrl;
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
  // Default map center from environment (fallback to Odense, Denmark)
  const defaultCenter: LatLngExpression = [
    parseFloat(process.env.NEXT_PUBLIC_ROUTE_PLANNER_LAT || '55.4038'),
    parseFloat(process.env.NEXT_PUBLIC_ROUTE_PLANNER_LNG || '10.4024'),
  ];
  const [mapCenter, setMapCenter] = useState<LatLngExpression>(defaultCenter);

  // choose initial start location once
  useEffect(() => {
    if (!startLocation) {
      onLocationSelect(new LatLng(defaultCenter[0], defaultCenter[1]));
    }
    // only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // whenever the start location changes, recenter map
  useEffect(() => {
    if (startLocation) {
      setMapCenter([startLocation.lat, startLocation.lng]);
    }
  }, [startLocation]);

  // keep map view in sync with mapCenter state
  function Recenter({ center }: { center: LatLngExpression }) {
    const map = useMap();
    useEffect(() => {
      map.setView(center);
    }, [center, map]);
    return null;
  }

  return (
    <MapContainer
      center={mapCenter}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      className="rounded-lg"
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />

      <Recenter center={mapCenter} />
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