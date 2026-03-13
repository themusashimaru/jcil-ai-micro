/**
 * COMPOSIO DEBUG / DIAGNOSTIC ENDPOINT
 * =====================================
 *
 * GET: Run a full diagnostic on the Composio connector pipeline.
 * Returns detailed info about each step so we can identify WHY tools
 * fail to load at runtime.
 *
 * This is an admin-only endpoint.
 */

import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';
import {
  getConnectedAccounts,
  getAvailableTools,
  isComposioConfigured,
  getComposioClient,
} from '@/lib/composio';
import { getComposioToolsForUser } from '@/lib/composio/chat-tools';

export const dynamic = 'force-dynamic';

const log = logger('ComposioDebug');

interface DiagnosticStep {
  step: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  duration_ms: number;
  details: Record<string, unknown>;
  error?: string;
}

export async function GET(request: NextRequest) {
  const steps: DiagnosticStep[] = [];

  try {
    // Step 0: Auth check
    const authStart = Date.now();
    const auth = await requireUser(request);
    if (!auth.authorized) {
      steps.push({
        step: '0_auth',
        status: 'fail',
        duration_ms: Date.now() - authStart,
        details: {},
        error: 'Authentication required',
      });
      return auth.response;
    }
    const userId = auth.user.id;
    steps.push({
      step: '0_auth',
      status: 'pass',
      duration_ms: Date.now() - authStart,
      details: { userId },
    });

    // Step 1: Check if Composio is configured
    const configStart = Date.now();
    const configured = isComposioConfigured();
    steps.push({
      step: '1_composio_configured',
      status: configured ? 'pass' : 'fail',
      duration_ms: Date.now() - configStart,
      details: {
        hasApiKey: configured,
        envKeyLength: process.env.COMPOSIO_API_KEY?.length ?? 0,
      },
    });

    if (!configured) {
      return Response.json({
        ok: false,
        summary: 'COMPOSIO_API_KEY is not set. All connectors will be unavailable.',
        steps,
      });
    }

    // Step 2: Get RAW connected accounts from Composio API (bypassing our mapping)
    // This shows exactly what Composio returns so we can detect status mapping issues
    const rawAccountsStart = Date.now();
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let rawAccountItems: any[] = [];
    try {
      const client = getComposioClient();
      const rawAccounts = await client.connectedAccounts.list({
        userIds: [userId],
      });
      rawAccountItems = rawAccounts.items || [];

      steps.push({
        step: '2a_raw_composio_accounts',
        status: rawAccountItems.length > 0 ? 'pass' : 'warn',
        duration_ms: Date.now() - rawAccountsStart,
        details: {
          totalRawAccounts: rawAccountItems.length,
          rawAccounts: rawAccountItems.map((a: any) => ({
            id: a.id,
            status: a.status, // EXACT status string from Composio
            statusType: typeof a.status,
            toolkit: a.toolkit
              ? {
                  slug: a.toolkit.slug,
                  name: a.toolkit.name,
                  id: a.toolkit.id,
                }
              : 'undefined',
            integrationId: a.integrationId,
            appName: a.appName,
            appUniqueId: a.appUniqueId,
          })),
        },
      });
    } catch (rawAccountsError) {
      steps.push({
        step: '2a_raw_composio_accounts',
        status: 'fail',
        duration_ms: Date.now() - rawAccountsStart,
        details: {},
        error:
          rawAccountsError instanceof Error
            ? rawAccountsError.message
            : 'Failed to get raw accounts',
      });
    }

    // Step 2b: Get connected accounts through our mapping layer
    const accountsStart = Date.now();
    let connectedApps: string[] = [];
    try {
      const accounts = await getConnectedAccounts(userId);
      const connected = accounts.filter((a) => a.status === 'connected');
      connectedApps = connected.map((a) => a.toolkit);

      steps.push({
        step: '2b_mapped_accounts',
        status: connected.length > 0 ? 'pass' : 'warn',
        duration_ms: Date.now() - accountsStart,
        details: {
          totalAccounts: accounts.length,
          connectedCount: connected.length,
          allStatuses: accounts.map((a) => ({
            toolkit: a.toolkit,
            status: a.status,
            id: a.id,
          })),
          connectedApps,
          statusMismatchCheck:
            rawAccountItems.length > 0
              ? {
                  rawCount: rawAccountItems.length,
                  mappedCount: accounts.length,
                  rawStatuses: rawAccountItems.map((a: any) => a.status),
                  mappedStatuses: accounts.map((a) => a.status),
                }
              : 'no raw data to compare',
        },
      });
    } catch (accountsError) {
      steps.push({
        step: '2b_mapped_accounts',
        status: 'fail',
        duration_ms: Date.now() - accountsStart,
        details: {},
        error:
          accountsError instanceof Error ? accountsError.message : 'Failed to get mapped accounts',
      });
    }

    if (connectedApps.length === 0) {
      return Response.json({
        ok: false,
        summary:
          'No connected apps found after mapping. ' +
          (rawAccountItems.length > 0
            ? `Raw API returned ${rawAccountItems.length} account(s) with statuses: [${rawAccountItems.map((a: any) => a.status).join(', ')}]. Status mapping may be broken.`
            : 'No accounts in Composio API either. Connect an app first in Settings > Connectors.'),
        steps,
      });
    }

    // Step 2c: Direct HTTP call to Composio API (bypasses SDK entirely)
    // This tells us if the API itself is working or if the SDK is the problem
    const directApiStart = Date.now();
    const firstApp = connectedApps[0]; // Test with first connected app
    const testSlug = firstApp.toLowerCase().replace(/_/g, '');
    try {
      const apiKey = process.env.COMPOSIO_API_KEY || '';
      const apiUrl = `https://backend.composio.dev/api/v2/toolkits/${testSlug}/tools?limit=5`;

      const directResponse = await fetch(apiUrl, {
        headers: {
          'x-api-key': apiKey,
          Accept: 'application/json',
        },
      });

      const directStatus = directResponse.status;
      let directBody: any = null;
      try {
        directBody = await directResponse.json();
      } catch {
        directBody = await directResponse.text().catch(() => 'Failed to read body');
      }

      steps.push({
        step: '2c_direct_api_call',
        status: directStatus === 200 ? 'pass' : 'fail',
        duration_ms: Date.now() - directApiStart,
        details: {
          url: apiUrl,
          httpStatus: directStatus,
          testToolkit: testSlug,
          responseToolCount: Array.isArray(directBody?.items)
            ? directBody.items.length
            : Array.isArray(directBody)
              ? directBody.length
              : 'not an array',
          responseSample: Array.isArray(directBody?.items)
            ? directBody.items.slice(0, 3).map((t: any) => ({
                name: t.name,
                slug: t.slug,
                enum: t.enum,
              }))
            : typeof directBody === 'object'
              ? { keys: Object.keys(directBody || {}).slice(0, 10) }
              : String(directBody).substring(0, 200),
        },
      });
    } catch (directError) {
      steps.push({
        step: '2c_direct_api_call',
        status: 'fail',
        duration_ms: Date.now() - directApiStart,
        details: { testToolkit: testSlug },
        error: directError instanceof Error ? directError.message : 'Direct API call failed',
      });
    }

    // Step 2d: Direct HTTP call to list tools using the SDK's actual filter format
    const sdkApiStart = Date.now();
    try {
      const apiKey = process.env.COMPOSIO_API_KEY || '';
      const toolkitSlugs = connectedApps.map((a) => a.toLowerCase().replace(/_/g, ''));
      const apiUrl = `https://backend.composio.dev/api/v2/tools?toolkit_slug=${encodeURIComponent(toolkitSlugs.join(','))}&limit=10`;

      const sdkResponse = await fetch(apiUrl, {
        headers: {
          'x-api-key': apiKey,
          Accept: 'application/json',
        },
      });

      const sdkStatus = sdkResponse.status;
      let sdkBody: any = null;
      try {
        sdkBody = await sdkResponse.json();
      } catch {
        sdkBody = await sdkResponse.text().catch(() => 'Failed to read body');
      }

      const items = sdkBody?.items || sdkBody?.tools || (Array.isArray(sdkBody) ? sdkBody : []);

      steps.push({
        step: '2d_sdk_api_format',
        status: sdkStatus === 200 && items.length > 0 ? 'pass' : 'fail',
        duration_ms: Date.now() - sdkApiStart,
        details: {
          url: apiUrl,
          httpStatus: sdkStatus,
          toolkitSlugs,
          responseToolCount: items.length,
          responseKeys: Object.keys(sdkBody || {}),
          sampleTools: items.slice(0, 5).map((t: any) => ({
            name: t.name,
            slug: t.slug,
            enum: t.enum,
            toolkit: t.toolkit,
          })),
        },
      });
    } catch (sdkApiError) {
      steps.push({
        step: '2d_sdk_api_format',
        status: 'fail',
        duration_ms: Date.now() - sdkApiStart,
        details: {},
        error: sdkApiError instanceof Error ? sdkApiError.message : 'SDK API format call failed',
      });
    }

    // Step 3: Get available tools via our getAvailableTools (with fallback)
    const toolsStart = Date.now();
    let rawToolCount = 0;
    let rawToolNames: string[] = [];
    try {
      const rawTools = await getAvailableTools(userId, connectedApps);
      rawToolCount = rawTools.length;
      rawToolNames = rawTools.map((t) => t.name);

      // Group tools by toolkit prefix
      const toolsByPrefix: Record<string, number> = {};
      for (const tool of rawTools) {
        const prefix = tool.name.split('_').slice(0, 1).join('_');
        toolsByPrefix[prefix] = (toolsByPrefix[prefix] || 0) + 1;
      }

      steps.push({
        step: '3_available_tools',
        status: rawToolCount > 0 ? 'pass' : 'fail',
        duration_ms: Date.now() - toolsStart,
        details: {
          totalTools: rawToolCount,
          toolsByPrefix,
          sampleToolNames: rawToolNames.slice(0, 20),
          sampleToolSchema: rawTools[0]
            ? {
                name: rawTools[0].name,
                hasDescription: !!rawTools[0].description,
                hasParameters: !!rawTools[0].parameters,
                propertyCount: Object.keys(rawTools[0].parameters?.properties || {}).length,
                requiredCount: (rawTools[0].parameters?.required || []).length,
              }
            : null,
        },
      });
    } catch (toolsError) {
      steps.push({
        step: '3_available_tools',
        status: 'fail',
        duration_ms: Date.now() - toolsStart,
        details: {
          connectedAppsRequested: connectedApps,
        },
        error: toolsError instanceof Error ? toolsError.message : 'Failed to get tools',
      });
    }

    // Step 4: Full pipeline test (getComposioToolsForUser)
    const pipelineStart = Date.now();
    try {
      const ctx = await getComposioToolsForUser(userId);

      steps.push({
        step: '4_full_pipeline',
        status: ctx.tools.length > 0 ? 'pass' : 'fail',
        duration_ms: Date.now() - pipelineStart,
        details: {
          connectedApps: ctx.connectedApps,
          toolCount: ctx.tools.length,
          hasGitHub: ctx.hasGitHub,
          hasGmail: ctx.hasGmail,
          hasOutlook: ctx.hasOutlook,
          hasSlack: ctx.hasSlack,
          sampleToolNames: ctx.tools.slice(0, 10).map((t) => t.name),
          systemPromptLength: ctx.systemPromptAddition.length,
          hasUnavailableSection: ctx.systemPromptAddition.includes('Temporarily Unavailable'),
          systemPromptPreview: ctx.systemPromptAddition.substring(0, 500),
        },
      });
    } catch (pipelineError) {
      steps.push({
        step: '4_full_pipeline',
        status: 'fail',
        duration_ms: Date.now() - pipelineStart,
        details: {},
        error: pipelineError instanceof Error ? pipelineError.message : 'Pipeline failed',
      });
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // Summary
    const failedSteps = steps.filter((s) => s.status === 'fail');
    const ok = failedSteps.length === 0;

    let summary: string;
    if (ok) {
      summary = `All steps passed. ${rawToolCount} tools loaded for ${connectedApps.length} connected apps.`;
    } else {
      summary = `${failedSteps.length} step(s) failed: ${failedSteps.map((s) => s.step).join(', ')}. Check details for each step.`;
    }

    log.info('Composio diagnostic complete', {
      ok,
      summary,
      failedSteps: failedSteps.map((s) => s.step),
    });

    return Response.json({ ok, summary, steps });
  } catch (error) {
    log.error('Composio diagnostic error', { error });
    return Response.json(
      {
        ok: false,
        summary: 'Diagnostic endpoint error',
        error: error instanceof Error ? error.message : 'Unknown error',
        steps,
      },
      { status: 500 }
    );
  }
}
