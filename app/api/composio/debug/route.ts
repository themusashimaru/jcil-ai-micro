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
import { getConnectedAccounts, getAvailableTools, isComposioConfigured } from '@/lib/composio';
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

    // Step 2: Get connected accounts
    const accountsStart = Date.now();
    let connectedApps: string[] = [];
    try {
      const accounts = await getConnectedAccounts(userId);
      const connected = accounts.filter((a) => a.status === 'connected');
      connectedApps = connected.map((a) => a.toolkit);

      steps.push({
        step: '2_connected_accounts',
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
        },
      });
    } catch (accountsError) {
      steps.push({
        step: '2_connected_accounts',
        status: 'fail',
        duration_ms: Date.now() - accountsStart,
        details: {},
        error: accountsError instanceof Error ? accountsError.message : 'Failed to get accounts',
      });
    }

    if (connectedApps.length === 0) {
      return Response.json({
        ok: false,
        summary: 'No connected apps found. Connect an app first in Settings > Connectors.',
        steps,
      });
    }

    // Step 3: Get available tools (raw from Composio SDK)
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
        step: '3_available_tools_raw',
        status: rawToolCount > 0 ? 'pass' : 'fail',
        duration_ms: Date.now() - toolsStart,
        details: {
          totalTools: rawToolCount,
          toolsByPrefix,
          sampleToolNames: rawToolNames.slice(0, 15),
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
        step: '3_available_tools_raw',
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
