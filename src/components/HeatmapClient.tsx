'use client';

import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { LatLngExpression } from 'leaflet';
import Link from 'next/link';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Map as MapIcon, Filter, Layers, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

// This is a fix for a known issue with react-leaflet and webpack.
import L from 'leaflet';
// @ts-expect-error leaflet-default-icon-fix - This is a known issue with react-leaflet and webpack.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

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

interface HeatmapClientProps {
    routes: RouteData[];
    mapCenter: LatLngExpression;
    stats: {
        totalRuns: number;
        totalDistance: number;
    };
}

// Generate color based on frequency with better gradients
const getRouteColor = (frequency: number, maxFrequency: number) => {
    if (maxFrequency <= 1) return '#FFD700';

    // Use a power scale to boost visibility of lower-frequency routes
    const intensity = Math.pow(frequency / maxFrequency, 0.4);

    // Smooth transitions between colors
    if (intensity < 0.2) return '#FFD700'; // Gold
    if (intensity < 0.4) return '#FFA500'; // Orange
    if (intensity < 0.6) return '#FF6B00'; // Orange-red
    if (intensity < 0.8) return '#FF3300'; // Red-orange
    if (intensity < 0.95) return '#CC0000'; // Dark red
    return '#8B0000'; // Very dark red
};

// Get weight (thickness) based on frequency
const getRouteWeight = (frequency: number, maxFrequency: number) => {
    if (maxFrequency <= 1) return 3;
    const intensity = Math.pow(frequency / maxFrequency, 0.4);
    return Math.max(3, Math.min(10, 3 + intensity * 7));
};

export default function HeatmapClient({ routes, mapCenter, stats }: HeatmapClientProps) {
    const [isControlsOpen, setIsControlsOpen] = useState(true);
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
    const [distanceRange, setDistanceRange] = useState<number[]>([0, 50]);
    const [debouncedDistanceRange, setDebouncedDistanceRange] = useState<number[]>([0, 50]);
    const [isFiltering, setIsFiltering] = useState(false);

    // Calculate max possible distance from data for the slider
    const maxDataDistance = useMemo(() => {
        if (!routes.length) return 50;
        const max = Math.max(...routes.flatMap(r => r.activities.map(a => a.distance / 1000)));
        return Math.ceil(max);
    }, [routes]);

    // Update slider default max if data loads
    useMemo(() => {
        setDistanceRange([0, maxDataDistance]);
        setDebouncedDistanceRange([0, maxDataDistance]);
    }, [maxDataDistance]);

    // Debounce distance range updates
    useMemo(() => {
        setIsFiltering(true);
        const timer = setTimeout(() => {
            setDebouncedDistanceRange(distanceRange);
            setIsFiltering(false);
        }, 400);
        return () => clearTimeout(timer);
    }, [distanceRange]);

    const filteredRoutes = useMemo(() => {
        return routes.filter(route => {
            // Use the average distance of activities on this route
            const avgDistance = route.activities.reduce((sum, a) => sum + a.distance, 0) / route.activities.length / 1000;
            return avgDistance >= debouncedDistanceRange[0] && avgDistance <= debouncedDistanceRange[1];
        });
    }, [routes, debouncedDistanceRange]);

    const filteredStats = useMemo(() => {
        const totalRuns = filteredRoutes.reduce((sum, r) => sum + r.frequency, 0); // This might overcount if multiple logic is complex, but for now freq sum is approximation of visible "run segments"
        // Actually, improved stat calculation:
        // A generic precise "Total Runs" in view is harder because activities might share segments. 
        // But let's just sum the activities inside the filtered routes?
        // Wait, 'routes' are unique path segments. An activity might be split? No, the 'heatmap' logic in page.tsx groups WHOLE activities by similarity.
        // So we can sum up activities.
        const uniqueActivityIds = new Set<number>();
        filteredRoutes.forEach(r => r.activities.forEach(a => uniqueActivityIds.add(a.id)));

        const totalDistance = filteredRoutes.reduce((sum, r) => {
            // sum up distance of *unique* activities?
            return sum + r.activities.reduce((actSum, act) => actSum + act.distance, 0);
        }, 0);
        // Logic check: if routes are segments, adding distances of segments is correct for "total distance shown".
        // BUT if routes are "groups of similar full activities", then summing their distances is correct.
        // Based on page.tsx: "activities.forEach... routeKey... routeMap.set... activities.push(activityInfo)". 
        // It seems it groups FULL activities onto a route key.
        // So `filteredRoutes` contains groups of full activities.
        // However, one activity typically maps to ONE route key in that logic (simple clustering).
        // So we can just sum freely.

        // Actually, let's just use the unique activities to be safe if there's overlap in future logic
        // Re-calculating total distance from unique activities to avoid double counting if any
        // (Though current logic seems to put an activity in only one bucket).

        // Let's just sum activities in filteredRoutes strictly.
        const runCount = filteredRoutes.reduce((sum, r) => sum + r.activities.length, 0);
        const distSum = filteredRoutes.reduce((sum, r) => sum + r.activities.reduce((s, a) => s + a.distance, 0), 0);

        return { totalRuns: runCount, totalDistance: distSum };
    }, [filteredRoutes]);

    const maxFrequency = useMemo(() => {
        if (filteredRoutes.length === 0) return 0;
        return Math.max(...filteredRoutes.map(route => route.frequency));
    }, [filteredRoutes]);

    if (!routes || routes.length === 0) {
        return <div className="text-center p-8">No route data available.</div>;
    }

    return (
        <div className="relative h-[calc(100vh-8rem)] w-full rounded-xl overflow-hidden shadow-lg border border-border">
            {/* Map */}
            <MapContainer
                key={`map-${routes.length}`} // Force re-render if data changes significantly
                center={mapCenter}
                zoom={11}
                className="h-full w-full z-0"
                zoomControl={false} // We can add custom zoom control if needed, or let default be
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                {isFiltering && (
                    <div className="absolute inset-0 z-1000 flex items-center justify-center pointer-events-none">
                        <div className="bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                            <Layers className="w-4 h-4 animate-pulse text-primary" />
                            <span className="text-xs font-semibold">Filtering...</span>
                        </div>
                    </div>
                )}
                {/* Sort routes by frequency so most frequent render last (on top) */}
                {[...filteredRoutes].sort((a, b) => a.frequency - b.frequency).map((route, index) => (
                    <Polyline
                        key={`route-${index}-${route.frequency}`}
                        positions={route.positions}
                        color={getRouteColor(route.frequency, maxFrequency)}
                        weight={getRouteWeight(route.frequency, maxFrequency)}
                        opacity={0.8}
                    >
                        <Popup>
                            <div className="p-2 max-w-xs">
                                <h3 className="font-semibold text-sm mb-2">
                                    {route.frequency > 1 ? `${route.frequency} Runs on this Route` : 'Single Run'}
                                </h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {route.activities.slice(0, 3).map((activity) => (
                                        <div key={activity.id} className="border-b border-gray-100 pb-2 last:border-b-0">
                                            <div className="font-medium text-xs text-blue-600 hover:text-blue-800">
                                                <Link href={`/run/${activity.id}`}>
                                                    {activity.name}
                                                </Link>
                                            </div>
                                            <div className="text-xs text-gray-600 mt-1">
                                                {new Date(activity.start_date).toLocaleDateString()}
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                <span>{(activity.distance / 1000).toFixed(1)} km</span>
                                                <span>{Math.floor(activity.moving_time / 60)}:{(activity.moving_time % 60).toString().padStart(2, '0')}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {route.activities.length > 3 && (
                                        <div className="text-xs text-gray-500 text-center pt-1">
                                            ...and {route.activities.length - 3} more runs
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    </Polyline>
                ))}
            </MapContainer>

            {/* Mobile Filters Sheet (top-left on small screens) */}
            <Sheet open={isMobileFiltersOpen} onOpenChange={setIsMobileFiltersOpen}>
                <div className={`absolute top-4 left-4 z-50 md:hidden ${isMobileFiltersOpen ? 'hidden' : ''}`}>
                    <SheetTrigger asChild>
                        <Button aria-label="Open filters" variant="default" size="icon" className="h-10 w-10 rounded-full bg-white border border-border text-foreground shadow-sm hover:bg-white hover:shadow-sm">
                            <Filter className="h-5 w-5 text-foreground" />
                        </Button>
                    </SheetTrigger>
                </div>
                <SheetContent side="left" className="h-full w-[94%] sm:w-[80%] max-w-md p-0">
                    <div className="h-full bg-white/95 p-4 overflow-auto">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-muted-foreground" />
                                <SheetTitle className="text-sm font-semibold">Filters</SheetTitle>
                                <Button variant="outline" size="sm" className="ml-2" onClick={() => { setDistanceRange([0, maxDataDistance]); }}>
                                    Reset
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-medium text-muted-foreground">Distance Range</span>
                                        <span className="font-bold">{distanceRange[0]} - {distanceRange[1]} km</span>
                                    </div>
                                    <Slider
                                        min={0}
                                        max={maxDataDistance}
                                        step={1}
                                        value={distanceRange}
                                        onValueChange={setDistanceRange}
                                        className="py-2"
                                    />
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>0 km</span>
                                        <span>{maxDataDistance} km</span>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-border/50">
                                    <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                        <Layers className="w-3 h-3" />
                                        Frequency Legend
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                        <span>Rare</span>
                                        <div className="flex h-2 flex-1 mx-2 rounded-full overflow-hidden bg-linear-to-r from-[#FFD700] via-[#FF6B00] to-[#8B0000]"></div>
                                        <span>Frequent</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Float Controls */}
            <div className="absolute top-4 right-4 z-50 flex flex-col gap-4 w-44 sm:w-56 md:w-72">

                {/* Stats Card */}
                <Card className="p-2 sm:p-4 backdrop-blur-md bg-white/90 border-white/20 shadow-xl rounded-xl">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h3 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Runs</h3>
                            <p className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-red-600">
                                {filteredStats.totalRuns}
                            </p>
                        </div>
                        <div>
                            <h3 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Distance</h3>
                            <p className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600">
                                {(filteredStats.totalDistance / 1000).toFixed(0)} <span className="text-xs text-muted-foreground font-normal">km</span>
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Filters Panel (hidden on small screens) */}
                <div className="hidden md:block transition-all duration-300 ease-in-out">
                    <Card className={cn("overflow-hidden backdrop-blur-md bg-white/90 border-white/20 shadow-xl rounded-xl transition-all",
                        isControlsOpen ? "max-h-96" : "max-h-14"
                    )}>
                        <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-black/5 transition-colors"
                            onClick={() => setIsControlsOpen(!isControlsOpen)}
                        >
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-muted-foreground" />
                                <span className="font-semibold text-sm">Filters</span>
                            </div>
                            {isControlsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>

                        {isControlsOpen && (
                            <div className="px-4 pb-4 pt-0 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-medium text-muted-foreground">Distance Range</span>
                                            <span className="font-bold">{distanceRange[0]} - {distanceRange[1]} km</span>
                                        </div>
                                        <Slider
                                            min={0}
                                            max={maxDataDistance}
                                            step={1}
                                            value={distanceRange}
                                            onValueChange={setDistanceRange}
                                            className="py-2"
                                        />
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>0 km</span>
                                            <span>{maxDataDistance} km</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-border/50">
                                    <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                        <Layers className="w-3 h-3" />
                                        Frequency Legend
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                        <span>Rare</span>
                                        <div className="flex h-2 flex-1 mx-2 rounded-full overflow-hidden bg-gradient-to-r from-[#FFD700] via-[#FF6B00] to-[#8B0000]"></div>
                                        <span>Frequent</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
