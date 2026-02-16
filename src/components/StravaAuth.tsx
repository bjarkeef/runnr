'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function StravaAuth() {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold">Welcome to Runnr</CardTitle>
        <CardDescription>Connect your Strava account to get started.</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button asChild size="lg">
          <a href="/api/auth/login">Connect with Strava</a>
        </Button>
      </CardContent>
    </Card>
  );
}