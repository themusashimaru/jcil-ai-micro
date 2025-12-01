/**
 * REPLICATE ACTION EXECUTION API
 * Execute Replicate API actions to run various AI models
 * POST: Execute a specific Replicate action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const REPLICATE_API = 'https://api.replicate.com/v1';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const connection = await getUserConnection(user.id, 'replicate');
    if (!connection) {
      return NextResponse.json({ error: 'Replicate not connected' }, { status: 400 });
    }

    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const apiKey = connection.token;
    let result: unknown;

    switch (action) {
      case 'run_model':
      case 'predict': {
        const { model, input, wait = true } = params as {
          model: string;
          input: Record<string, unknown>;
          wait?: boolean;
        };

        if (!model || !input) {
          return NextResponse.json({ error: 'model and input are required' }, { status: 400 });
        }

        // Create prediction
        const response = await fetch(`${REPLICATE_API}/predictions`, {
          method: 'POST',
          headers: {
            Authorization: `Token ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            version: model.includes(':') ? model.split(':')[1] : model,
            input,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.detail || 'Failed to create prediction' },
            { status: response.status }
          );
        }

        let prediction = await response.json();

        // If wait=true, poll for completion
        if (wait && prediction.status !== 'succeeded' && prediction.status !== 'failed') {
          const maxWait = 60000; // 60 seconds max
          const startTime = Date.now();

          while (
            prediction.status !== 'succeeded' &&
            prediction.status !== 'failed' &&
            Date.now() - startTime < maxWait
          ) {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const pollResponse = await fetch(`${REPLICATE_API}/predictions/${prediction.id}`, {
              headers: { Authorization: `Token ${apiKey}` },
            });

            if (pollResponse.ok) {
              prediction = await pollResponse.json();
            }
          }
        }

        result = {
          id: prediction.id,
          status: prediction.status,
          output: prediction.output,
          error: prediction.error,
          metrics: prediction.metrics,
          createdAt: prediction.created_at,
          completedAt: prediction.completed_at,
        };
        break;
      }

      case 'get_prediction': {
        const { predictionId } = params as { predictionId: string };
        if (!predictionId) {
          return NextResponse.json({ error: 'predictionId is required' }, { status: 400 });
        }

        const response = await fetch(`${REPLICATE_API}/predictions/${predictionId}`, {
          headers: { Authorization: `Token ${apiKey}` },
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.detail || 'Failed to get prediction' },
            { status: response.status }
          );
        }

        const prediction = await response.json();
        result = {
          id: prediction.id,
          status: prediction.status,
          output: prediction.output,
          error: prediction.error,
          metrics: prediction.metrics,
        };
        break;
      }

      case 'list_predictions': {
        const response = await fetch(`${REPLICATE_API}/predictions`, {
          headers: { Authorization: `Token ${apiKey}` },
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.detail || 'Failed to list predictions' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          predictions: data.results?.slice(0, 20).map((p: {
            id: string;
            status: string;
            created_at: string;
            model: string;
          }) => ({
            id: p.id,
            status: p.status,
            createdAt: p.created_at,
            model: p.model,
          })) || [],
          count: data.results?.length || 0,
        };
        break;
      }

      case 'search_models': {
        const { query } = params as { query?: string };

        const url = query
          ? `${REPLICATE_API}/models?query=${encodeURIComponent(query)}`
          : `${REPLICATE_API}/models`;

        const response = await fetch(url, {
          headers: { Authorization: `Token ${apiKey}` },
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.detail || 'Failed to search models' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          models: data.results?.slice(0, 20).map((m: {
            owner: string;
            name: string;
            description: string;
            run_count: number;
            latest_version: { id: string };
          }) => ({
            fullName: `${m.owner}/${m.name}`,
            description: m.description?.slice(0, 100),
            runCount: m.run_count,
            latestVersion: m.latest_version?.id,
          })) || [],
          count: data.results?.length || 0,
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Replicate Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
