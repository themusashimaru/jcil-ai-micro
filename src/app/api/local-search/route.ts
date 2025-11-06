import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Local Business Search using Google Places API
 * Returns specific businesses with names, addresses, phones, websites
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

    const { query, location } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    if (!location || !location.latitude || !location.longitude) {
      return NextResponse.json({ error: 'Location required for local search' }, { status: 400 });
    }

    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!googleApiKey) {
      return NextResponse.json(
        { error: 'Google Places API not configured' },
        { status: 500 }
      );
    }

    console.log('🗺️ Google Places search for:', query, 'near', location);

    // Step 1: Text Search to find places
    const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${location.latitude},${location.longitude}&radius=5000&key=${googleApiKey}`;

    const textSearchResponse = await fetch(textSearchUrl);
    const textSearchData = await textSearchResponse.json();

    if (textSearchData.status !== 'OK' && textSearchData.status !== 'ZERO_RESULTS') {
      console.error('Google Places error:', textSearchData.status);
      return NextResponse.json(
        { error: `Google Places API error: ${textSearchData.status}` },
        { status: 500 }
      );
    }

    if (!textSearchData.results || textSearchData.results.length === 0) {
      return NextResponse.json({
        ok: true,
        businesses: [],
        message: 'No businesses found nearby',
      });
    }

    // Step 2: Get details for top 5 places
    const topPlaces = textSearchData.results.slice(0, 5);
    const detailedBusinesses = await Promise.all(
      topPlaces.map(async (place: any) => {
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,opening_hours,rating,user_ratings_total,price_level&key=${googleApiKey}`;

          const detailsResponse = await fetch(detailsUrl);
          const detailsData = await detailsResponse.json();

          if (detailsData.status === 'OK' && detailsData.result) {
            const result = detailsData.result;
            return {
              name: result.name,
              address: result.formatted_address,
              phone: result.formatted_phone_number || null,
              website: result.website || null,
              rating: result.rating || null,
              total_ratings: result.user_ratings_total || null,
              price_level: result.price_level || null,
              open_now: result.opening_hours?.open_now || null,
            };
          }
          return null;
        } catch (error) {
          console.error('Error fetching place details:', error);
          return null;
        }
      })
    );

    // Filter out any null results
    const businesses = detailedBusinesses.filter(b => b !== null);

    console.log(`✅ Found ${businesses.length} businesses`);

    return NextResponse.json({
      ok: true,
      businesses,
      count: businesses.length,
    });
  } catch (error: any) {
    console.error('❌ Local search error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to perform local search' },
      { status: 500 }
    );
  }
}
