/**
 * STRATEGY EVENTS TEST ROUTE
 *
 * Simulates strategy events to test the UI activity feed.
 * Returns SSE stream with fake events.
 *
 * PROTECTED: Requires admin authentication
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(_req: NextRequest) {
  // Require admin auth
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (type: string, message: string, data?: Record<string, unknown>) => {
        const event = {
          type,
          message,
          timestamp: Date.now(),
          data,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Simulate intake
      sendEvent('intake_start', 'Starting forensic intake...');
      await sleep(500);
      sendEvent('intake_complete', 'Intake complete');
      await sleep(500);

      // Simulate architect
      sendEvent('architect_designing', 'Opus 4.6 designing agent army...');
      await sleep(1000);
      sendEvent('agent_spawned', 'Spawned 10 scouts', { totalAgents: 10 });
      await sleep(500);

      // Simulate searches
      const searches = [
        'best coworking spaces Jersey City',
        'WeWork Jersey City pricing',
        'Industrious Jersey City reviews',
        'shared office space Journal Square',
        'remote work spaces near PATH train',
      ];

      for (const query of searches) {
        sendEvent('search_executing', `Searching: ${query}`, {
          agentId: 'scout_1',
          agentName: 'Coworking Space Scout',
          searchQuery: query,
        });
        await sleep(300);
        sendEvent('search_complete', 'Search complete', { agentId: 'scout_1' });
        await sleep(200);
      }

      // Simulate browser visits
      const urls = [
        'https://www.wework.com/buildings/harborside--jersey-city--nj',
        'https://www.industriousoffice.com/locations/jersey-city',
        'https://www.spacious.com/spaces/jersey-city',
      ];

      for (const url of urls) {
        sendEvent('browser_visiting', `Visiting: ${url}`, {
          agentId: 'scout_2',
          agentName: 'Website Analysis Scout',
          url,
        });
        await sleep(800);
      }

      // Simulate screenshots
      sendEvent('screenshot_captured', 'Screenshot: wework.com', {
        agentId: 'scout_3',
        agentName: 'Visual Analysis Scout',
        url: 'https://www.wework.com/buildings/harborside',
      });
      await sleep(500);

      sendEvent('screenshot_captured', 'Screenshot: industrious.com', {
        agentId: 'scout_3',
        agentName: 'Visual Analysis Scout',
        url: 'https://www.industriousoffice.com/locations/jersey-city',
      });
      await sleep(500);

      // Simulate code execution
      sendEvent('code_executing', 'Running Python analysis', {
        agentId: 'scout_4',
        agentName: 'Data Analysis Scout',
        language: 'python',
      });
      await sleep(1000);

      // Agent completions
      for (let i = 1; i <= 10; i++) {
        sendEvent('agent_complete', `Scout ${i} complete`, {
          agentId: `scout_${i}`,
          agentName: `Scout ${i}`,
        });
        await sleep(200);
      }

      // Synthesis
      sendEvent('synthesis_start', 'Opus 4.6 synthesizing strategy...');
      await sleep(2000);

      // Complete
      sendEvent('strategy_complete', 'Strategy complete!', {
        recommendation: {
          title: 'WeWork Harborside is your best option',
          confidence: 85,
        },
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
