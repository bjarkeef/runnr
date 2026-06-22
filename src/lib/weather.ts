/**
 * Weather helpers: Open-Meteo fetch + WMO code presentation.
 * Historical weather is cached on Activity rows (weather* fields).
 */

export interface WeatherSnapshot {
  tempC: number | null;
  weatherCode: number | null;
  precipMm: number | null;
  windKmh: number | null;
}

export interface ActivityWeather extends WeatherSnapshot {
  /** Human label from WMO code, e.g. "Light rain" */
  condition: string;
  /** Short emoji/glyph for UI */
  icon: string;
  /** How conditions felt at that temp (rough bands) */
  feelsLike: string | null;
  /** One-line runner summary, e.g. "Cool · slight rain" */
  summary?: string | null;
  /** Precipitation band label */
  precipLabel?: string | null;
  /** Wind band label */
  windLabel?: string | null;
  /** Source timestamp when we fetched/cached */
  fetchedAt?: string | null;
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

/** WMO Weather interpretation codes (Open-Meteo / ECMWF) */
export function weatherConditionFromCode(code: number | null | undefined): {
  condition: string;
  icon: string;
} {
  if (code == null) return { condition: 'Unknown', icon: '🌡' };

  if (code === 0) return { condition: 'Clear sky', icon: '☀️' };
  if (code === 1) return { condition: 'Mainly clear', icon: '🌤' };
  if (code === 2) return { condition: 'Partly cloudy', icon: '⛅' };
  if (code === 3) return { condition: 'Overcast', icon: '☁️' };
  if (code === 45 || code === 48) return { condition: 'Fog', icon: '🌫' };
  if (code === 51) return { condition: 'Light drizzle', icon: '🌦' };
  if (code === 53) return { condition: 'Moderate drizzle', icon: '🌦' };
  if (code === 55) return { condition: 'Dense drizzle', icon: '🌧' };
  if (code === 56 || code === 57) return { condition: 'Freezing drizzle', icon: '🧊' };
  if (code === 61) return { condition: 'Slight rain', icon: '🌧' };
  if (code === 63) return { condition: 'Moderate rain', icon: '🌧' };
  if (code === 65) return { condition: 'Heavy rain', icon: '🌧' };
  if (code === 66 || code === 67) return { condition: 'Freezing rain', icon: '🧊' };
  if (code === 71) return { condition: 'Slight snow', icon: '🌨' };
  if (code === 73) return { condition: 'Moderate snow', icon: '❄️' };
  if (code === 75) return { condition: 'Heavy snow', icon: '❄️' };
  if (code === 77) return { condition: 'Snow grains', icon: '🌨' };
  if (code === 80) return { condition: 'Slight rain showers', icon: '🌦' };
  if (code === 81) return { condition: 'Moderate rain showers', icon: '🌧' };
  if (code === 82) return { condition: 'Violent rain showers', icon: '⛈' };
  if (code === 85) return { condition: 'Slight snow showers', icon: '🌨' };
  if (code === 86) return { condition: 'Heavy snow showers', icon: '❄️' };
  if (code === 95) return { condition: 'Thunderstorm', icon: '⛈' };
  if (code === 96 || code === 99) return { condition: 'Thunderstorm with hail', icon: '⛈' };

  return { condition: `Conditions (code ${code})`, icon: '🌡' };
}

export function feelsLikeFromTemp(tempC: number | null | undefined): string | null {
  if (tempC == null || !Number.isFinite(tempC)) return null;
  if (tempC < -5) return 'Bitter cold';
  if (tempC < 0) return 'Freezing';
  if (tempC < 5) return 'Very cold';
  if (tempC < 10) return 'Cold';
  if (tempC < 15) return 'Cool';
  if (tempC < 20) return 'Mild';
  if (tempC < 25) return 'Warm';
  if (tempC < 30) return 'Hot';
  return 'Very hot';
}

export function windDescription(windKmh: number | null | undefined): string | null {
  if (windKmh == null || !Number.isFinite(windKmh)) return null;
  if (windKmh < 5) return 'Calm';
  if (windKmh < 15) return 'Light breeze';
  if (windKmh < 25) return 'Moderate wind';
  if (windKmh < 40) return 'Strong wind';
  return 'Very windy';
}

export function precipDescription(precipMm: number | null | undefined): string | null {
  if (precipMm == null || !Number.isFinite(precipMm)) return null;
  if (precipMm < 0.1) return 'Dry';
  if (precipMm < 1) return 'Trace / light';
  if (precipMm < 3) return 'Light';
  if (precipMm < 8) return 'Moderate';
  return 'Heavy';
}

/** Short runner-friendly summary line, e.g. "Cool and rainy" */
export function weatherSummaryLine(snap: WeatherSnapshot): string | null {
  const parts: string[] = [];
  if (snap.tempC != null) {
    const feel = feelsLikeFromTemp(snap.tempC);
    if (feel) parts.push(feel.toLowerCase());
  }
  const { condition } = weatherConditionFromCode(snap.weatherCode);
  if (condition && condition !== 'Unknown') {
    parts.push(condition.toLowerCase());
  } else if (snap.precipMm != null && snap.precipMm >= 0.5) {
    parts.push('wet');
  }
  if (snap.windKmh != null && snap.windKmh >= 25) {
    parts.push('windy');
  }
  if (!parts.length) return null;
  // "cool" + "slight rain" → "Cool and slight rain"
  const [first, ...rest] = parts;
  if (!rest.length) return first.charAt(0).toUpperCase() + first.slice(1);
  return `${first.charAt(0).toUpperCase() + first.slice(1)} · ${rest.join(' · ')}`;
}

export function enrichWeatherSnapshot(
  snap: WeatherSnapshot,
  fetchedAt?: Date | string | null
): ActivityWeather {
  const { condition, icon } = weatherConditionFromCode(snap.weatherCode);
  return {
    ...snap,
    condition,
    icon,
    feelsLike: feelsLikeFromTemp(snap.tempC),
    summary: weatherSummaryLine(snap),
    precipLabel: precipDescription(snap.precipMm),
    windLabel: windDescription(snap.windKmh),
    fetchedAt: fetchedAt
      ? typeof fetchedAt === 'string'
        ? fetchedAt
        : fetchedAt.toISOString()
      : null,
  };
}

export function parseLatLng(raw: unknown): [number, number] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const lat = Number(raw[0]);
  const lng = Number(raw[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}
