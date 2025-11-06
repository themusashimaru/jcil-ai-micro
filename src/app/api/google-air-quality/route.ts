import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Google Air Quality API
 * Returns air quality index (AQI) and pollen data
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

    const { location } = await request.json();

    if (!location || !location.latitude || !location.longitude) {
      return NextResponse.json({ error: 'Location required' }, { status: 400 });
    }

    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!googleApiKey) {
      return NextResponse.json(
        { error: 'Google API not configured' },
        { status: 500 }
      );
    }

    console.log('🌬️ Fetching air quality for:', location.latitude, location.longitude);

    // Google Air Quality API
    const airQualityUrl = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${googleApiKey}`;

    const airQualityResponse = await fetch(airQualityUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
      }),
    });

    const airQualityData = await airQualityResponse.json();

    if (!airQualityResponse.ok) {
      console.error('Air Quality API error:', airQualityData);
      return NextResponse.json(
        { error: `Air Quality API error: ${airQualityData.error?.message || 'Unknown error'}` },
        { status: airQualityResponse.status }
      );
    }

    console.log('✅ Air quality data retrieved');

    // Reverse geocode to get location name
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.latitude},${location.longitude}&key=${googleApiKey}`;
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();

    let locationName = 'your area';
    if (geocodeData.status === 'OK' && geocodeData.results[0]) {
      const addressComponents = geocodeData.results[0].address_components;
      const city = addressComponents.find((c: any) => c.types.includes('locality'))?.long_name;
      const state = addressComponents.find((c: any) => c.types.includes('administrative_area_level_1'))?.short_name;
      locationName = city && state ? `${city}, ${state}` : geocodeData.results[0].formatted_address;
    }

    return NextResponse.json({
      ok: true,
      location: locationName,
      airQuality: airQualityData,
    });
  } catch (error: any) {
    console.error('❌ Air quality error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch air quality data' },
      { status: 500 }
    );
  }
}
