// /lib/image-moderation.ts
// Comprehensive image moderation using OpenAI Vision API
// 
// ⚠️ COST WARNING: This uses OpenAI Vision API which costs ~$0.001-0.003 per image
// For high-traffic apps, consider caching results or budget monitoring

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// ============================================
// CRITICAL CATEGORIES - INSTANT BAN
// ============================================

const CRITICAL_CATEGORIES = {
  // Child Safety (HIGHEST PRIORITY)
  CSAM: 'child sexual abuse material',
  MINORS_SEXUAL: 'sexual content involving minors',
  MINORS_EXPLOITATION: 'exploitation of minors',
  
  // Extreme Violence/Gore
  EXTREME_GORE: 'extreme gore, mutilation, or graphic violence',
  DEATH_IMAGERY: 'images of death or dead bodies',
  TORTURE: 'torture or extreme suffering',
  
  // Terrorism & Extremism
  TERRORISM: 'terrorist content or propaganda',
  EXTREMISM: 'extremist ideology or recruitment',
  MASS_VIOLENCE: 'mass shooting or terrorist attack imagery',
  
  // Illegal Activities
  ILLEGAL_WEAPONS: 'illegal weapons or explosives manufacturing',
  DRUG_MANUFACTURING: 'drug production or manufacturing instructions',
  HUMAN_TRAFFICKING: 'human trafficking or slavery',
  
  // Self-Harm (Critical)
  SUICIDE_INSTRUCTIONS: 'suicide instructions or encouragement',
  SELF_HARM_GRAPHIC: 'graphic self-harm imagery',
};

// ============================================
// SEVERE CATEGORIES - 7 DAY BAN (then permanent)
// ============================================

const SEVERE_CATEGORIES = {
  // Adult Content
  PORNOGRAPHY: 'explicit sexual content or pornography',
  NUDITY: 'full nudity or sexual acts',
  
  // Violence
  GRAPHIC_VIOLENCE: 'graphic violence or blood',
  WEAPONS: 'weapons being used violently',
  
  // Disturbing Content
  ANIMAL_CRUELTY: 'animal abuse or cruelty',
  HATE_SYMBOLS: 'hate symbols or nazi imagery',
  
  // Drugs
  DRUG_USE: 'drug use or paraphernalia',
};

// ============================================
// WARNING CATEGORIES - Progressive Penalties
// ============================================

const WARNING_CATEGORIES = {
  PARTIAL_NUDITY: 'partial nudity or suggestive content',
  MILD_VIOLENCE: 'mild violence or fighting',
  DISTURBING: 'disturbing or unsettling imagery',
  PROFANITY_VISUAL: 'offensive gestures or visual profanity',
};

// ============================================
// OPENAI VISION MODERATION
// ============================================

interface ImageModerationResult {
  safe: boolean;
  severity: 'clean' | 'warning' | 'severe' | 'critical';
  categories: string[];
  reason: string;
  confidence: number;
  action: 'allow' | 'warn' | 'suspend_7d' | 'ban';
}

/**
 * Analyze image content using OpenAI Vision API
 * 
 * ⚠️ COST: ~$0.001-0.003 per image (gpt-4o-mini with low detail)
 * Budget: 1,000 images = ~$1-3 | 10,000 images = ~$10-30
 */
export async function analyzeImageContent(imageUrl: string): Promise<ImageModerationResult> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('⚠️ OPENAI_API_KEY not configured for image moderation!');
      // Default to safe if API not configured (but log warning)
      return {
        safe: true,
        severity: 'clean',
        categories: [],
        reason: 'API not configured',
        confidence: 0,
        action: 'allow',
      };
    }

    console.log('🔍 Scanning image with OpenAI Vision API...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cheaper and faster for moderation
        messages: [
          {
            role: 'system',
            content: `You are a strict content moderation AI. Analyze images for inappropriate, illegal, or harmful content.

CRITICAL VIOLATIONS (Immediate ban):
- Child sexual abuse material (CSAM) or any sexual content involving minors
- Extreme gore, mutilation, death imagery, or torture
- Terrorist content, extremist propaganda, or mass violence imagery
- Illegal weapons manufacturing or explosives
- Human trafficking or slavery imagery
- Suicide instructions or graphic self-harm
- Drug manufacturing instructions

SEVERE VIOLATIONS (7-day ban):
- Explicit pornography or sexual content
- Graphic violence with blood/weapons
- Animal cruelty or abuse
- Hate symbols (swastikas, KKK, etc.)
- Drug use or paraphernalia

WARNING VIOLATIONS (Progressive penalties):
- Partial nudity or suggestive content
- Mild violence or fighting
- Disturbing imagery
- Offensive gestures

Respond ONLY with a JSON object in this exact format:
{
  "severity": "clean" | "warning" | "severe" | "critical",
  "categories": ["category1", "category2"],
  "reason": "brief explanation",
  "confidence": 0.0-1.0
}

If the image is completely safe, return:
{
  "severity": "clean",
  "categories": [],
  "reason": "Image is safe",
  "confidence": 1.0
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image for inappropriate content. Respond ONLY with the JSON object.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'low' // Faster and cheaper for moderation
                }
              }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0, // Deterministic for moderation
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI Vision API error:', response.status, errorText);
      // Fail-safe: allow image but log error
      return {
        safe: true,
        severity: 'clean',
        categories: [],
        reason: 'API error - failed to analyze',
        confidence: 0,
        action: 'allow',
      };
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON response
    let analysis;
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI response:', content);
      return {
        safe: true,
        severity: 'clean',
        categories: [],
        reason: 'Parse error',
        confidence: 0,
        action: 'allow',
      };
    }

    // Determine action based on severity
    let action: 'allow' | 'warn' | 'suspend_7d' | 'ban' = 'allow';
    
    if (analysis.severity === 'critical') {
      action = 'ban';
      console.log('🚨 CRITICAL VIOLATION DETECTED:', analysis.categories.join(', '));
    } else if (analysis.severity === 'severe') {
      action = 'suspend_7d';
      console.log('⚠️ SEVERE VIOLATION DETECTED:', analysis.categories.join(', '));
    } else if (analysis.severity === 'warning') {
      action = 'warn';
      console.log('⚠️ WARNING VIOLATION DETECTED:', analysis.categories.join(', '));
    } else {
      console.log('✅ Image is clean');
    }

    return {
      safe: analysis.severity === 'clean',
      severity: analysis.severity,
      categories: analysis.categories || [],
      reason: analysis.reason || 'Inappropriate content detected',
      confidence: analysis.confidence || 0.8,
      action,
    };

  } catch (error) {
    console.error('❌ Image moderation failed:', error);
    // Fail-safe: allow image but log error
    return {
      safe: true,
      severity: 'clean',
      categories: [],
      reason: 'Moderation error',
      confidence: 0,
      action: 'allow',
    };
  }
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
          try { cookieStore.delete(name, options); } catch (error) { console.error(`Failed to delete cookie:`, error); }
        },
      },
    }
  );
}

// ============================================
// AUTO-DELETE FROM SUPABASE
// ============================================

/**
 * Delete image from Supabase storage
 */
export async function deleteImageFromStorage(imageUrl: string): Promise<boolean> {
  try {
    console.log('🗑️ Deleting flagged image from storage...');
    
    // Extract bucket and path from URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    
    // Find bucket and path
    const publicIndex = pathParts.indexOf('public');
    if (publicIndex === -1) {
      console.error('❌ Could not parse storage URL');
      return false;
    }
    
    const bucket = pathParts[publicIndex + 1];
    const filePath = pathParts.slice(publicIndex + 2).join('/');
    
    console.log(`🗑️ Deleting from bucket: ${bucket}, path: ${filePath}`);
    
    const supabase = await createSupabaseClient();
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);
    
    if (error) {
      console.error('❌ Failed to delete image:', error);
      return false;
    }
    
    console.log('✅ Image deleted from storage');
    return true;
  } catch (error) {
    console.error('❌ Error deleting image:', error);
    return false;
  }
}

// ============================================
// LOG IMAGE VIOLATION
// ============================================

async function logImageViolation(
  userId: string,
  imageUrl: string,
  analysis: ImageModerationResult
) {
  try {
    const supabase = await createSupabaseClient();
    
    // Determine action taken
    let actionTaken = 'warning';
    if (analysis.action === 'ban') {
      actionTaken = 'ban';
    } else if (analysis.action === 'suspend_7d') {
      actionTaken = 'suspension_7d';
    }
    
    const { error } = await supabase.from('violations').insert({
      user_id: userId,
      violation_type: 'content',
      severity: analysis.severity,
      message_content: `Image violation: ${analysis.reason} (URL was deleted)`,
      flagged_categories: analysis.categories,
      confidence_score: analysis.confidence,
      action_taken: actionTaken,
    });
    
    if (error) {
      console.error('❌ Failed to log image violation:', error);
    } else {
      console.log('✅ Image violation logged');
    }
  } catch (error) {
    console.error('❌ Error logging image violation:', error);
  }
}

// ============================================
// SUSPEND/BAN USER FOR IMAGE VIOLATION
// ============================================

async function handleImageViolation(
  userId: string,
  analysis: ImageModerationResult
) {
  try {
    const supabase = await createSupabaseClient();
    
    if (analysis.action === 'ban') {
      // INSTANT PERMANENT BAN
      console.log('🚫 BANNING user for critical image violation');
      
      await supabase
        .from('profiles')
        .update({
          suspension_status: 'banned',
          permanent_ban: true,
          ban_reason: `Critical image violation: ${analysis.categories.join(', ')}`,
          last_violation: new Date().toISOString(),
        })
        .eq('id', userId);
      
      // Log the ban
      await supabase.from('moderation_logs').insert({
        user_id: userId,
        action: 'user_banned',
        details: { 
          reason: 'critical_image_violation',
          categories: analysis.categories,
          severity: analysis.severity,
        },
        performed_by: null,
      });
      
      console.log('✅ User permanently banned');
      
    } else if (analysis.action === 'suspend_7d') {
      // 7-DAY SUSPENSION
      console.log('⏸️ Suspending user for 7 days (severe image violation)');
      
      const suspendedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      await supabase
        .from('profiles')
        .update({
          suspension_status: 'suspended',
          suspended_until: suspendedUntil,
          ban_reason: `Severe image violation: ${analysis.categories.join(', ')}`,
          last_violation: new Date().toISOString(),
        })
        .eq('id', userId);
      
      // Increment violation count
      await supabase.rpc('increment_violation_count', { user_uuid: userId });
      
      console.log('✅ User suspended for 7 days');
    }
    
  } catch (error) {
    console.error('❌ Error handling image violation:', error);
  }
}

// ============================================
// MAIN IMAGE MODERATION FUNCTION
// ============================================

export interface ImageModerationCheckResult {
  allowed: boolean;
  reason?: string;
  severity?: 'clean' | 'warning' | 'severe' | 'critical';
  categories?: string[];
  action?: 'allow' | 'warn' | 'suspend_7d' | 'ban';
}

/**
 * Complete image moderation check
 * Call this BEFORE saving image to Supabase
 */
export async function moderateImage(
  userId: string,
  imageUrl: string
): Promise<ImageModerationCheckResult> {
  
  // 🔥 WHITELIST - Skip moderation for admin/dev accounts
  const whitelistEnv = process.env.WHITELISTED_USERS || '';
  const WHITELISTED_USERS = whitelistEnv.split(',').filter(id => id.trim().length > 0);
  
  if (WHITELISTED_USERS.includes(userId)) {
    console.log('✅ WHITELISTED USER - Bypassing image moderation');
    return { allowed: true };
  }
  
  console.log(`🔍 Starting image moderation for user ${userId}`);
  
  try {
    // 1. Analyze image with OpenAI Vision
    const analysis = await analyzeImageContent(imageUrl);
    
    // 2. If clean, allow it
    if (analysis.safe) {
      console.log('✅ Image is safe - allowing');
      return { allowed: true };
    }
    
    // 3. Log the violation
    await logImageViolation(userId, imageUrl, analysis);
    
    // 4. Delete the image from storage immediately
    const deleted = await deleteImageFromStorage(imageUrl);
    if (!deleted) {
      console.error('⚠️ WARNING: Failed to delete flagged image from storage!');
    }
    
    // 5. Handle user punishment
    await handleImageViolation(userId, analysis);
    
    // 6. Return appropriate error message
    let userMessage = '';
    
    if (analysis.action === 'ban') {
      userMessage = 'Your account has been permanently banned for uploading prohibited content. This violation has been logged.';
    } else if (analysis.action === 'suspend_7d') {
      userMessage = 'Your account has been suspended for 7 days for uploading inappropriate content. The image has been removed.';
    } else {
      userMessage = 'Your image was flagged for inappropriate content and has been removed.';
    }
    
    console.log(`🚫 Image BLOCKED: ${analysis.severity} - ${analysis.reason}`);
    
    return {
      allowed: false,
      reason: userMessage,
      severity: analysis.severity,
      categories: analysis.categories,
      action: analysis.action,
    };
    
  } catch (error) {
    console.error('❌ Image moderation error:', error);
    // Fail-safe: allow image but log error
    return { allowed: true };
  }
}

// ============================================
// BATCH IMAGE MODERATION (for existing images)
// ============================================

/**
 * Scan existing images in database
 * Run this as a one-time migration or scheduled job
 * 
 * ⚠️ COST WARNING: Scanning 1,000 images = ~$1-3 in API costs
 */
export async function scanExistingImages(limit = 100): Promise<{
  scanned: number;
  flagged: number;
  deleted: number;
}> {
  console.log('🔍 Starting batch image scan...');
  
  const supabase = await createSupabaseClient();
  
  // Get messages with file URLs
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, user_id, content, file_url')
    .not('file_url', 'is', null)
    .limit(limit);
  
  if (error || !messages) {
    console.error('❌ Failed to fetch messages:', error);
    return { scanned: 0, flagged: 0, deleted: 0 };
  }
  
  let scanned = 0;
  let flagged = 0;
  let deleted = 0;
  
  for (const message of messages) {
    if (!message.file_url) continue;
    
    scanned++;
    console.log(`Scanning image ${scanned}/${messages.length}...`);
    
    const result = await moderateImage(message.user_id, message.file_url);
    
    if (!result.allowed) {
      flagged++;
      
      // Delete the flagged message
      await supabase
        .from('messages')
        .delete()
        .eq('id', message.id);
      
      deleted++;
    }
    
    // Rate limit to avoid API throttling
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`✅ Batch scan complete: ${scanned} scanned, ${flagged} flagged, ${deleted} deleted`);
  
  return { scanned, flagged, deleted };
}