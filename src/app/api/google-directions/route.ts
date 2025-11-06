import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Google Directions API
 * Returns navigation directions between two points
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

    const { origin, destination, mode } = await request.json();

    if (!origin || !destination) {
      return NextResponse.json({ error: 'Origin and destination required' }, { status: 400 });
    }

    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!googleApiKey) {
      return NextResponse.json(
        { error: 'Google API not configured' },
        { status: 500 }
      );
    }

    // Travel mode: driving, walking, bicycling, transit
    const travelMode = mode || 'driving';

    console.log('🚗 Getting directions from', origin, 'to', destination, `(${travelMode})`);

    // Google Directions API
    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${travelMode}&key=${googleApiKey}`;

    const directionsResponse = await fetch(directionsUrl);
    const directionsData = await directionsResponse.json();

    if (directionsData.status !== 'OK') {
      console.error('Directions API error:', directionsData.status);
      return NextResponse.json(
        { error: `Directions API error: ${directionsData.status}` },
        { status: 500 }
      );
    }

    if (!directionsData.routes || directionsData.routes.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'No routes found',
      });
    }

    const route = directionsData.routes[0];
    const leg = route.legs[0];

    console.log('✅ Directions retrieved:', leg.distance.text, leg.duration.text);

    return NextResponse.json({
      ok: true,
      directions: {
        distance: leg.distance.text,
        duration: leg.duration.text,
        start_address: leg.start_address,
        end_address: leg.end_address,
        steps: leg.steps.map((step: any) => ({
          instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Strip HTML tags
          distance: step.distance.text,
          duration: step.duration.text,
        })),
        overview: route.summary,
      },
    });
  } catch (error: any) {
    console.error('❌ Directions error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch directions' },
      { status: 500 }
    );
  }
}
