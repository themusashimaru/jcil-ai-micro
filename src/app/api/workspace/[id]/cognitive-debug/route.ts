/**
 * COGNITIVE DEBUG API ROUTE
 *
 * Advanced AI-powered debugging that thinks like a senior engineer.
 * Predicts issues before they happen and provides deep analysis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCognitiveDebugger } from '@/lib/cognitive-debugger';
import { DebugLanguage } from '@/lib/cognitive-debugger/types';
import { logger } from '@/lib/logger';

const log = logger('CognitiveDebugAPI');

// ============================================================================
// POST - Run Cognitive Analysis
// ============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const workspaceId = resolvedParams.id;

  try {
    const body = await request.json();
    const { action, code, language, userIntent, focusAreas, relatedFiles } = body;

    if (!code || !language) {
      return NextResponse.json(
        { error: 'Missing required fields: code, language' },
        { status: 400 }
      );
    }

    const debugger_ = getCognitiveDebugger();

    // Create or get session
    const userId = 'default-user'; // Would get from auth in production
    let sessionId = body.sessionId;

    if (!sessionId) {
      const session = debugger_.startSession(workspaceId, userId);
      sessionId = session.id;
    }

    log.info('Cognitive debug request', { action, language, workspaceId });

    switch (action) {
      // =======================================================================
      // FULL COGNITIVE ANALYSIS
      // =======================================================================
      case 'analyze': {
        const result = await debugger_.analyzeCode(sessionId, code, language as DebugLanguage, {
          userIntent,
          focusAreas,
          relatedFiles: relatedFiles ? new Map(Object.entries(relatedFiles)) : undefined,
        });

        return NextResponse.json({
          sessionId,
          ...result,
        });
      }

      // =======================================================================
      // QUICK PREDICTION (for real-time feedback)
      // =======================================================================
      case 'predict': {
        const predictions = await debugger_.quickPredict(
          code,
          language as DebugLanguage,
          body.cursorPosition
        );

        return NextResponse.json({
          sessionId,
          predictions,
        });
      }

      // =======================================================================
      // INTENT-AWARE ANALYSIS
      // =======================================================================
      case 'analyze-intent': {
        if (!userIntent) {
          return NextResponse.json(
            { error: 'Missing userIntent for intent analysis' },
            { status: 400 }
          );
        }

        // Parse intent from natural language if it's a string
        const intentMapper = await import('@/lib/cognitive-debugger/intent-failure-mapper');
        const mapper = new intentMapper.IntentFailureMapper();

        const parsedIntent =
          typeof userIntent === 'string' ? await mapper.parseIntent(userIntent) : userIntent;

        const result = await debugger_.analyzeWithIntent(
          sessionId,
          code,
          language as DebugLanguage,
          parsedIntent
        );

        return NextResponse.json({
          sessionId,
          intentFailureMap: result,
        });
      }

      // =======================================================================
      // CODE EXPLANATION
      // =======================================================================
      case 'explain': {
        const explanation = await debugger_.explainCode(
          code,
          language as DebugLanguage,
          body.question
        );

        return NextResponse.json({
          sessionId,
          explanation,
        });
      }

      // =======================================================================
      // VISUALIZE CODE FLOW
      // =======================================================================
      case 'visualize': {
        const visualization = await debugger_.visualizeCodeFlow(
          sessionId,
          code,
          language as DebugLanguage
        );

        return NextResponse.json({
          sessionId,
          visualization,
        });
      }

      // =======================================================================
      // APPLY FIX
      // =======================================================================
      case 'apply-fix': {
        if (!body.fix) {
          return NextResponse.json({ error: 'Missing fix object' }, { status: 400 });
        }

        const result = await debugger_.applyFix(sessionId, body.fix, code);

        return NextResponse.json({
          sessionId,
          ...result,
        });
      }

      // =======================================================================
      // END SESSION
      // =======================================================================
      case 'end-session': {
        debugger_.endSession(sessionId);

        return NextResponse.json({
          success: true,
          message: 'Session ended',
        });
      }

      // =======================================================================
      // GET SESSION INFO
      // =======================================================================
      case 'session-info': {
        const session = debugger_.getSession(sessionId);

        if (!session) {
          return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        return NextResponse.json({
          sessionId: session.id,
          workspaceId: session.workspaceId,
          startTime: session.startTime,
          lastActivity: session.lastActivity,
          predictedIssuesCount: session.predictedIssues.length,
          patternsCount: session.patterns.length,
          executionPathsCount: session.executionPaths.length,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    log.error('Cognitive debug error', { error });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Health Check and Capabilities
// ============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;

  try {
    // Get universal debugger for language info
    const { UniversalDebugger } = await import('@/lib/cognitive-debugger/universal-debugger');
    const universalDebugger = new UniversalDebugger();

    return NextResponse.json({
      status: 'healthy',
      workspaceId: resolvedParams.id,
      capabilities: {
        predictiveAnalysis: true,
        intentMapping: true,
        patternRecognition: true,
        multiDimensionalAnalysis: true,
        cognitiveReasoning: true,
        codeFlowVisualization: true,
        universalDebugging: true,
      },
      supportedLanguages: universalDebugger.getSupportedLanguages(),
      analysisDepths: ['surface', 'shallow', 'deep', 'exhaustive'],
      focusAreas: [
        'security',
        'performance',
        'logic',
        'architecture',
        'maintainability',
        'testability',
        'reliability',
      ],
      actions: [
        'analyze',
        'predict',
        'analyze-intent',
        'explain',
        'visualize',
        'apply-fix',
        'end-session',
        'session-info',
      ],
    });
  } catch (error) {
    log.error('Cognitive debug health check error', { error });
    return NextResponse.json({ status: 'unhealthy', error: String(error) }, { status: 500 });
  }
}
