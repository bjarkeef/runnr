'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { RaceGoal, TrainingPlan } from '@/types/race-predictions';

interface RaceGoalCardProps {
    raceGoal: RaceGoal | null;
    trainingPlan: TrainingPlan | null;
    planLoading: boolean;
    onSetGoal: (goalData: {
        date: string;
        startDate: string;
        distance: '5K' | '10K' | 'Half Marathon' | 'Marathon';
        runsPerWeek: number;
        trainingDays: number[];
        targetTime: string | null;
    }) => Promise<void>;
    onClearGoal: () => Promise<void>;
}

// Calculate actual weeks remaining from today to race date
function getWeeksLeftFromNow(raceDate: string): number {
    const now = new Date();
    const race = new Date(raceDate);
    const diffTime = race.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.ceil(diffDays / 7));
}

export function RaceGoalCard({
    raceGoal,
    trainingPlan,
    planLoading,
    onSetGoal,
    onClearGoal
}: RaceGoalCardProps) {
    const [showGoalForm, setShowGoalForm] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedStartDate, setSelectedStartDate] = useState('');
    const [selectedDistance, setSelectedDistance] = useState<'5K' | '10K' | 'Half Marathon' | 'Marathon'>('10K');
    const [runsPerWeek, setRunsPerWeek] = useState(4);
    const [selectedDays, setSelectedDays] = useState<number[]>([0, 2, 4, 6]);
    const [targetTime, setTargetTime] = useState('');

    // Calculate actual weeks left from current date (not from start date)
    const weeksLeft = useMemo(() => {
        if (!raceGoal?.date) return 0;
        return getWeeksLeftFromNow(raceGoal.date);
    }, [raceGoal?.date]);

    // Initialize form with default values when no race goal exists
    useEffect(() => {
        if (!raceGoal && !showGoalForm) {
            setSelectedDate('');
            setSelectedStartDate(new Date().toISOString().split('T')[0]);
            setSelectedDistance('10K');
            setRunsPerWeek(4);
            setSelectedDays([0, 2, 4, 6]);
            setTargetTime('');
        }
    }, [raceGoal, showGoalForm]);

    // Function to populate form with existing race goal data
    const handleEditClick = () => {
        if (raceGoal) {
            setSelectedDate(raceGoal.date.split('T')[0] || '');
            setSelectedStartDate(raceGoal.startDate?.split('T')[0] || new Date().toISOString().split('T')[0]);
            setSelectedDistance(raceGoal.distance || '10K');
            setRunsPerWeek(raceGoal.runsPerWeek || 4);
            // Use trainingDays from raceGoal if available, otherwise generate from runsPerWeek
            if (raceGoal.trainingDays && Array.isArray(raceGoal.trainingDays)) {
                setSelectedDays(raceGoal.trainingDays);
            } else {
                // Default days based on runsPerWeek
                const defaultDays = generateDefaultDays(raceGoal.runsPerWeek || 4);
                setSelectedDays(defaultDays);
            }
            setTargetTime(raceGoal.targetTime || '');
        }
        setShowGoalForm(true);
    };

    // Generate default training days based on runs per week
    const generateDefaultDays = (runs: number): number[] => {
        switch (runs) {
            case 2: return [2, 6]; // Wed, Sun
            case 3: return [1, 4, 6]; // Tue, Fri, Sun
            case 4: return [0, 2, 4, 6]; // Mon, Wed, Fri, Sun
            case 5: return [0, 1, 3, 4, 6]; // Mon, Tue, Thu, Fri, Sun
            case 6: return [0, 1, 2, 4, 5, 6]; // All except Thu
            case 7: return [0, 1, 2, 3, 4, 5, 6]; // All days
            default: return [0, 2, 4, 6];
        }
    };

    const handleSetGoal = async () => {
        if (!selectedDate) return;
        
        await onSetGoal({
            date: selectedDate,
            startDate: selectedStartDate || new Date().toISOString().split('T')[0],
            distance: selectedDistance,
            runsPerWeek,
            trainingDays: selectedDays,
            targetTime: targetTime || null
        });
        setShowGoalForm(false);
    };

    const toggleDay = (dayIndex: number) => {
        setSelectedDays(prev => {
            let newDays;
            if (prev.includes(dayIndex)) {
                if (prev.length <= 2) return prev;
                newDays = prev.filter(d => d !== dayIndex);
            } else {
                if (prev.length >= 7) return prev;
                newDays = [...prev, dayIndex].sort((a, b) => a - b);
            }
            setRunsPerWeek(newDays.length);
            return newDays;
        });
    };

    return (
        <Card>
            <CardHeader className="pb-3 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <CardTitle className="text-base sm:text-lg">🏁 Race Goal & Training</CardTitle>
                        <CardDescription className="text-xs sm:text-sm mt-1">
                            Set your race goal for a personalized plan
                        </CardDescription>
                    </div>
                    {raceGoal && !showGoalForm && (
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleEditClick}>
                                Edit
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs h-8" onClick={onClearGoal}>
                                Clear
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {!raceGoal || showGoalForm ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium mb-2 block">Training Start Date</label>
                                <Input 
                                    type="date" 
                                    value={selectedStartDate}
                                    onChange={(e) => setSelectedStartDate(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    When your training plan should begin
                                </p>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">Race Date</label>
                                <Input 
                                    type="date" 
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    min={selectedStartDate || new Date().toISOString().split('T')[0]}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Race Distance</label>
                            <select 
                                className="w-full px-3 py-2 rounded-md border border-input bg-background"
                                value={selectedDistance}
                                onChange={(e) => setSelectedDistance(e.target.value as '5K' | '10K' | 'Half Marathon' | 'Marathon')}
                            >
                                <option value="5K">5K</option>
                                <option value="10K">10K</option>
                                <option value="Half Marathon">Half Marathon</option>
                                <option value="Marathon">Marathon</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Runs Per Week</label>
                            <div className="flex items-center gap-2">
                                <select 
                                    className="flex-1 px-3 py-2 rounded-md border border-input bg-background"
                                    value={runsPerWeek}
                                    onChange={(e) => setRunsPerWeek(Number(e.target.value))}
                                >
                                    <option value="2">2 runs/week (Minimal)</option>
                                    <option value="3">3 runs/week (Light)</option>
                                    <option value="4">4 runs/week (Moderate)</option>
                                    <option value="5">5 runs/week (Active)</option>
                                    <option value="6">6 runs/week (Dedicated)</option>
                                    <option value="7">7 runs/week (Elite)</option>
                                </select>
                                {selectedDays.length !== runsPerWeek && (
                                    <span className="text-xs text-orange-600 whitespace-nowrap">
                                        ⚠️ {selectedDays.length} days selected
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Select specific days below (will auto-sync count)
                            </p>
                        </div>
                        
                        <div>
                            <label className="text-sm font-medium mb-2 block">Training Days ({selectedDays.length} selected)</label>
                            <p className="text-xs text-muted-foreground mb-2">Select which days you want to train</p>
                            <div className="grid grid-cols-7 gap-2">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => toggleDay(index)}
                                        className={`px-2 py-2 text-xs font-medium rounded-md transition-colors ${
                                            selectedDays.includes(index)
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                        } ${selectedDays.length >= 7 && !selectedDays.includes(index) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        disabled={selectedDays.length >= 7 && !selectedDays.includes(index)}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                💡 Tip: Spread rest days throughout the week for better recovery
                            </p>
                        </div>
                        
                        <div>
                            <label className="text-sm font-medium mb-2 block">Target Time (Optional)</label>
                            <Input 
                                type="text"
                                placeholder="e.g. 1:45:00 or 45:30"
                                value={targetTime}
                                onChange={(e) => setTargetTime(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Enter your goal time in HH:MM:SS or MM:SS format. Leave blank to use predicted time.
                            </p>
                        </div>
                        
                        <div className="flex gap-2">
                            <Button onClick={handleSetGoal} disabled={!selectedDate}>
                                {raceGoal ? 'Update Goal' : 'Set Goal'}
                            </Button>
                            {showGoalForm && raceGoal && (
                                <Button variant="ghost" onClick={() => setShowGoalForm(false)}>
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {planLoading ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i}>
                                        <Skeleton className="h-3 w-20 mb-2" />
                                        <Skeleton className="h-6 w-16" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                                    <div>
                                        <p className="text-xs sm:text-sm text-muted-foreground">Distance</p>
                                        <p className="text-lg sm:text-xl font-bold">{raceGoal.distance}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs sm:text-sm text-muted-foreground">Race Date</p>
                                        <p className="text-sm sm:text-lg font-bold">
                                            {new Date(raceGoal.date).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit' })}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs sm:text-sm text-muted-foreground">Weeks Left</p>
                                        <p className="text-lg sm:text-xl font-bold text-orange-600">{weeksLeft}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs sm:text-sm text-muted-foreground">Target</p>
                                        <p className="text-sm sm:text-lg font-bold text-green-600">
                                            {raceGoal.targetTime || trainingPlan?.estimatedRaceTime || 'N/A'}
                                        </p>
                                        {raceGoal.targetTime && (
                                            <p className="text-xs text-muted-foreground">Custom goal</p>
                                        )}
                                    </div>
                                </div>
                                {trainingPlan && (
                                    <div className="mt-3 p-3 bg-muted rounded-lg">
                                        <p className="text-xs sm:text-sm font-medium mb-1">Fitness: <span className="text-primary">{trainingPlan.currentFitness}</span></p>
                                        <p className="text-xs text-muted-foreground">Generated: {new Date(trainingPlan.generatedDate).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit' })}</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
