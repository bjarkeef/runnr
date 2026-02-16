'use client';

import { useState, useEffect } from 'react';
import polyline from '@mapbox/polyline';
import type { LatLngExpression } from 'leaflet';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Dynamically import the map component to ensure it's only rendered on the client side.
const HeatmapClient = dynamic(() => import('@/components/HeatmapClient'), {
  ssr: false,
  loading: () => <Skeleton className="h-[calc(100vh-8rem)] w-full rounded-lg" />,
});

interface Activity {
  id: number;
  name: string;
  start_date: string;
  map: {
    summary_polyline: string;
  };
  start_latlng: [number, number];
  distance: number;
  moving_time: number;
  elapsed_time: number;
  average_speed: number;
}

interface RouteData {
  positions: [number, number][];
  frequency: number;
  activities: {
    id: number;
    name: string;
    start_date: string;
    distance: number;
    moving_time: number;
    average_speed: number;
  }[];
}

export default function Heatmap() {
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [mapCenter, setMapCenter] = useState<LatLngExpression>([51.505, -0.09]);
  const [stats, setStats] = useState({ totalRuns: 0, totalDistance: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/heatmap');
        if (!response.ok) throw new Error('Failed to fetch activities');

        const data = await response.json();
        const activities: Activity[] = data.activities;

        if (!activities || activities.length === 0) {
          setError('No activities found to display on the heatmap.');
          setLoading(false);
          return;
        }

        // Calculate stats
        const totalRuns = activities.length;
        const totalDistance = activities.reduce((sum, activity) => sum + activity.distance, 0);
        setStats({ totalRuns, totalDistance });

        // Process routes and group by similarity (optimized grouping)
        const routeMap = new Map<string, {
          positions: [number, number][];
          frequency: number;
          activities: { id: number; name: string; start_date: string; distance: number; moving_time: number; average_speed: number; }[]
        }>();

        activities.forEach(activity => {
          if (activity.map && activity.map.summary_polyline) {
            const positions = polyline.decode(activity.map.summary_polyline).map((p: [number, number]) => [p[0], p[1]] as [number, number]);

            // Create a refined key for grouping: start/end (3 decimals), mid (2 decimals), and distance (500m)
            const startPoint = positions[0];
            const endPoint = positions[positions.length - 1];
            const midPoint = positions[Math.floor(positions.length / 2)];
            const distance = activity.distance;

            // This ensures runs with different mid-paths or distances stay separate
            const routeKey = `${startPoint[0].toFixed(3)},${startPoint[1].toFixed(3)}-${midPoint[0].toFixed(2)},${midPoint[1].toFixed(2)}-${endPoint[0].toFixed(3)},${endPoint[1].toFixed(3)}-${Math.round(distance / 500)}`;

            const activityInfo = {
              id: activity.id,
              name: activity.name,
              start_date: activity.start_date,
              distance: activity.distance,
              moving_time: activity.moving_time,
              average_speed: activity.average_speed
            };

            if (routeMap.has(routeKey)) {
              const route = routeMap.get(routeKey)!;
              route.frequency += 1;
              route.activities.push(activityInfo);
            } else {
              routeMap.set(routeKey, {
                positions,
                frequency: 1,
                activities: [activityInfo]
              });
            }
          }
        });

        // Convert to array and sort by frequency (ascending) for render order
        const routesArray = Array.from(routeMap.values()).sort((a, b) => a.frequency - b.frequency);
        setRoutes(routesArray);

        // Set map center to the start of the first activity with lat/lng
        const firstActivityWithLocation = activities.find(a => a.start_latlng && a.start_latlng.length === 2);
        if (firstActivityWithLocation) {
          setMapCenter([firstActivityWithLocation.start_latlng[0], firstActivityWithLocation.start_latlng[1]]);
        }

      } catch {
        setError('Failed to load your activity data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  // Only render the map when we have data and it's not loading
  if (loading || routes.length === 0) {
    return <Skeleton className="h-[calc(100vh-8rem)] w-full rounded-lg" />;
  }

  return <HeatmapClient key="heatmap-client" routes={routes} mapCenter={mapCenter} stats={stats} />;
}