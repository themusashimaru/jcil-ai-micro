import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Google Time Zone API
 * Returns time zone information for a location
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { location, locationName } = await request.json();

    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!googleApiKey) {
      return NextResponse.json(
        { error: 'Google API not configured' },
        { status: 500 }
      );
    }

    let lat = location?.latitude;
    let lng = location?.longitude;

    // If location name provided but no coordinates, geocode it first
    if (locationName && (!lat || !lng)) {
      console.log('🌍 Geocoding location:', locationName);
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationName)}&key=${googleApiKey}`;
      const geocodeResponse = await fetch(geocodeUrl);
      const geocodeData = await geocodeResponse.json();

      if (geocodeData.status === 'OK' && geocodeData.results[0]) {
        lat = geocodeData.results[0].geometry.location.lat;
        lng = geocodeData.results[0].geometry.location.lng;
      } else {
        return NextResponse.json(
          { error: 'Location not found' },
          { status: 404 }
        );
      }
    }

    if (!lat || !lng) {
      return NextResponse.json({ error: 'Location required' }, { status: 400 });
    }

    console.log('🕐 Fetching timezone for:', lat, lng);

    // Google Time Zone API requires timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    const timezoneUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestamp}&key=${googleApiKey}`;

    const timezoneResponse = await fetch(timezoneUrl);
    const timezoneData = await timezoneResponse.json();

    if (timezoneData.status !== 'OK') {
      console.error('Time Zone API error:', timezoneData.status);
      return NextResponse.json(
        { error: `Time Zone API error: ${timezoneData.status}` },
        { status: 500 }
      );
    }

    // Calculate local time
    const utcOffset = (timezoneData.rawOffset + timezoneData.dstOffset) / 3600; // Convert to hours
    const localTime = new Date(Date.now() + (timezoneData.rawOffset + timezoneData.dstOffset) * 1000);

    console.log('✅ Time zone data retrieved:', timezoneData.timeZoneId);

    return NextResponse.json({
      ok: true,
      timezone: {
        id: timezoneData.timeZoneId,
        name: timezoneData.timeZoneName,
        utcOffset: utcOffset,
        localTime: localTime.toISOString(),
        formattedTime: localTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
        formattedDate: localTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      },
    });
  } catch (error: any) {
    console.error('❌ Time zone error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch time zone data' },
      { status: 500 }
    );
  }
}
