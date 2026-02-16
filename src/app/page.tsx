"use client";

import { useUser } from "@/context/UserContext";
import StravaAuth from "@/components/StravaAuth";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TodaySummary } from "@/components/TodaySummary";

export default function Home() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 animate-pulse">
        <div className="h-10 w-64 bg-muted rounded mb-6"></div>
        <div className="h-4 w-96 bg-muted rounded mb-10"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 bg-muted rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      {user ? (
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold mb-4 md:mb-6">
              Welcome, {user.firstname}! 🏃‍♂️
            </h1>
            <p className="text-sm md:text-lg text-muted-foreground">
              You are connected to Strava. Explore your data!
            </p>
          </div>

          <TodaySummary />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 lg:gap-8">
            <FeatureCard
              title="🏃‍♂️ Recent Runs"
              description="View and analyze your latest running activities."
              href="/runs"
            />
            <FeatureCard
              title="🎯 Race Predictions"
              description="Get race time predictions based on your recent performance."
              href="/race-predictions"
            />
            <FeatureCard
              title="🗺️ Route Planner"
              description="Plan custom running routes on the map with target distances."
              href="/route-planner"
            />
            <FeatureCard
              title="📊 Stats"
              description="Check out your personal records and analytics."
              href="/stats"
            />
            <FeatureCard
              title="🗺️ Activity Heatmap"
              description="Visualize your running routes on an interactive map."
              href="/heatmap"
            />
            <FeatureCard
              title="👟 Gear Tracking"
              description="Track shoe distance (km) and health."
              href="/gear"
            />
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto text-center py-12 md:py-20">
          <h1 className="text-3xl md:text-5xl font-bold mb-6">
            Your Personal Running Dashboard
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10">
            Connect with Strava to unlock AI-powered insights, race predictions,
            and detailed training analytics.
          </p>
          <StravaAuth />
        </div>
      )}
    </div>
  );
}

function FeatureCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="block group">
      <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50 border border-muted bg-card">
        <CardHeader>
          <CardTitle className="group-hover:text-primary transition-colors flex items-center gap-2">
            {title}
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            Explore now <span className="ml-1">→</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
