import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ==================== TIME FORMATTING ====================

/**
 * Format seconds to HH:MM:SS or MM:SS
 * @param seconds - Total seconds
 * @returns Formatted time string
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format race time from total minutes to HH:MM:SS or MM:SS
 * @param totalMinutes - Total race time in minutes
 * @returns Formatted time string
 */
export function formatRaceTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  const seconds = Math.round((totalMinutes % 1) * 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format time for chart display (minutes)
 * @param minutes - Time in minutes (can be null)
 * @returns Rounded minutes or null
 */
export function formatTimeForChart(minutes: number | null): number | null {
  if (!minutes || minutes <= 0) return null;
  return Math.round(minutes * 10) / 10; // Round to 1 decimal
}

/**
 * Format time display from minutes (HH:MM:SS)
 * @param minutes - Time in minutes
 * @returns Formatted time string
 */
export function formatTimeDisplay(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  const seconds = Math.round((minutes % 1) * 60);
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${mins}:${seconds.toString().padStart(2, '0')}`;
}

// ==================== DISTANCE FORMATTING ====================

/**
 * Format meters to kilometers with decimal
 * @param meters - Distance in meters
 * @returns Formatted distance string (e.g., "5.2 km")
 */
export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(2)} km`;
}

// ==================== PACE FORMATTING ====================

/**
 * Format pace in min/km from meters per second
 * @param metersPerSecond - Speed in m/s
 * @returns Formatted pace string (e.g., "5:23 min/km")
 */
export function formatPace(metersPerSecond: number): string {
  const paceMinPerKm = (1000 / metersPerSecond) / 60;
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
}

/**
 * Format pace from min/km value
 * @param paceMinPerKm - Pace in minutes per kilometer
 * @returns Formatted pace string (e.g., "5:23 min/km")
 */
export function formatPaceFromMinKm(paceMinPerKm: number): string {
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
}

/**
 * Format pace range for training zones
 * @param min - Minimum pace (min/km)
 * @param max - Maximum pace (min/km)
 * @returns Formatted pace range (e.g., "5:00-5:30/km")
 */
export function formatPaceRange(min: number, max: number): string {
  const formatSingle = (pace: number) => {
    const mins = Math.floor(pace);
    const secs = Math.round((pace % 1) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  return `${formatSingle(min)}-${formatSingle(max)}/km`;
}
