# Gear Narrative — Design Spec

**Date:** 2026-06-22  
**Status:** Draft for review  
**Branch context:** `refactor/centralize-strava-api`  
**Scope:** Full feature foundation (schema, derivation, weather, API, list + detail UI)

---

## 1. Problem & Opportunity

The current gear page (`/gear`) reduces each shoe to **distance + lifespan progress bar** (0–600–800–1000 km). That answers "how worn is it?" but not "how did I use it?" — pace personality, terrain load, seasons, weather, milestones, and memorable runs.

**Opportunity:** Treat each piece of gear as a **character with a journey** — memoir + personality + adventure map — while staying on Strava's free API tier and data we already sync.

---

## 2. Goals & Non-Goals

### Goals

- Give each shoe a **narrative view** that goes well beyond a progress bar.
- Blend three tones: **personality** (archetype + traits), **memoir** (chapters + milestones), **journey** (interactive life path).
- Leverage **existing synced activities** (`gearId`, pace, elevation, dates, lat/lng) plus **Open-Meteo** for real weather.
- Ship a **production-shaped foundation**: schema, rebuild pipeline, APIs, list upgrade, detail page.
- Let users choose **archetype naming tone**: whimsical vs simple/serious (user setting).
- **No two shoes for the same user share the same nickname** (display archetype title), in either tone.

### Non-Goals (v1)

- LLM-generated prose (templates + rules only; LLM optional later).
- Non-shoe gear narratives (bikes etc.) — model is gear-generic but UI prioritizes shoes.
- Manual user editing of chapters/traits (read-only derived narrative).
- Surface type from Strava (road/trail) — not available reliably; terrain is elevation-derived.
- Paid Strava endpoints or new OAuth scopes.

---

## 3. Product Concept

### 3.1 Name & framing

**Shoe Story** (internal: Gear Narrative). Open a shoe and meet it as a character with a past, not a metric.

### 3.2 Three narrative layers

| Layer | Feeling | UI |
|--------|---------|-----|
| **Personality** | Who is this shoe? | Archetype title, tagline, trait chips |
| **Memoir** | What have we been through? | Chapters + milestones with template prose |
| **Journey** | How did we get here? | Interactive life-path ribbon; tap segments to explore |

Mileage/lifespan remains a **footer ribbon**, not the hero.

### 3.3 Signature interaction: life path ribbon

Horizontal/scrollable (or scrubbable) ribbon divided into segments (default: by calendar month; fallback: 25 km bins if few months).

- **Segment color** — dominant pace bucket (cool = easy, warm = tempo/race).
- **Segment height / texture** — terrain intensity (flat → mountain).
- **Glyph** — dominant weather class (sun, rain, snow, wind, thermometer).
- **Interaction** — scrub/select segment updates a storyteller panel (chapter-style summary + run count + km + links to highlight runs).

Respect `prefers-reduced-motion`: static segments, no entrance choreography.

### 3.4 Archetype tone (user setting)

Users pick how personality names are written. **Derivation logic (traits, buckets, chapters) is identical**; only labels/copy dictionaries differ.

| Tone key | Label in Settings | Example archetype | Example trait |
|----------|-------------------|-------------------|---------------|
| `whimsical` | Whimsical | "Mud Goblin", "Dawn Whisperer", "The PR Goblin" | "Puddle collector", "Hill goat" |
| `serious` | Simple / serious | "Tempo Specialist", "Hill Runner", "Early Runner" | "Frequent tempo work", "High elevation share" |

**Default:** `whimsical` (matches playful product direction; easy to flip).

**Storage:** `User.gearNarrativeTone` (`String`, values `"whimsical"` | `"serious"`, default `"whimsical"`).

**When tone changes:**
1. Persist preference on `User`.
2. Re-run label/tagline/trait **mapping only** (cheap: no weather refetch). Either:
   - Store **canonical trait/archetype keys** in `GearNarrative` and resolve labels at read time by tone, **or**
   - Rebuild narrative copy fields on setting change.
3. **Preferred approach:** store **canonical keys** (`archetypeKey`, `nicknameKey`, `traitKeys[]`) plus tone-agnostic numeric buckets; resolve display strings via `archetypes.ts` / `copy.ts` at API/read time. This avoids full rebuild on tone flip and keeps both tones always available.

**Nickname uniqueness (hard requirement):** Within one user, no two pieces of gear may resolve to the same **nickname** (the primary archetype/display title shown on cards and hero). Uniqueness is enforced on the **canonical `nicknameKey`** during rebuild (so it holds for both tones). See §6.2.1.

Chapters and milestones use tone-specific **sentence templates** from the same key (e.g. chapter key `wet_season` → whimsical vs serious prose).

### 3.5 List page vs detail

- **`/gear`** — Keep summary stats. Each shoe card gains: **unique nickname** (resolved for user tone), one-line tagline, mini life-path preview, run count. Click → detail.
- **`/gear/[id]`** — Full narrative view (hero of the feature).
- Existing lifespan progress bar moves to detail footer and a small indicator on cards.

### 3.6 Aesthetic direction

Trail-journal meets running log: warm paper/ink neutrals, single accent (trail-marker orange or dawn violet), display type for archetype titles, utility/mono for km stats. Signature element = **life path ribbon**, not another stat grid.

---

## 4. Strava Free API — Feasibility

### 4.1 What we already have (no new scopes)

Current scope: `read,activity:read_all` — sufficient.

| Data | Source in Runnr | Narrative use |
|------|-----------------|---------------|
| `gear_id` | `Activity.gearId` | Join runs to shoes |
| Distance, moving time, avg/max speed | `Activity` | Pace buckets (relative to shoe history) |
| Elevation gain | `Activity.totalElevationGain` | Terrain proxy (m/km) |
| Start dates (UTC + local) | `Activity` | Chapters, seasons, time-of-day |
| HR (optional) | `Activity` | Effort nuance when present |
| Start lat/lng | `Activity.startLatlng` | Weather lookup |
| Workout type | `Activity.workoutType` | Race / structured workout hints |
| Gear identity + total distance | `Gear` via Strava gear/athlete | Header + lifespan |

### 4.2 What Strava does **not** provide

- Weather / conditions
- Official terrain or surface (road/trail/track)
- Shoe photos
- Indoor/treadmill always reliable

### 4.3 How we fill gaps without Strava

1. **Weather** — Open-Meteo Historical Weather API (free, no key for reasonable non-commercial use): temperature, precipitation, WMO weather code, wind at activity start time + lat/lng. Cache on `Activity` once fetched.
2. **Terrain** — derive from elevation gain per km.
3. **Pace personality** — derive from speed vs **this shoe's own** pace distribution (percentiles), not absolute pace.
4. **Copy** — template engine + thresholds keyed by tone (`whimsical` | `serious`).

### 4.4 Rate limits & discipline

- Narrative uses **Postgres activities only** — never live-scan all Strava history for the story page.
- Weather backfill is **incremental** (e.g. up to N missing activities per rebuild pass).
- Full narrative recompute runs at end of **`sync-runs`** (and optional force rebuild endpoint), not on every page view.
- Tone changes do **not** require Strava or Open-Meteo calls.

---

## 5. Data Model

### 5.1 Extend `User` — narrative preference

```prisma
// on User
gearNarrativeTone String @default("whimsical") // "whimsical" | "serious"
```

Settings UI: toggle or segmented control under a "Gear stories" section on `/settings`.

Settings API: include `gearNarrativeTone` in GET; accept PATCH/PUT to update (follow existing settings route patterns; add write if missing).

### 5.2 Extend `Activity` — weather cache

```prisma
// additions on Activity
weatherTempC     Float?
weatherCode      Int?      // WMO code from Open-Meteo
weatherPrecipMm  Float?
weatherWindKmh   Float?
weatherFetchedAt DateTime?
```

Skip fetch when `startLatlng` is null. On fetch failure, leave null and retry later.

### 5.3 New `GearNarrative` — materialized story

```prisma
model GearNarrative {
  id              String   @id @default(cuid())
  gearId          String   @unique
  userId          String

  // Canonical identity (tone-agnostic keys; labels resolved at read time)
  archetypeKey    String   // primary signal key, e.g. "speedster", "hill_goat"
  nicknameKey     String   // unique-per-user key used for display title; may equal archetypeKey or a disambiguated variant
  traitKeys       Json     // string[] canonical keys
  firstRunAt      DateTime?
  lastRunAt       DateTime?
  runCount        Int      @default(0)
  totalDistanceM  Float    @default(0)

  // Distributions (tone-agnostic numbers for charts + path)
  paceBuckets     Json     // { easyKm, steadyKm, tempoKm, raceKm }
  terrainBuckets  Json     // { flatKm, rollingKm, hillyKm, mountainKm }
  weatherBuckets  Json     // { clearKm, rainKm, snowKm, coldKm, hotKm, windyKm }
  timeBuckets     Json     // { dawnKm, dayKm, duskKm, nightKm }
  seasonBuckets   Json     // { springKm, summerKm, autumnKm, winterKm }

  // Journey / memoir structure (keys + metrics; prose resolved at read time)
  chapters        Json     // GearChapterStored[]
  milestones      Json     // GearMilestoneStored[]
  highlights      Json     // highlight refs: fastest, longest, hilliest, wettest, coldest, hottest
  lifePath        Json     // GearLifePathSegment[]

  version         Int      @default(1)  // bump when derivation rules change
  computedAt      DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  gear Gear @relation(fields: [gearId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, nicknameKey]) // no two shoes share the same nickname key (hence display name per tone)
  @@index([userId])
}
```

**Relation updates:**
- `User.gearNarratives GearNarrative[]`
- `Gear.narrative GearNarrative?`

### 5.4 Stored vs resolved shapes

**Stored chapter (example):**

```ts
type GearChapterStored = {
  key: string;           // "origin", "peak_month", "wet_season", "final_stretch"
  startDate?: string;
  endDate?: string;
  distanceM: number;
  runCount: number;
  metrics?: Record<string, number>; // e.g. rainShare: 0.18
};
```

**API-resolved chapter (example):**

```ts
type GearChapterView = GearChapterStored & {
  title: string;
  body: string;  // tone-specific
};
```

**Stored life path segment:**

```ts
type GearLifePathSegment = {
  id: string;
  label: string;           // "Mar 2025" or "0–25 km"
  startDate: string;
  endDate: string;
  distanceM: number;
  runCount: number;
  dominantPace: 'easy' | 'steady' | 'tempo' | 'race';
  dominantTerrain: 'flat' | 'rolling' | 'hilly' | 'mountain';
  dominantWeather: 'clear' | 'rain' | 'snow' | 'cold' | 'hot' | 'windy' | 'unknown';
  activityIds?: string[];  // internal/cuid or strava ids as available
};
```

**Highlights:**

```ts
type GearHighlights = {
  fastestActivityId?: string;
  fastestSpeed?: number;
  longestActivityId?: string;
  longestDistanceM?: number;
  hilliestActivityId?: string;
  maxElevM?: number;
  wettestActivityId?: string;
  maxPrecipMm?: number;
  coldestActivityId?: string;
  minTempC?: number;
  hottestActivityId?: string;
  maxTempC?: number;
};
```

---

## 6. Derivation Rules

Module home: `src/lib/gear-narrative/` (`derive.ts`, `archetypes.ts`, `copy.ts`, `chapters.ts`, `weather.ts`, `rebuild.ts`, `types.ts`).

### 6.1 Per-run classifications

**Pace bucket (relative to this shoe):**
- Build distribution of average pace (or speed) across shoe's runs.
- `easy`: below ~P40 of shoe paces
- `steady`: P40–P70
- `tempo`: P70–P90
- `race`: above P90 **or** Strava workout type indicates race when available

**Terrain class** (elev_m / distance_km):
- `flat`: < 15 m/km
- `rolling`: 15–30
- `hilly`: 30–50
- `mountain`: > 50

**Time of day** (local hour from `startDateLocal`):
- `dawn`: 05–08
- `day`: 08–17
- `dusk`: 17–20
- `night`: otherwise

**Season** (local month; Northern Hemisphere default in v1):
- spring: Mar–May, summer: Jun–Aug, autumn: Sep–Nov, winter: Dec–Feb

**Weather class** (from cached Open-Meteo; multi-label possible, dominant stored on segments):
- `clear` — low precip, moderate temp, not high wind
- `rain` — precip above threshold or rain weather codes
- `snow` — snow codes / freezing precip
- `cold` — temp < 5°C
- `hot` — temp > 25°C
- `windy` — wind > 30 km/h
- `unknown` — no weather cache

### 6.2 Archetype keys (canonical)

Selection is **rules over bucket shares**, not tone. Examples:

| Key | Signal (illustrative thresholds) |
|-----|----------------------------------|
| `speedster` | High tempo+race share |
| `steady_companion` | High easy+steady share, balanced terrain |
| `hill_goat` | High hilly+mountain km share |
| `dawn_companion` | High dawn share |
| `storm_chaser` | High rain/snow/wind share |
| `all_rounder` | No dominant signal (fallback) |
| `weekend_warrior` | Distance concentrated on weekends (optional if easy to derive) |
| `long_haul` | High average run distance / long-run skew |

Pick highest-scoring archetype into `archetypeKey`; ties → `all_rounder` or first match by priority list.

**Trait keys:** collect all signals over minimum thresholds (cap 5), e.g. `frequent_tempo`, `rain_lover`, `elevation_heavy`, `night_owl`, `summer_shoe`, `race_day_favorite`.

#### 6.2.1 Unique nicknames per user (hard requirement)

**Invariant:** For a given `userId`, every `GearNarrative.nicknameKey` is unique. Because display nicknames are a pure function of `(nicknameKey, tone)`, this guarantees **no two shoes show the same nickname** in whimsical mode *or* serious mode.

**Why a separate `nicknameKey`:** Two shoes may honestly share the same primary `archetypeKey` (both are speedsters). The **nickname** is the public character name and must still differ.

**Assignment algorithm** (runs once per full user rebuild, after scoring every gear):

1. For each gear, compute ranked candidate keys: `[primaryArchetypeKey, ...runnerUpArchetypeKeys, ...traitBasedFallbackKeys, "all_rounder"]` (deduped, highest score first).
2. Sort gear deterministically for assignment priority (recommended): **higher total distance first**, then **more recent `lastRunAt`**, then `gearId` lexicographic — so the most-used shoe keeps the “pure” title when there is a clash.
3. Walk gear in that order; assign each the **first candidate key not yet taken** in a `Set<nicknameKey>` for this user.
4. If all candidates are taken, append a disambiguator suffix using a **fixed pool of alternate keys** that still have tone copy, not free-form numbers in the UI when avoidable:
   - First try unused keys from the full archetype catalog (even if weakly scoring).
   - Then try numbered variant keys only as last resort: `{base}_ii`, `{base}_iii` (roman-style), each with tone copy like whimsical `"The PR Goblin II"` / serious `"Tempo Specialist II"`.
5. Persist `archetypeKey` (true primary signal) and `nicknameKey` (unique display key) separately so analytics/debug still know the real personality even when the title was disambiguated.
6. Enforce at DB level with `@@unique([userId, nicknameKey])`. On unique violation during upsert, re-run assignment for that user only (should be rare if algorithm is correct).

**Tone change:** Does not reassign keys; only labels change. Uniqueness is preserved because both tone dictionaries must map **each `nicknameKey` to a distinct display string** within that tone (no two keys may share a display label in the same tone dictionary — lint/test this in `copy.ts`).

**Retired shoes:** Still participate in uniqueness (a retired “Mud Goblin” blocks an active shoe from also being “Mud Goblin”) unless we later add a product rule to free names on retirement; **v1 keeps uniqueness across active + retired** so the memoir shelf stays coherent.

**API field:** Resolved views expose `nickname` (tone string) as the hero/card title; `archetypeKey` remains available for debugging; do not show two shoes with equal `nickname` in list/detail.

### 6.3 Tone dictionaries

`copy.ts` / `archetypes.ts` map keys → display strings for each tone. Dictionaries must include every base key **and** disambiguator suffixes (`speedster_ii`, etc.).

**Archetype / nickname examples (base keys):**

| Key | Whimsical | Serious |
|-----|-----------|---------|
| `speedster` | The PR Goblin | Tempo Specialist |
| `hill_goat` | Hill Goat | Hill Runner |
| `dawn_companion` | Dawn Whisperer | Early Runner |
| `storm_chaser` | Mud Goblin | All-Weather Runner |
| `steady_companion` | Trusty Sidekick | Steady Companion |
| `all_rounder` | Jack of All Trails | All-Rounder |
| `long_haul` | Odyssey Engine | Long-Distance Shoe |
| `speedster_ii` | The PR Goblin II | Tempo Specialist II |

**Invariant (copy layer):** Within each tone map, all values are unique (no two keys render the same nickname string). Covered by unit test.

**Tagline:** one short sentence from `nicknameKey` (or `archetypeKey` if preferred for accuracy) + top trait + total km (tone templates). Prefer `nicknameKey` for consistency with the hero title.

**Chapter/milestone prose:** separate template tables per tone; same metrics interpolated.

### 6.4 Chapters (keys)

Always attempt when data exists:

1. `origin` — first run + first ~50 km era
2. `peak_month` — month with highest km in this shoe
3. `wet_season` — if rain/snow share notable
4. `speed_chapter` — if tempo/race share notable
5. `climb_chapter` — if hilly/mountain share notable
6. `final_stretch` — if distance in danger/replace zone (≥800 km) or retired

Cap displayed chapters at 4 (priority order if more qualify).

### 6.5 Milestones

Emit when crossed (by chronological scan of runs):

- First run
- 100 / 250 / 500 / 750 / 1000 km
- First race (if detectable)
- First rain / first sub-zero (if weather present)
- Retirement (if `Gear.retired`)

### 6.6 Life path segments

1. Group activities by calendar month (preferred).
2. If total span < 2 months, group by 25 km cumulative bins.
3. Per segment: sum distance, count runs, compute dominant pace/terrain/weather.

### 6.7 Rebuild pipeline

`rebuildGearNarratives(userId)`:

1. Load user + all gear + activities with `gearId` set (runs only).
2. For activities missing weather + having lat/lng: call Open-Meteo (batched/limited per run).
3. Per gear: classify runs, build buckets, primary `archetypeKey`, trait keys, chapters, milestones, highlights, life path (do not finalize nickname yet).
4. **Assign unique `nicknameKey` across all of this user's gear** (§6.2.1), using ranked candidates + deterministic priority sort.
5. Upsert each `GearNarrative` (`version` constant in code; if code version > stored, full recompute). On `@@unique([userId, nicknameKey])` failure, re-assign nicknames and retry once.

**Triggers:**
- End of successful `/api/sync-runs`
- Optional `POST /api/gear/rebuild` for current user
- First visit to gear narrative endpoint if narrative missing/stale (lazy rebuild fallback)

**Stale definition:** `version` mismatch or `computedAt` older than last activity `updatedAt` for that gear's runs.

---

## 7. Weather Integration (Open-Meteo)

**Provider:** Open-Meteo Historical Weather API (open data; free tier suitable for personal app scale).

**Request sketch:** hourly archive at lat/lng for activity date; pick hour nearest activity start; read `temperature_2m`, `precipitation`, `weather_code`, `wind_speed_10m`.

**Persistence:** write to `Activity` weather fields + `weatherFetchedAt`.

**Failure:** non-fatal; narrative still builds on pace/terrain/time/season.

**Privacy:** only uses coordinates already stored from Strava activities; no new location collection.

---

## 8. API Surface

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/gear` | GET | Existing shoes list; extend each shoe with `narrativeSummary` (tone-resolved): `nickname` (unique display title), `tagline`, `topTrait`, `runCount`, optional mini `lifePath`; include `archetypeKey` / `nicknameKey` for clients that need them |
| `/api/gear/[id]/narrative` | GET | Full tone-resolved narrative + gear metadata + lifespan health object; hero title = `nickname` |
| `/api/gear/rebuild` | POST | Force recompute for authenticated user |
| `/api/settings` | GET/PATCH | Expose and update `gearNarrativeTone` |

**Response principle:** API returns **display-ready** strings for the user's current tone; also include `archetypeKey` / `traitKeys` for debugging/future filters.

**Auth:** same as existing gear/settings (stored Strava session / `getAuthenticatedUser`).

**Caching:** list endpoint may keep short private cache; narrative endpoint should vary by user tone (no shared cache key across tones).

---

## 9. UI Specification

### 9.1 Settings

New control: **Gear story tone**

- Segmented: **Whimsical** | **Simple / serious**
- Helper text: "Changes how shoe personalities and chapters are named. Your data and stats stay the same."
- Saving updates preference immediately; gear pages reflect on next fetch (no full data rebuild required).

### 9.2 `/gear` list

- Header unchanged in spirit; subtitle can mention stories ("Distance, lifespan, and each shoe's journey").
- Cards: name, primary/retired badges, **nickname badge** (unique among user's shoes), **tagline**, mini life-path (non-interactive or lightly interactive), km + lifespan bar compact, "Need attention" styling preserved.
- Empty states: no shoes / shoes with zero tagged activities ("Tag shoes on runs in Strava to build their story").

### 9.3 `/gear/[id]` detail

Sections top to bottom:

1. **Back** to `/gear`
2. **Hero** — name, brand/model, **nickname** (large, unique among user's shoes), tagline, trait chips, run count + date range
3. **Life path** — full interactive ribbon + selected segment panel
4. **Memoir** — chapter cards (tone-specific titles/bodies)
5. **Usage mosaic** — pace / terrain / weather / time-of-day; tap may filter/highlight life path segments (progressive enhancement; v1 can be display-only with hover stats)
6. **Highlights** — fastest, longest, hilliest, wettest, coldest, hottest (link to `/run/[id]` when id available)
7. **Milestones** — horizontal stamps or vertical mini-timeline
8. **Lifespan footer** — existing health logic (600/800/1000 km) reframed narratively

### 9.4 Accessibility

- Life path segments keyboard-focusable; selection via arrows/enter.
- Weather/pace not conveyed by color alone (labels/icons + text).
- Reduced motion supported.

---

## 10. Architecture Summary

```
sync-runs (existing)
  → upsert Activity + Gear
  → rebuildGearNarratives(userId)
       → weather backfill (Open-Meteo → Activity)
       → derive canonical narrative → GearNarrative

settings: gearNarrativeTone on User

GET /api/gear / GET /api/gear/[id]/narrative
  → load Gear + GearNarrative + User.tone
  → resolve keys → display copy via tone dictionaries
  → return JSON for UI

/gear, /gear/[id], /settings
  → client views
```

Centralized Strava access remains in `src/lib/strava.ts` (no direct Strava calls for narrative beyond what sync already did). Weather is a separate small client in `gear-narrative/weather.ts`.

---

## 11. Implementation Phases

1. **Schema migration** — `User.gearNarrativeTone`, `Activity` weather fields, `GearNarrative` model + relations.
2. **Derivation library** — classifications, archetype/trait keys, **unique nickname assignment**, chapters, milestones, life path (unit tested with fixtures).
3. **Copy dictionaries** — whimsical + serious maps for archetypes/nicknames (including `_ii` / `_iii` variants), traits, chapters, milestones, taglines; enforce unique labels within each tone.
4. **Weather client** — Open-Meteo + Activity persistence.
5. **Rebuild orchestration** — hook into `sync-runs`; optional rebuild route; lazy rebuild if missing.
6. **Settings** — read/write tone; UI control.
7. **API** — extend gear list; add narrative endpoint (tone resolution in one place, e.g. `resolveNarrativeView(narrative, tone)`).
8. **UI** — `/gear` card upgrade; `/gear/[id]` narrative page; lifespan footer reuse.
9. **Polish** — empty/error states, reduced motion, basic loading skeletons.

---

## 12. Testing Strategy

- **Unit:** pace/terrain/time/season/weather classification; archetype key selection; **nickname uniqueness across multi-shoe fixtures (including two shoes with same primary archetype)**; chapter/milestone emission; tone resolution produces different labels for same keys; **copy maps have no duplicate display strings within a tone**.
- **Integration:** rebuild with mocked Open-Meteo and fixture activities; settings tone change flips labels without rebuild.
- **Manual:** real account after sync — shoe with many runs, shoe with no `gearId` on activities, shoe missing lat/lng (no weather), retired shoe.

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Many activities slow rebuild | Incremental weather; efficient SQL; optional per-gear rebuild; store materialized narrative |
| Open-Meteo limits/outages | Non-fatal; retry next rebuild; narrative works without weather |
| Activities not tagged with gear in Strava | Clear empty state; only narrate tagged distance |
| Archetype feels wrong | User tone setting; rules are tunable via `version` bump; keys allow future refinement without UI rewrite |
| Two shoes want same nickname | §6.2.1 assignment + `@@unique([userId, nicknameKey])`; runner-up keys then `II`/`III` variants |
| Hemisphere/season wrong for some users | Document NH default; future setting if needed |
| Narrative drift from live distance | Rebuild after sync; show `computedAt` subtly if useful |

---

## 14. Open Decisions (resolved in this spec)

| Topic | Decision |
|-------|----------|
| Approach | Materialized `GearNarrative` + weather cache on `Activity` |
| Signature UI | Interactive life path ribbon |
| Weather | Open-Meteo (free/open historical API), not season-only |
| Archetype tone | **User setting** `whimsical` \| `serious`; canonical keys stored; labels at read time |
| Nickname uniqueness | **Hard requirement** — unique `nicknameKey` per user (DB + assignment algorithm); display nicknames unique in both tones |
| Scope depth | Full feature foundation |
| Emotional mix | Personality + memoir + journey |

---

## 15. Success Criteria

- Opening a shoe with tagged runs shows **nickname**, traits, life path, chapters, and highlights derived from real data.
- **No two shoes for the same user share a nickname** (list + detail), in either tone; primary `archetypeKey` may still match when personalities are similar.
- Switching tone in settings changes names/prose without re-fetching Strava or weather; uniqueness still holds after the switch.
- Gear list shows at-a-glance personality, not only km bars.
- Works entirely on existing Strava scopes + Open-Meteo + local derivation.
- Lifespan guidance preserved; narrative is additive.

---

## 16. Next Step

After user approval of this written spec: create an implementation plan (`writing-plans`) and implement on a feature branch.
