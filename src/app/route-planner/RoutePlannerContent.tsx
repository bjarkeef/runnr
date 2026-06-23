'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Route, Target, RotateCcw, Shuffle } from 'lucide-react';
import { LatLng } from 'leaflet';

interface RouteData {
  geometry: [number, number][];
  distance: number;
  duration: number;
  instructions?: string[];
  type?: 'loop' | 'out-and-back';
  accuracy?: number;
}

interface RouteStats {
  distance: number;
  duration: number;
}

// Dynamically import the map component to avoid SSR issues
const RoutePlannerMap = dynamic(() => import('./RoutePlannerMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    </div>
  ),
});

const runningDistances = [
  { value: 3, label: '3K Fun Run' },
  { value: 5, label: '5K' },
  { value: 8, label: '8K' },
  { value: 10, label: '10K' },
  { value: 12, label: '12K' },
  { value: 15, label: '15K' },
  { value: 16.1, label: '10 Miles' },
  { value: 21.1, label: 'Half Marathon' },
  { value: 26.2, label: 'Marathon' },
  { value: 30, label: '30K' },
  { value: 42.2, label: 'Ultra (42K)' },
];

export default function RoutePlannerContent() {
  const [startLocation, setStartLocation] = useState<LatLng | null>(null);
  const [targetDistance, setTargetDistance] = useState<number>(5); // km
  const [variant, setVariant] = useState(0);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [routeStats, setRouteStats] = useState<RouteStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLocationSelect = useCallback((latlng: LatLng) => {
    setStartLocation(latlng);
    setRoute(null);
    setRouteStats(null);
    setError(null);
    setVariant(0);
  }, []);

  const requestRoute = async (variantIndex: number) => {
    if (!startLocation) {
      setError('Please select a starting location on the map');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/route-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startLat: startLocation.lat,
          startLng: startLocation.lng,
          targetDistance: targetDistance * 1000,
          variant: variantIndex,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate route');
      }

      setRoute(data.route);
      setRouteStats(data.stats);
      setVariant(variantIndex);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate route');
    } finally {
      setIsLoading(false);
    }
  };

  const generateRoute = () => requestRoute(variant);

  const tryAnotherRoute = () => requestRoute(variant + 1);

  const clearRoute = () => {
    setRoute(null);
    setRouteStats(null);
    setError(null);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDistance = (meters: number) => `${(meters / 1000).toFixed(2)} km`;

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5" />
                Route Planner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Click the map to set your start, pick a distance, then generate a loop on real roads.
                Same location + distance always yields the same route; use &quot;Another route&quot; for a different direction.
              </p>

              <div>
                <label htmlFor="distance" className="text-sm font-medium">
                  Target Distance
                </label>
                <Select
                  value={targetDistance.toString()}
                  onValueChange={(value) => {
                    setTargetDistance(parseFloat(value));
                    setRoute(null);
                    setRouteStats(null);
                    setVariant(0);
                  }}
                >
                  <SelectTrigger className="mt-2" id="distance">
                    <SelectValue placeholder="Select distance" />
                  </SelectTrigger>
                  <SelectContent>
                    {runningDistances.map((distance) => (
                      <SelectItem key={distance.value} value={distance.value.toString()}>
                        {distance.label} ({distance.value} km)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Starting Location</label>
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  {startLocation ? (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-green-600" />
                      <span>
                        {startLocation.lat.toFixed(4)}, {startLocation.lng.toFixed(4)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>Click on the map to set start location</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={generateRoute}
                  disabled={!startLocation || isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Target className="h-4 w-4 mr-2" />
                      Generate Route
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={clearRoute}
                  disabled={!route || isLoading}
                  title="Clear route"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

              {route && (
                <Button
                  variant="secondary"
                  onClick={tryAnotherRoute}
                  disabled={!startLocation || isLoading}
                  className="w-full"
                >
                  <Shuffle className="h-4 w-4 mr-2" />
                  Another route
                </Button>
              )}

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {routeStats && route && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Route Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Distance</span>
                  <Badge variant="secondary">{formatDistance(routeStats.distance)}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Est. duration</span>
                  <Badge variant="secondary">{formatDuration(routeStats.duration)}</Badge>
                </div>
                {route.type && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Type</span>
                    <Badge variant="outline">
                      {route.type === 'loop' ? 'Loop' : 'Out & back'}
                    </Badge>
                  </div>
                )}
                {route.accuracy != null && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">vs target</span>
                    <Badge variant="outline">{(route.accuracy * 100).toFixed(0)}%</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card className="h-[600px]">
            <CardContent className="p-0 h-full">
              <RoutePlannerMap
                startLocation={startLocation}
                route={route}
                onLocationSelect={handleLocationSelect}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
