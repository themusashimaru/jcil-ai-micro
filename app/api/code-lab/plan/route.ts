import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateCSRF } from '@/lib/security/csrf';
import { rateLimiters } from '@/lib/security/rate-limit';
import { getPlanManager } from '@/lib/workspace/plan-mode';
import { successResponse, errors } from '@/lib/api/utils';

/**
 * Plan Mode API
 *
 * Provides REST endpoints for managing execution plans.
 * Used by the CodeLabPlanView component.
 */

// GET - Get current plan status
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errors.unauthorized();
  }

  // Rate limiting (using edit limiter for consistency)
  const rateLimit = await rateLimiters.codeLabEdit(user.id);
  if (!rateLimit.allowed) {
    return errors.rateLimited(rateLimit.retryAfter);
  }

  const planManager = getPlanManager();
  const plan = planManager.getCurrentPlan();

  return successResponse({
    plan,
    progress: planManager.getProgress(),
    needsApproval: planManager.needsApproval(),
  });
}

// POST - Plan actions (approve, skip, cancel, complete)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errors.unauthorized();
  }

  // CSRF validation
  const csrfResult = validateCSRF(request);
  if (!csrfResult.valid) {
    return errors.csrfFailed();
  }

  // Rate limiting
  const rateLimit = await rateLimiters.codeLabEdit(user.id);
  if (!rateLimit.allowed) {
    return errors.rateLimited(rateLimit.retryAfter);
  }

  const body = await request.json();
  const { action, reason, output } = body;

  const planManager = getPlanManager();

  switch (action) {
    case 'approve': {
      const approved = planManager.approvePlan();
      if (approved) {
        planManager.startPlan();
      }
      return successResponse({
        success: approved,
        plan: planManager.getCurrentPlan(),
      });
    }

    case 'skip': {
      const skipped = planManager.skipCurrentStep(reason);
      return successResponse({
        success: !!skipped,
        plan: planManager.getCurrentPlan(),
        skippedStep: skipped,
      });
    }

    case 'complete': {
      const completed = planManager.completeCurrentStep(output);
      return successResponse({
        success: !!completed,
        plan: planManager.getCurrentPlan(),
        completedStep: completed,
      });
    }

    case 'fail': {
      const failed = planManager.failCurrentStep(reason);
      return successResponse({
        success: !!failed,
        plan: planManager.getCurrentPlan(),
        failedStep: failed,
      });
    }

    case 'cancel': {
      const cancelled = planManager.cancelPlan();
      return successResponse({
        success: cancelled,
        plan: planManager.getCurrentPlan(),
      });
    }

    default:
      return errors.badRequest(`Unknown action: ${action}`);
  }
}
