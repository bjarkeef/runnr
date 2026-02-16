'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';

interface Shoe {
    id: string;
    name: string;
    brand_name?: string;
    model_name?: string;
    description?: string;
    distance: number; // in meters
    primary: boolean;
    retired: boolean;
}

// Shoe lifespan constants (in km)
const SHOE_WARNING_KM = 600;
const SHOE_DANGER_KM = 800;
const SHOE_MAX_KM = 1000;

function getShoeHealth(distanceMeters: number): { status: 'good' | 'warning' | 'danger' | 'replace'; percentage: number; color: string; message: string } {
    const km = distanceMeters / 1000;
    const percentage = Math.min((km / SHOE_MAX_KM) * 100, 100);
    
    if (km >= SHOE_DANGER_KM) {
        return { status: 'replace', percentage, color: 'bg-red-500', message: 'Time to replace!' };
    } else if (km >= SHOE_WARNING_KM) {
        return { status: 'danger', percentage, color: 'bg-orange-500', message: 'Monitor closely' };
    } else if (km >= SHOE_WARNING_KM * 0.75) {
        return { status: 'warning', percentage, color: 'bg-yellow-500', message: 'Getting worn' };
    }
    return { status: 'good', percentage, color: 'bg-green-500', message: 'Good condition' };
}

export default function GearPage() {
    const [shoes, setShoes] = useState<Shoe[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchGear = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/gear');
                if (!response.ok) {
                    throw new Error('Failed to fetch gear');
                }
                const data = await response.json();
                setShoes(data.shoes || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load gear');
            } finally {
                setLoading(false);
            }
        };

        fetchGear();
    }, []);

    if (loading) {
        return (
            <div className="container mx-auto max-w-4xl p-4">
                <Skeleton className="h-8 w-48 mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader>
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-2 w-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto max-w-4xl p-4">
                <div className="text-center text-red-500">{error}</div>
            </div>
        );
    }

    const activeShoes = shoes.filter(s => !s.retired);
    const retiredShoes = shoes.filter(s => s.retired);
    const totalDistance = shoes.reduce((sum, s) => sum + s.distance, 0) / 1000;

    return (
        <div className="container mx-auto max-w-4xl p-4 space-y-6">
            {/* Back Button */}
            <Button variant="ghost" asChild className="-ml-2">
                <Link href="/runs" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Runs</span>
                </Link>
            </Button>

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                    <span className="text-3xl">👟</span>
                    My Running Shoes
                </h1>
                <p className="text-muted-foreground mt-1">
                    Track your shoe distance (km) and know when it&apos;s time to replace them
                </p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-2xl font-bold">{activeShoes.length}</p>
                        <p className="text-sm text-muted-foreground">Active Shoes</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-2xl font-bold">{retiredShoes.length}</p>
                        <p className="text-sm text-muted-foreground">Retired</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-2xl font-bold">{totalDistance.toFixed(0)}</p>
                        <p className="text-sm text-muted-foreground">Total km</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-2xl font-bold">
                            {activeShoes.filter(s => getShoeHealth(s.distance).status === 'replace' || getShoeHealth(s.distance).status === 'danger').length}
                        </p>
                        <p className="text-sm text-muted-foreground">Need Attention</p>
                    </CardContent>
                </Card>
            </div>

            {shoes.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <span className="text-4xl mb-4 block">👟</span>
                        <p className="text-lg font-medium">No shoes found</p>
                        <p className="text-muted-foreground mt-2">
                            Add your running shoes in Strava to track their distance here (km)
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Active Shoes */}
                    {activeShoes.length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold">Active Shoes</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {activeShoes.map((shoe) => {
                                    const health = getShoeHealth(shoe.distance);
                                    const km = shoe.distance / 1000;
                                    
                                    return (
                                        <Card key={shoe.id} className={`relative overflow-hidden ${health.status === 'replace' ? 'border-red-500' : health.status === 'danger' ? 'border-orange-500' : ''}`}>
                                            <CardHeader className="pb-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <CardTitle className="text-lg flex items-center gap-2">
                                                            {shoe.name}
                                                            {shoe.primary && (
                                                                <Badge variant="secondary" className="text-xs">Primary</Badge>
                                                            )}
                                                        </CardTitle>
                                                        {(shoe.brand_name || shoe.model_name) && (
                                                            <CardDescription>
                                                                {shoe.brand_name} {shoe.model_name}
                                                            </CardDescription>
                                                        )}
                                                    </div>
                                                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                                                        health.status === 'good' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                                        health.status === 'warning' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                                                        health.status === 'danger' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                                                        'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                                    }`}>
                                                        {health.message}
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <div className="flex items-end justify-between">
                                                    <div>
                                                        <p className="text-3xl font-bold">{km.toFixed(0)} km</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {(SHOE_MAX_KM - km).toFixed(0)} km remaining
                                                        </p>
                                                    </div>
                                                    <div className="text-right text-sm text-muted-foreground">
                                                        <p>{(km / SHOE_MAX_KM * 100).toFixed(0)}% used</p>
                                                    </div>
                                                </div>
                                                
                                                {/* Progress Bar */}
                                                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full transition-all duration-500 ${health.color}`}
                                                        style={{ width: `${Math.min(health.percentage, 100)}%` }}
                                                    />
                                                </div>
                                                
                                                {/* Milestones */}
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>0 km</span>
                                                    <span className="text-yellow-600">600 km</span>
                                                    <span className="text-orange-600">800 km</span>
                                                    <span className="text-red-600">1000 km</span>
                                                </div>

                                                {shoe.description && (
                                                    <p className="text-sm text-muted-foreground italic pt-2 border-t">
                                                        {shoe.description}
                                                    </p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Retired Shoes */}
                    {retiredShoes.length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-muted-foreground">Retired Shoes</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {retiredShoes.map((shoe) => (
                                    <Card key={shoe.id} className="opacity-60">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <CardTitle className="text-lg flex items-center gap-2">
                                                        {shoe.name}
                                                        <Badge variant="outline" className="text-xs">Retired</Badge>
                                                    </CardTitle>
                                                    {(shoe.brand_name || shoe.model_name) && (
                                                        <CardDescription>
                                                            {shoe.brand_name} {shoe.model_name}
                                                        </CardDescription>
                                                    )}
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-2xl font-bold">{(shoe.distance / 1000).toFixed(0)} km</p>
                                            <p className="text-sm text-muted-foreground">Total distance</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Info Box */}
            <Card className="bg-muted/50">
                <CardContent className="pt-6">
                    <div className="flex gap-4">
                        <span className="text-2xl">💡</span>
                        <div className="space-y-2 text-sm">
                            <p className="font-medium">When to replace your running shoes:</p>
                            <ul className="list-disc list-inside text-muted-foreground space-y-1">
                                <li><span className="text-green-600 font-medium">0-600 km</span> - Shoes are in good condition</li>
                                <li><span className="text-yellow-600 font-medium">600-800 km</span> - Start monitoring for wear</li>
                                <li><span className="text-orange-600 font-medium">800-1000 km</span> - Consider replacing soon</li>
                                <li><span className="text-red-600 font-medium">1000+ km</span> - Time to replace to prevent injury</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
