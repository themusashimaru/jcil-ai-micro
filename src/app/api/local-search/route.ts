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

    // Location is optional - if not provided, Google Places will use query text only
    // (e.g., "pizza places in marblehead ma" doesn't need coordinates)

    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!googleApiKey) {
      return NextResponse.json(
        { error: 'Google Places API not configured' },
        { status: 500 }
      );
    }

    console.log('🗺️ Google Places (NEW API) search for:', query, location ? `near ${location.latitude},${location.longitude}` : '(text-only)');

    // Use NEW Google Places API (Text Search)
    const searchUrl = 'https://places.googleapis.com/v1/places:searchText';

    const requestBody: any = {
      textQuery: query,
      maxResultCount: 5,
      languageCode: 'en',
    };

    // Add location bias if coordinates provided
    if (location && location.latitude && location.longitude) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          radius: 5000.0, // 5km radius
        },
      };
    }

    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

    const textSearchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours',
      },
      body: JSON.stringify(requestBody),
    });

    const textSearchData = await textSearchResponse.json();

    console.log('📥 Response status:', textSearchResponse.status);
    console.log('📥 Response data:', JSON.stringify(textSearchData, null, 2));

    if (!textSearchResponse.ok) {
      console.error('Google Places NEW API error:', textSearchData);
      return NextResponse.json(
        { error: `Google Places API error: ${textSearchData.error?.message || 'Unknown error'}` },
        { status: textSearchResponse.status }
      );
    }

    if (!textSearchData.places || textSearchData.places.length === 0) {
      console.log('⚠️ No businesses found for query:', query);
      return NextResponse.json({
        ok: true,
        businesses: [],
        message: 'No businesses found nearby',
      });
    }

    // Format results from NEW API
    const businesses = textSearchData.places.map((place: any) => ({
      name: place.displayName?.text || 'Unknown',
      address: place.formattedAddress || null,
      phone: place.nationalPhoneNumber || null,
      website: place.websiteUri || null,
      rating: place.rating || null,
      total_ratings: place.userRatingCount || null,
      price_level: place.priceLevel || null,
      open_now: place.currentOpeningHours?.openNow || null,
    }));

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
