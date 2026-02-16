'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { RaceGoal, TrainingPlan } from '@/types/race-predictions';

interface TrainingPlanCardProps {
    raceGoal: RaceGoal;
    trainingPlan: TrainingPlan;
}

export function TrainingPlanCard({ raceGoal, trainingPlan }: TrainingPlanCardProps) {
    const [showPreviousWeeks, setShowPreviousWeeks] = useState(false);
    const [showFutureWeeks, setShowFutureWeeks] = useState(false);

    // Find the current week index
    const currentWeekIndex = useMemo(() => {
        const today = new Date();
        return trainingPlan.plan.findIndex((week) => {
            const weekStart = new Date(week.weekStartDate);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            return today >= weekStart && today < weekEnd;
        });
    }, [trainingPlan.plan]);

    // Calculate which weeks to show
    const { previousWeeks, visibleWeeks, futureWeeks } = useMemo(() => {
        // If no current week found (plan hasn't started or already ended), show first 2 weeks
        const startIndex = currentWeekIndex >= 0 ? currentWeekIndex : 0;
        
        // Previous weeks (before current week)
        const previous = startIndex > 0 ? trainingPlan.plan.slice(0, startIndex) : [];
        
        // Current week + next week (or first 2 weeks if plan hasn't started)
        const endOfVisible = Math.min(startIndex + 2, trainingPlan.plan.length);
        const visible = trainingPlan.plan.slice(startIndex, endOfVisible);
        
        // Future weeks (after current + next week)
        const future = endOfVisible < trainingPlan.plan.length ? trainingPlan.plan.slice(endOfVisible) : [];
        
        return { previousWeeks: previous, visibleWeeks: visible, futureWeeks: future };
    }, [trainingPlan.plan, currentWeekIndex]);

    // Combine weeks based on show states
    const weeksToDisplay = useMemo(() => {
        let weeks = [...visibleWeeks];
        if (showPreviousWeeks && previousWeeks.length > 0) {
            weeks = [...previousWeeks, ...weeks];
        }
        if (showFutureWeeks && futureWeeks.length > 0) {
            weeks = [...weeks, ...futureWeeks];
        }
        return weeks;
    }, [visibleWeeks, previousWeeks, futureWeeks, showPreviousWeeks, showFutureWeeks]);

    return (
        <>
            {/* Recommendations */}
            <Card>
                <CardHeader>
                    <CardTitle>📋 Training Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2">
                        {trainingPlan.recommendations.map((rec, idx) => (
                            <li key={idx} className="text-sm">{rec}</li>
                        ))}
                    </ul>
                </CardContent>
            </Card>

            {/* Weekly Training Plan */}
            <Card>
                <CardHeader>
                    <CardTitle>📅 Your Training Plan</CardTitle>
                    <CardDescription>
                        {trainingPlan.plan.length} week personalized plan for your {raceGoal?.distance} race
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Show Previous Weeks Button */}
                    {previousWeeks.length > 0 && !showPreviousWeeks && (
                        <Button
                            onClick={() => setShowPreviousWeeks(true)}
                            variant="outline"
                            className="w-full"
                        >
                            ▲ Show {previousWeeks.length} Previous Week{previousWeeks.length > 1 ? 's' : ''}
                        </Button>
                    )}
                    
                    {weeksToDisplay.map((week) => {
                        const today = new Date();
                        const weekStart = new Date(week.weekStartDate);
                        const weekEnd = new Date(weekStart);
                        weekEnd.setDate(weekEnd.getDate() + 7);
                        const isCurrentWeek = today >= weekStart && today < weekEnd;
                        const currentDayOfWeek = today.getDay();
                        
                        return (
                            <div key={week.weekNumber} className={`border rounded-lg p-4 space-y-3 ${isCurrentWeek ? 'border-primary ring-2 ring-primary/20' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold">
                                            Week {week.weekNumber}: {week.focus}
                                            {isCurrentWeek && <span className="ml-2 text-sm text-primary">← Current Week</span>}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            Starting {new Date(week.weekStartDate).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' })} • {week.totalKilometers}km total
                                        </p>
                                    </div>
                                    <Badge variant="outline">{week.totalKilometers}km</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground italic">{week.notes}</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {week.workouts.map((workout, idx) => {
                                        const dayMapping: { [key: string]: number } = {
                                            'Sunday': 0,
                                            'Monday': 1,
                                            'Tuesday': 2,
                                            'Wednesday': 3,
                                            'Thursday': 4,
                                            'Friday': 5,
                                            'Saturday': 6
                                        };
                                        const workoutDayNumber = dayMapping[workout.day];
                                        const isToday = isCurrentWeek && workoutDayNumber === currentDayOfWeek;
                                        
                                        return (
                                            <div 
                                                key={idx} 
                                                className={`p-3 rounded-md border ${
                                                    isToday ? 'ring-2 ring-primary border-primary bg-primary/5' :
                                                    workout.type === 'Rest' ? 'bg-muted/30' :
                                                    workout.type === 'Race Day' ? 'bg-primary/10 border-primary' :
                                                    workout.intensity === 'High' ? 'bg-orange-50 dark:bg-orange-950/20' :
                                                    'bg-background'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-xs font-medium text-muted-foreground">
                                                        {workout.day}
                                                        {isToday && <span className="ml-1 text-primary font-bold">← Today</span>}
                                                    </p>
                                                    <Badge 
                                                        variant={
                                                            workout.intensity === 'High' ? 'destructive' :
                                                            workout.intensity === 'Medium' ? 'default' : 'secondary'
                                                        }
                                                        className="text-xs"
                                                    >
                                                        {workout.type}
                                                    </Badge>
                                                </div>
                                                {workout.distance && (
                                                    <p className="text-sm font-semibold mb-1">{workout.distance}km</p>
                                                )}
                                                <p className="text-xs text-muted-foreground">{workout.description}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    
                    {/* Show Future Weeks Button */}
                    {futureWeeks.length > 0 && !showFutureWeeks && (
                        <Button
                            onClick={() => setShowFutureWeeks(true)}
                            variant="outline"
                            className="w-full"
                        >
                            ▼ Show {futureWeeks.length} More Week{futureWeeks.length > 1 ? 's' : ''}
                        </Button>
                    )}
                    
                    {/* Collapse Button when expanded */}
                    {(showPreviousWeeks || showFutureWeeks) && (
                        <Button
                            onClick={() => {
                                setShowPreviousWeeks(false);
                                setShowFutureWeeks(false);
                            }}
                            variant="outline"
                            className="w-full"
                        >
                            ▲ Show Less
                        </Button>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
