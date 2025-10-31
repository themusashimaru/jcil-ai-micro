// /lib/moderation.ts
// Content moderation with PROGRESSIVE PENALTY SYSTEM + WHITELIST

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// ============================================
// OPENAI MODERATION API
// ============================================

interface ModerationResult {
  flagged: boolean;
  categories: {
    hate: boolean;
    'hate/threatening': boolean;
    harassment: boolean;
    'harassment/threatening': boolean;
    'self-harm': boolean;
    'self-harm/intent': boolean;
    'self-harm/instructions': boolean;
    sexual: boolean;
    'sexual/minors': boolean;
    violence: boolean;
    'violence/graphic': boolean;
  };
  category_scores: {
    hate: number;
    'hate/threatening': number;
    harassment: number;
    'harassment/threatening': number;
    'self-harm': number;
    'self-harm/intent': number;
    'self-harm/instructions': number;
    sexual: number;
    'sexual/minors': number;
    violence: number;
    'violence/graphic': number;
  };
}

/**
 * Check content using OpenAI Moderation API (FREE!)
 */
export async function checkContentModeration(text: string): Promise<ModerationResult> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('⚠️ OPENAI_API_KEY is not set in environment variables!');
      return createSafeResult();
    }

    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ input: text }),
    });

    if (!response.ok) {
      console.error('❌ Moderation API error:', response.status, response.statusText);
      return createSafeResult();
    }

    const data = await response.json();
    console.log('✅ Moderation check completed:', data.results[0].flagged ? 'FLAGGED' : 'CLEAN');
    return data.results[0];
  } catch (error) {
    console.error('❌ Moderation check failed:', error);
    return createSafeResult();
  }
}

function createSafeResult(): ModerationResult {
  return {
    flagged: false,
    categories: {
      hate: false,
      'hate/threatening': false,
      harassment: false,
      'harassment/threatening': false,
      'self-harm': false,
      'self-harm/intent': false,
      'self-harm/instructions': false,
      sexual: false,
      'sexual/minors': false,
      violence: false,
      'violence/graphic': false,
    },
    category_scores: {
      hate: 0,
      'hate/threatening': 0,
      harassment: 0,
      'harassment/threatening': 0,
      'self-harm': 0,
      'self-harm/intent': 0,
      'self-harm/instructions': 0,
      sexual: 0,
      'sexual/minors': 0,
      violence: 0,
      'violence/graphic': 0,
    },
  };
}

// ============================================
// JAILBREAK DETECTION
// ============================================

const JAILBREAK_PATTERNS = [
  /do anything now/i,
  /you are now dan/i,
  /act as dan/i,
  /pretend.*you.*have.*no.*restrictions/i,
  /ignore (all )?previous (instructions|prompts|rules)/i,
  /forget (all )?(previous|prior) (instructions|prompts|rules)/i,
  /disregard (all )?(previous|prior) (instructions|prompts|rules)/i,
  /you are no longer (chatgpt|claude|an? ai)/i,
  /pretend (you are|you're) (not|no longer) an? ai/i,
  /act as if you (have no|don't have) (restrictions|limitations)/i,
  /show (me )?(your|the) (system|original) (prompt|instructions)/i,
  /what (are|were) (your|the) (original|initial|system) (instructions|prompts)/i,
  /repeat (your|the) (system|original) (prompt|instructions)/i,
  /enable developer mode/i,
  /developer mode enabled/i,
  /you are in developer mode/i,
];

export function detectJailbreak(text: string): { isJailbreak: boolean; pattern?: string } {
  const lowerText = text.toLowerCase();
  
  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(lowerText)) {
      console.log('🚨 Jailbreak attempt detected!');
      return { isJailbreak: true, pattern: pattern.source };
    }
  }
  
  return { isJailbreak: false };
}

// ============================================
// SPAM DETECTION
// ============================================

export function detectSpam(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/);
  const wordCount = words.length;
  const uniqueWords = new Set(words).size;
  
  if (wordCount > 10 && uniqueWords / wordCount < 0.3) {
    console.log('🚨 Spam detected: low unique word ratio');
    return true;
  }
  
  const capsCount = (text.match(/[A-Z]/g) || []).length;
  const lettersCount = (text.match(/[a-zA-Z]/g) || []).length;
  
  if (lettersCount > 10 && capsCount / lettersCount > 0.7) {
    console.log('🚨 Spam detected: excessive caps');
    return true;
  }
  
  return false;
}

// ============================================
// SUPABASE HELPER
// ============================================

async function createSupabaseClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          try { cookieStore.set(name, value, options); } catch (error) { console.error(`Failed to set cookie:`, error); }
        },
        remove: (name: string, options: CookieOptions) => {
          try { cookieStore.set({ name, value: '', ...options }); } catch (error) { console.error(`Failed to delete cookie:`, error); }
        },
      },
    }
  );
}

// ============================================
// VIOLATION TRACKING
// ============================================

export interface ViolationInfo {
  type: 'content' | 'jailbreak' | 'spam' | 'abuse';
  severity: 'low' | 'medium' | 'high' | 'critical';
  categories: string[];
  confidence?: number;
  pattern?: string;
}

export async function logViolation(
  userId: string,
  messageContent: string,
  violationInfo: ViolationInfo
) {
  try {
    const supabase = await createSupabaseClient();
    
    const action = determineAction(violationInfo.severity);
    
    const { error } = await supabase.from('violations').insert({
      user_id: userId,
      violation_type: violationInfo.type,
      severity: violationInfo.severity,
      message_content: messageContent.substring(0, 500),
      flagged_categories: violationInfo.categories,
      confidence_score: violationInfo.confidence,
      action_taken: action,
    });
    
    if (error) {
      console.error('❌ Failed to log violation:', error);
    } else {
      console.log('✅ Violation logged:', violationInfo.type, violationInfo.severity);
    }
  } catch (error) {
    console.error('❌ Error logging violation:', error);
  }
}

function determineAction(severity: string): string {
  switch (severity) {
    case 'low': return 'warning';
    case 'medium': return 'suspension_24h';
    case 'high': return 'suspension_7d';
    case 'critical': return 'ban';
    default: return 'warning';
  }
}

export async function getUserViolationCount(userId: string): Promise<number> {
  try {
    const supabase = await createSupabaseClient();
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { count, error } = await supabase
      .from('violations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo);
    
    if (error) {
      console.error('❌ Failed to get violation count:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('❌ Error getting violation count:', error);
    return 0;
  }
}

// ============================================
// PROGRESSIVE SUSPENSION SYSTEM
// ============================================

export async function suspendUser(
  userId: string, 
  duration: '10m' | '1h' | '24h' | '7d' | 'permanent', 
  reason: string
) {
  try {
    const supabase = await createSupabaseClient();
    
    let suspendedUntil = null;
    let permanentBan = false;
    let status = 'suspended';
    
    if (duration === 'permanent') {
      permanentBan = true;
      status = 'banned';
      console.log('🚫 PERMANENT BAN');
    } else {
      // Calculate hours based on duration
      let hours = 0;
      if (duration === '10m') {
        hours = 10 / 60; // 10 minutes in hours
        console.log('⏸️ 10 MINUTE TIMEOUT');
      } else if (duration === '1h') {
        hours = 1;
        console.log('⏸️ 1 HOUR SUSPENSION');
      } else if (duration === '24h') {
        hours = 24;
        console.log('⏸️ 24 HOUR SUSPENSION');
      } else if (duration === '7d') {
        hours = 7 * 24;
        console.log('⏸️ 7 DAY SUSPENSION');
      }
      
      suspendedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        suspension_status: status,
        suspended_until: suspendedUntil,
        permanent_ban: permanentBan,
        ban_reason: reason,
        last_violation: new Date().toISOString(),
      })
      .eq('id', userId);
    
    if (updateError) {
      console.error('❌ Failed to suspend user:', updateError);
      return;
    }
    
    // Increment violation count
    const { error: countError } = await supabase.rpc('increment_violation_count', { user_uuid: userId });
    if (countError) {
      console.error('❌ Failed to increment violation count:', countError);
    }
    
    // Log the action
    await supabase.from('moderation_logs').insert({
      user_id: userId,
      action: duration === 'permanent' ? 'user_banned' : 'user_suspended',
      details: { duration, reason },
      performed_by: null,
    });
    
    console.log(`✅ User ${userId} ${duration === 'permanent' ? 'banned' : 'suspended for ' + duration}`);
  } catch (error) {
    console.error('❌ Error suspending user:', error);
  }
}

export async function checkUserStatus(userId: string): Promise<{
  isSuspended: boolean;
  isBanned: boolean;
  suspendedUntil?: Date;
  reason?: string;
}> {
  try {
    const supabase = await createSupabaseClient();
    
    const { data, error } = await supabase
      .from('profiles')
      .select('suspension_status, suspended_until, permanent_ban, ban_reason')
      .eq('id', userId)
      .single();
    
    if (error || !data) {
      // If profile doesn't exist, create it
      if (error?.code === 'PGRST116') {
        await supabase.from('profiles').insert({ id: userId });
      }
      return { isSuspended: false, isBanned: false };
    }
    
    if (data.permanent_ban || data.suspension_status === 'banned') {
      console.log(`🚫 User ${userId} is BANNED`);
      return {
        isSuspended: false,
        isBanned: true,
        reason: data.ban_reason || 'Violation of terms of service',
      };
    }
    
    if (data.suspension_status === 'suspended' && data.suspended_until) {
      const suspendedUntil = new Date(data.suspended_until);
      
      if (suspendedUntil > new Date()) {
        console.log(`⏸️ User ${userId} is SUSPENDED until ${suspendedUntil}`);
        return {
          isSuspended: true,
          isBanned: false,
          suspendedUntil,
          reason: data.ban_reason || 'Violation of terms of service',
        };
      } else {
        // Suspension expired
        await supabase
          .from('profiles')
          .update({ suspension_status: 'active', suspended_until: null })
          .eq('id', userId);
        
        console.log(`✅ User ${userId} suspension expired`);
        return { isSuspended: false, isBanned: false };
      }
    }
    
    return { isSuspended: false, isBanned: false };
  } catch (error) {
    console.error('❌ Error checking user status:', error);
    return { isSuspended: false, isBanned: false };
  }
}

// ============================================
// MAIN MODERATION FUNCTION
// ============================================

export interface ModerationCheckResult {
  allowed: boolean;
  reason?: string;
  violationType?: 'content' | 'jailbreak' | 'spam' | 'suspended' | 'banned';
  action?: 'warning' | 'suspension_1h' | 'suspension_24h' | 'suspension_7d' | 'ban';
  suspendedUntil?: Date;
}

export async function moderateUserMessage(
  userId: string,
  message: string
): Promise<ModerationCheckResult> {
  
  // ============================================
  // 🔥 WHITELIST - Skip moderation for admin/dev accounts
  // ============================================
  const whitelistEnv = process.env.WHITELISTED_USERS || '';
  const WHITELISTED_USERS = whitelistEnv.split(',').filter(id => id.trim().length > 0);
  
  if (WHITELISTED_USERS.includes(userId)) {
    console.log('✅ WHITELISTED USER - Bypassing moderation for testing');
    return { allowed: true };
  }
  
  // Continue with normal moderation
  console.log(`🔍 Starting moderation check for user ${userId}`);
  
  // 1. Check if user is suspended or banned
  const userStatus = await checkUserStatus(userId);
  
  if (userStatus.isBanned) {
    console.log(`🚫 BLOCKED: User is banned`);
    return {
      allowed: false,
      reason: `Your account has been permanently banned. Reason: ${userStatus.reason}`,
      violationType: 'banned',
    };
  }
  
  if (userStatus.isSuspended) {
    const timeLeft = userStatus.suspendedUntil 
      ? Math.ceil((userStatus.suspendedUntil.getTime() - Date.now()) / (1000 * 60))
      : 0;
    
    const timeUnit = timeLeft < 60 ? 'minutes' : 'hours';
    const timeDisplay = timeLeft < 60 ? timeLeft : Math.ceil(timeLeft / 60);
    
    console.log(`⏸️ BLOCKED: User is suspended for ${timeDisplay} more ${timeUnit}`);
    return {
      allowed: false,
      reason: `Your account is suspended for ${timeDisplay} more ${timeUnit}. Reason: ${userStatus.reason}`,
      violationType: 'suspended',
      suspendedUntil: userStatus.suspendedUntil,
    };
  }
  
  // 2. Check for jailbreak attempts
  const jailbreakCheck = detectJailbreak(message);
  if (jailbreakCheck.isJailbreak) {
    const violationCount = await getUserViolationCount(userId);
    
    await logViolation(userId, message, {
      type: 'jailbreak',
      severity: 'high',
      categories: ['jailbreak'],
      pattern: jailbreakCheck.pattern,
    });
    
    // PROGRESSIVE LADDER FOR JAILBREAK
    if (violationCount >= 4) {
      await suspendUser(userId, 'permanent', 'Multiple jailbreak attempts');
      return {
        allowed: false,
        reason: 'Your account has been permanently banned for repeated attempts to bypass safety measures.',
        violationType: 'jailbreak',
        action: 'ban',
      };
    } else if (violationCount === 3) {
      await suspendUser(userId, '7d', 'Repeated jailbreak attempts');
      return {
        allowed: false,
        reason: 'Your account has been suspended for 7 days for repeated attempts to bypass safety measures. This is your final warning.',
        violationType: 'jailbreak',
        action: 'suspension_7d',
      };
    } else if (violationCount === 2) {
      await suspendUser(userId, '24h', 'Jailbreak attempt');
      return {
        allowed: false,
        reason: 'Your account has been suspended for 24 hours for attempting to bypass safety measures.',
        violationType: 'jailbreak',
        action: 'suspension_24h',
      };
    } else if (violationCount === 1) {
      await suspendUser(userId, '1h', 'Jailbreak attempt');
      return {
        allowed: false,
        reason: 'Your account has been suspended for 1 hour for attempting to bypass safety measures. Please do not repeat this.',
        violationType: 'jailbreak',
        action: 'suspension_1h',
      };
    } else {
      await suspendUser(userId, '10m', 'Jailbreak attempt');
      return {
        allowed: false,
        reason: 'Your message was flagged for attempting to bypass safety measures. Your account has been temporarily restricted for 10 minutes.',
        violationType: 'jailbreak',
        action: 'warning',
      };
    }
  }
  
  // 3. Check for spam
  if (detectSpam(message)) {
    const violationCount = await getUserViolationCount(userId);
    
    await logViolation(userId, message, {
      type: 'spam',
      severity: 'low',
      categories: ['spam'],
    });
    
    // LIGHTER PENALTIES FOR SPAM
    if (violationCount >= 3) {
      await suspendUser(userId, '24h', 'Repeated spam');
      return {
        allowed: false,
        reason: 'Your account has been suspended for 24 hours for repeated spam.',
        violationType: 'spam',
        action: 'suspension_24h',
      };
    } else if (violationCount >= 1) {
      await suspendUser(userId, '1h', 'Spam detected');
      return {
        allowed: false,
        reason: 'Your account has been suspended for 1 hour. Please send meaningful messages.',
        violationType: 'spam',
        action: 'suspension_1h',
      };
    } else {
      await suspendUser(userId, '10m', 'Spam detected');
      return {
        allowed: false,
        reason: 'Your message appears to be spam. Please wait 10 minutes before sending messages.',
        violationType: 'spam',
        action: 'warning',
      };
    }
  }
  
  // 4. Check content with OpenAI Moderation API
  const moderation = await checkContentModeration(message);
  
  if (moderation.flagged) {
    const flaggedCategories = Object.entries(moderation.categories)
      .filter(([_, flagged]) => flagged)
      .map(([category]) => category);
    
    // Determine severity
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    if (flaggedCategories.some(cat => cat.includes('minors') || cat.includes('threatening'))) {
      severity = 'critical';
    } else if (flaggedCategories.some(cat => cat.includes('violence') || cat.includes('hate'))) {
      severity = 'high';
    }
    
    const violationCount = await getUserViolationCount(userId);
    
    await logViolation(userId, message, {
      type: 'content',
      severity,
      categories: flaggedCategories,
      confidence: Math.max(...Object.values(moderation.category_scores)),
    });
    
    // CRITICAL = INSTANT BAN (no warnings for serious stuff)
    if (severity === 'critical') {
      await suspendUser(userId, 'permanent', `Critical violation: ${flaggedCategories.join(', ')}`);
      console.log(`🚫 INSTANT BAN: Critical violation`);
      return {
        allowed: false,
        reason: 'Your account has been permanently banned for severe violation of our content policy.',
        violationType: 'content',
        action: 'ban',
      };
    }
    
    // PROGRESSIVE LADDER FOR OTHER CONTENT
    if (violationCount >= 4) {
      await suspendUser(userId, 'permanent', `Repeated violations: ${flaggedCategories.join(', ')}`);
      return {
        allowed: false,
        reason: 'Your account has been permanently banned for repeated violations of our content policy.',
        violationType: 'content',
        action: 'ban',
      };
    } else if (violationCount === 3) {
      await suspendUser(userId, '7d', `Multiple violations: ${flaggedCategories.join(', ')}`);
      return {
        allowed: false,
        reason: 'Your account has been suspended for 7 days. This is your final warning before a permanent ban.',
        violationType: 'content',
        action: 'suspension_7d',
      };
    } else if (violationCount === 2) {
      await suspendUser(userId, '24h', `Content violation: ${flaggedCategories.join(', ')}`);
      return {
        allowed: false,
        reason: 'Your message violates our content policy. Your account has been suspended for 24 hours.',
        violationType: 'content',
        action: 'suspension_24h',
      };
    } else if (violationCount === 1) {
      await suspendUser(userId, '1h', `Content violation: ${flaggedCategories.join(', ')}`);
      return {
        allowed: false,
        reason: 'Your message violates our content policy. Your account has been suspended for 1 hour.',
        violationType: 'content',
        action: 'suspension_1h',
      };
    } else {
      await suspendUser(userId, '10m', `Content violation: ${flaggedCategories.join(', ')}`);
      return {
        allowed: false,
        reason: 'Your message violates our content policy. Please wait 10 minutes before sending messages.',
        violationType: 'content',
        action: 'warning',
      };
    }
  }
  
  console.log(`✅ Message is CLEAN - allowing`);
  return { allowed: true };
}

// ============================================
// PROGRESSIVE PENALTY SUMMARY
// ============================================

/*
PROGRESSIVE LADDER (per violation type, 30-day window):

WHITELISTED USERS (from WHITELISTED_USERS env var):
  ✅ All moderation bypassed for testing/admin accounts

OTHER USERS:

SPAM (Lightest):
  1st → 10 min
  2nd → 1 hour
  3rd+ → 24 hours

JAILBREAK (Medium):
  1st → 10 min
  2nd → 1 hour
  3rd → 24 hours
  4th → 7 days
  5th → PERMANENT BAN

CONTENT (Standard):
  1st → 10 min
  2nd → 1 hour
  3rd → 24 hours
  4th → 7 days
  5th → PERMANENT BAN
  
  EXCEPTION: Critical severity = INSTANT PERMANENT BAN
  (minors, threats, extreme content)

All violations counted in 30-day rolling window.
*/