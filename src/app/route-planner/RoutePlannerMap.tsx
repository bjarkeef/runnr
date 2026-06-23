import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
import { LatLngExpression, LatLng, LatLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
import L from 'leaflet';
// @ts-expect-error leaflet's types don't expose _getIconUrl
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
  type?: 'loop' | 'out-and-back';
}

interface RoutePlannerMapProps {
  startLocation: LatLng | null;
  route: RouteData | null;
  onLocationSelect: (latlng: LatLng) => void;
}

function MapClickHandler({ onLocationSelect }: { onLocationSelect: (latlng: LatLng) => void }) {
  useMapEvents({
    click: (e) => {
      onLocationSelect(e.latlng);
    },
  });
  return null;
}

function Recenter({ center }: { center: LatLngExpression }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

/** Fit the map to the full route once it arrives */
function FitRouteBounds({ geometry }: { geometry: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (!geometry || geometry.length < 2) return;
    const bounds = new LatLngBounds(geometry.map(([lat, lng]) => [lat, lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [geometry, map]);

  return null;
}

export default function RoutePlannerMap({ startLocation, route, onLocationSelect }: RoutePlannerMapProps) {
  const defaultCenter: LatLngExpression = useMemo(
    () => [
      parseFloat(process.env.NEXT_PUBLIC_ROUTE_PLANNER_LAT || '55.4038'),
      parseFloat(process.env.NEXT_PUBLIC_ROUTE_PLANNER_LNG || '10.4024'),
    ],
    []
  );
  const [mapCenter, setMapCenter] = useState<LatLngExpression>(defaultCenter);

  // Default start at map center on first load only
  useEffect(() => {
    if (!startLocation) {
      const [lat, lng] = defaultCenter as [number, number];
      onLocationSelect(new LatLng(lat, lng));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter when start changes and there is no active route yet
  useEffect(() => {
    if (startLocation && !route) {
      setMapCenter([startLocation.lat, startLocation.lng]);
    }
  }, [startLocation, route]);

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

      {!route && <Recenter center={mapCenter} />}
      {route?.geometry && route.geometry.length >= 2 && (
        <FitRouteBounds geometry={route.geometry} />
      )}
      <MapClickHandler onLocationSelect={onLocationSelect} />

      {startLocation && (
        <Marker position={startLocation}>
          <Popup>
            <div className="text-sm">
              <strong>Start</strong>
              <br />
              {startLocation.lat.toFixed(4)}, {startLocation.lng.toFixed(4)}
            </div>
          </Popup>
        </Marker>
      )}

      {route?.geometry && route.geometry.length >= 2 && (
        <Polyline
          key={`route-${route.geometry.length}-${route.distance}`}
          positions={route.geometry}
          color="#FC4C02"
          weight={5}
          opacity={0.9}
        />
      )}
    </MapContainer>
  );
}
