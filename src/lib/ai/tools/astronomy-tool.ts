/**
 * ASTRONOMY CALCULATIONS TOOL
 *
 * Astronomical calculations using astronomy-engine.
 * Runs entirely locally - no external API costs.
 *
 * Features:
 * - Planet positions
 * - Moon phases
 * - Sunrise/sunset
 * - Eclipse predictions
 * - Coordinate transformations
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Astronomy: any = null;

async function initAstronomy(): Promise<boolean> {
  if (Astronomy) return true;
  try {
    const mod = await import('astronomy-engine');
    Astronomy = mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const astronomyTool: UnifiedTool = {
  name: 'astronomy_calc',
  description: `Perform astronomical calculations for celestial mechanics.

Available operations:
- planet_position: Get position of a planet (RA, Dec, distance)
- moon_phase: Current moon phase and illumination
- sun_position: Sun position for a location
- rise_set: Sunrise, sunset, moonrise, moonset times
- season: Equinox and solstice dates
- eclipse_search: Find next solar/lunar eclipse
- constellation: Get constellation for a celestial position
- julian_date: Convert date to Julian date
- angular_separation: Angle between two celestial objects

Bodies: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto

Used in: Astronomy, navigation, satellite tracking, astrophotography planning`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'planet_position',
          'moon_phase',
          'sun_position',
          'rise_set',
          'season',
          'eclipse_search',
          'constellation',
          'julian_date',
          'angular_separation',
        ],
        description: 'Astronomical operation',
      },
      body: {
        type: 'string',
        enum: [
          'Sun',
          'Moon',
          'Mercury',
          'Venus',
          'Mars',
          'Jupiter',
          'Saturn',
          'Uranus',
          'Neptune',
          'Pluto',
        ],
        description: 'Celestial body',
      },
      body2: {
        type: 'string',
        description: 'Second celestial body (for angular_separation)',
      },
      date: {
        type: 'string',
        description: 'Date/time in ISO format (default: now)',
      },
      latitude: {
        type: 'number',
        description: 'Observer latitude in degrees',
      },
      longitude: {
        type: 'number',
        description: 'Observer longitude in degrees',
      },
      elevation: {
        type: 'number',
        description: 'Observer elevation in meters (default: 0)',
      },
      year: {
        type: 'number',
        description: 'Year for season calculations',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isAstronomyAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeAstronomy(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    body?: string;
    body2?: string;
    date?: string;
    latitude?: number;
    longitude?: number;
    elevation?: number;
    year?: number;
  };

  const { operation, body, body2, date, latitude, longitude, elevation = 0, year } = args;

  try {
    const initialized = await initAstronomy();
    if (!initialized) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'Failed to initialize astronomy-engine library' }),
        isError: true,
      };
    }

    const astroDate = date ? Astronomy.MakeTime(new Date(date)) : Astronomy.MakeTime(new Date());
    const result: Record<string, unknown> = { operation, date: astroDate.date.toISOString() };

    switch (operation) {
      case 'planet_position': {
        if (!body) throw new Error('body is required for planet_position');
        const bodyEnum = Astronomy.Body[body];
        if (bodyEnum === undefined) throw new Error(`Unknown body: ${body}`);

        // Get equatorial coordinates
        const equ = Astronomy.Equator(bodyEnum, astroDate, null, true, true);

        // Get ecliptic coordinates
        const ecl = Astronomy.Ecliptic(equ.vec);

        // Get distance
        const geo = Astronomy.GeoVector(bodyEnum, astroDate, true);

        result.body = body;
        result.equatorial = {
          ra_hours: equ.ra,
          ra_degrees: equ.ra * 15,
          dec_degrees: equ.dec,
          distance_au: equ.dist,
        };
        result.ecliptic = {
          longitude: ecl.elon,
          latitude: ecl.elat,
        };
        result.distance = {
          au: geo.dist,
          km: geo.dist * 149597870.7,
          light_minutes: (geo.dist * 499.004783836) / 60,
        };

        // If observer location provided, get altitude/azimuth
        if (latitude !== undefined && longitude !== undefined) {
          const observer = Astronomy.MakeObserver(latitude, longitude, elevation);
          const hor = Astronomy.Horizon(astroDate, observer, equ.ra, equ.dec, 'normal');
          result.horizontal = {
            altitude: hor.altitude,
            azimuth: hor.azimuth,
            is_visible: hor.altitude > 0,
          };
        }
        break;
      }

      case 'moon_phase': {
        const phase = Astronomy.MoonPhase(astroDate);
        const illum = Astronomy.Illumination(Astronomy.Body.Moon, astroDate);

        // Get moon position
        const moonEqu = Astronomy.Equator(Astronomy.Body.Moon, astroDate, null, true, true);

        let phaseName: string;
        if (phase < 22.5) phaseName = 'New Moon';
        else if (phase < 67.5) phaseName = 'Waxing Crescent';
        else if (phase < 112.5) phaseName = 'First Quarter';
        else if (phase < 157.5) phaseName = 'Waxing Gibbous';
        else if (phase < 202.5) phaseName = 'Full Moon';
        else if (phase < 247.5) phaseName = 'Waning Gibbous';
        else if (phase < 292.5) phaseName = 'Last Quarter';
        else if (phase < 337.5) phaseName = 'Waning Crescent';
        else phaseName = 'New Moon';

        result.phase_angle = phase;
        result.phase_name = phaseName;
        result.illumination_fraction = illum.phase_fraction;
        result.illumination_percent = illum.phase_fraction * 100;
        result.position = {
          ra_hours: moonEqu.ra,
          dec_degrees: moonEqu.dec,
          distance_km: moonEqu.dist * 149597870.7,
        };

        // Find next major phases
        const nextNewMoon = Astronomy.SearchMoonPhase(0, astroDate, 30);
        const nextFullMoon = Astronomy.SearchMoonPhase(180, astroDate, 30);
        result.next_new_moon = nextNewMoon ? nextNewMoon.date.toISOString() : null;
        result.next_full_moon = nextFullMoon ? nextFullMoon.date.toISOString() : null;
        break;
      }

      case 'sun_position': {
        const sunEqu = Astronomy.Equator(Astronomy.Body.Sun, astroDate, null, true, true);
        const sunEcl = Astronomy.SunPosition(astroDate);

        result.equatorial = {
          ra_hours: sunEqu.ra,
          ra_degrees: sunEqu.ra * 15,
          dec_degrees: sunEqu.dec,
        };
        result.ecliptic = {
          longitude: sunEcl.elon,
          latitude: sunEcl.elat,
        };
        result.distance_au = sunEqu.dist;

        // If observer location provided
        if (latitude !== undefined && longitude !== undefined) {
          const observer = Astronomy.MakeObserver(latitude, longitude, elevation);
          const hor = Astronomy.Horizon(astroDate, observer, sunEqu.ra, sunEqu.dec, 'normal');
          result.horizontal = {
            altitude: hor.altitude,
            azimuth: hor.azimuth,
            is_day: hor.altitude > 0,
          };
        }
        break;
      }

      case 'rise_set': {
        if (latitude === undefined || longitude === undefined) {
          throw new Error('latitude and longitude required for rise_set');
        }
        const observer = Astronomy.MakeObserver(latitude, longitude, elevation);
        const targetBody = body ? Astronomy.Body[body] : Astronomy.Body.Sun;

        // Search for rise and set
        const rise = Astronomy.SearchRiseSet(targetBody, observer, 1, astroDate, 1);
        const set = Astronomy.SearchRiseSet(targetBody, observer, -1, astroDate, 1);

        result.body = body || 'Sun';
        result.observer = { latitude, longitude, elevation };
        result.rise = rise ? rise.date.toISOString() : null;
        result.set = set ? set.date.toISOString() : null;

        // For Sun, also get twilight times
        if (!body || body === 'Sun') {
          const civilDawn = Astronomy.SearchAltitude(
            Astronomy.Body.Sun,
            observer,
            1,
            astroDate,
            1,
            -6
          );
          const civilDusk = Astronomy.SearchAltitude(
            Astronomy.Body.Sun,
            observer,
            -1,
            astroDate,
            1,
            -6
          );
          result.civil_dawn = civilDawn ? civilDawn.date.toISOString() : null;
          result.civil_dusk = civilDusk ? civilDusk.date.toISOString() : null;
        }
        break;
      }

      case 'season': {
        const searchYear = year ?? new Date().getFullYear();
        const seasons = Astronomy.Seasons(searchYear);

        result.year = searchYear;
        result.march_equinox = seasons.mar_equinox.date.toISOString();
        result.june_solstice = seasons.jun_solstice.date.toISOString();
        result.september_equinox = seasons.sep_equinox.date.toISOString();
        result.december_solstice = seasons.dec_solstice.date.toISOString();
        break;
      }

      case 'eclipse_search': {
        // Search for next lunar eclipse
        const lunarEclipse = Astronomy.SearchLunarEclipse(astroDate);
        result.next_lunar_eclipse = lunarEclipse
          ? {
              kind: lunarEclipse.kind,
              peak_time: lunarEclipse.peak.date.toISOString(),
              sd_partial: lunarEclipse.sd_partial,
              sd_total: lunarEclipse.sd_total,
            }
          : null;

        // Search for next solar eclipse (global)
        const solarEclipse = Astronomy.SearchGlobalSolarEclipse(astroDate);
        result.next_solar_eclipse = solarEclipse
          ? {
              kind: solarEclipse.kind,
              peak_time: solarEclipse.peak.date.toISOString(),
              latitude: solarEclipse.latitude,
              longitude: solarEclipse.longitude,
            }
          : null;
        break;
      }

      case 'julian_date': {
        const jd = astroDate.ut + 2451545.0; // J2000.0 epoch
        result.julian_date = jd;
        result.modified_julian_date = jd - 2400000.5;
        result.j2000_days = astroDate.ut;
        result.gregorian_date = astroDate.date.toISOString();
        break;
      }

      case 'angular_separation': {
        if (!body || !body2) throw new Error('body and body2 required for angular_separation');
        const body1Enum = Astronomy.Body[body];
        const body2Enum = Astronomy.Body[body2];
        if (body1Enum === undefined) throw new Error(`Unknown body: ${body}`);
        if (body2Enum === undefined) throw new Error(`Unknown body: ${body2}`);

        const equ1 = Astronomy.Equator(body1Enum, astroDate, null, true, true);
        const equ2 = Astronomy.Equator(body2Enum, astroDate, null, true, true);

        const angle = Astronomy.AngleBetween(equ1.vec, equ2.vec);

        result.body1 = body;
        result.body2 = body2;
        result.angular_separation_degrees = angle;
        result.angular_separation_arcminutes = angle * 60;
        result.is_conjunction = angle < 5;
        result.is_opposition = angle > 175;
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}
