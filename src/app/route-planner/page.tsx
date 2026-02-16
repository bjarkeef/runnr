'use client';

import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Route } from 'lucide-react';
import { useUser } from '@/context/UserContext';

// Dynamically import the entire page content to avoid SSR issues with Leaflet
const RoutePlannerContent = dynamic(() => import('./RoutePlannerContent'), {
  ssr: false,
  loading: () => (
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
            <CardContent>
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground">Loading route planner...</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card className="h-[600px]">
            <CardContent className="p-0 h-full flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground">Loading map...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  ),
});

export default function RoutePlannerPage() {
  const { user } = useUser();

  if (!user) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Route Planner</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Please log in with Strava to plan routes.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <RoutePlannerContent />;
}