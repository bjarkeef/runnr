/**
 * Open-Meteo Historical Weather — free, no API key for reasonable use.
 * https://open-meteo.com/en/docs/historical-weather-api
 */

export interface WeatherSnapshot {
  tempC: number | null;
  weatherCode: number | null;
  precipMm: number | null;
  windKmh: number | null;
}

export async function fetchHistoricalWeather(
  lat: number,
  lng: number,
  when: Date
): Promise<WeatherSnapshot | null> {
  try {
    const date = when.toISOString().slice(0, 10);
    const hour = when.getUTCHours();
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      start_date: date,
      end_date: date,
      hourly: 'temperature_2m,precipitation,weather_code,wind_speed_10m',
      timezone: 'UTC',
    });

    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`, {
      // allow caching at edge/CDN level if present
      next: { revalidate: 86400 },
    } as RequestInit);

    if (!res.ok) {
      console.warn('[Weather] Open-Meteo error', res.status);
      return null;
    }

    const data = await res.json();
    const temps: number[] = data?.hourly?.temperature_2m ?? [];
    const precips: number[] = data?.hourly?.precipitation ?? [];
    const codes: number[] = data?.hourly?.weather_code ?? [];
    const winds: number[] = data?.hourly?.wind_speed_10m ?? [];

    const idx = Math.min(Math.max(hour, 0), Math.max(temps.length - 1, 0));

    return {
      tempC: temps[idx] ?? null,
      precipMm: precips[idx] ?? null,
      weatherCode: codes[idx] ?? null,
      windKmh: winds[idx] ?? null,
    };
  } catch (e) {
    console.warn('[Weather] fetch failed', e);
    return null;
  }
}
