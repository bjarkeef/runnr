'use client';

import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import polyline from '@mapbox/polyline';
import { LatLngExpression } from 'leaflet';

// This is a fix for a known issue with react-leaflet and webpack.
import L from 'leaflet';
// @ts-expect-error leaflet-default-icon-fix - This is a known issue with react-leaflet and webpack.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface RunMapProps {
    polyline: string;
}

export default function RunMap({ polyline: encodedPolyline }: RunMapProps) {
    if (!encodedPolyline) {
        return <div className="h-64 sm:h-80 lg:h-96 w-full bg-muted rounded-lg flex items-center justify-center text-sm sm:text-base">No map data for this run.</div>;
    }

    const positions = polyline.decode(encodedPolyline).map(p => [p[0], p[1]]) as LatLngExpression[];

    // Calculate bounds from all positions for better fit
    const coords = positions as [number, number][];
    const latitudes = coords.map(pos => pos[0]);
    const longitudes = coords.map(pos => pos[1]);
    const bounds = positions.length > 1 
        ? [[Math.min(...latitudes), Math.min(...longitudes)], [Math.max(...latitudes), Math.max(...longitudes)]] as [[number, number], [number, number]]
        : undefined;

    return (
        <div className="h-64 sm:h-80 lg:h-96 w-full rounded-lg overflow-hidden">
        <MapContainer 
            bounds={bounds}
            center={positions[0] as [number, number]}
            zoom={bounds ? undefined : 10}
            style={{ height: '100%', width: '100%' }}
        >
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <Polyline positions={positions} color="#FC4C02" weight={4} opacity={0.8} />
        </MapContainer>
        </div>
    );
}