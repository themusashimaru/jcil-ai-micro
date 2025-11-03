// /src/lib/moderation.ts
// FULL OpenAI moderation firewall for all text, image, and file content.
// Uses omni-moderation-latest for text/files + Vision JSON policy (image-moderation.ts) for images.

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { analyzeImageContent } from './image-moderation'  // 🔴 NEW: use Vision for images

const OPENAI_API_URL = 'https://api.openai.com/v1/moderations'
const OPENAI_MODEL = 'omni-moderation-latest'

// --- Helper: Supabase server client ---
async function createSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          try { cookieStore.set(name, value, options) } catch {}
        },
        remove: (name: string, options: CookieOptions) => {
          try { cookieStore.set({ name, value: '', ...options }) } catch {}
        },
      },
    }
  )
}

// --- OpenAI Moderation (text/files) ---
export async function openAIModerate(content: string): Promise<{ flagged: boolean; categories: string[] }> {
  if (!process.env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY')

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ input: content, model: OPENAI_MODEL }),
    })

    if (!res.ok) {
      console.error('Moderation API error:', await res.text())
      return { flagged: false, categories: [] }
    }

    const data = await res.json()
    const result = data.results?.[0]
    const flagged = result?.flagged ?? false
    const cats = Object.entries(result?.categories || {})
      .filter(([_, v]) => v)
      .map(([k]) => k)
    return { flagged, categories: cats }
  } catch (err) {
    console.error('Moderation error:', err)
    return { flagged: false, categories: [] }
  }
}

// --- Local detectors ---
const PROFANITY = /\b(fuck|shit|bitch|asshole|dick|cunt|piss|mf|nigger|retard|kike|fag|rape)\b/i
const JAILBREAK = /(do anything now|ignore previous instructions|enable developer mode|pretend|system prompt)/i

export function detectJailbreak(text: string) {
  return JAILBREAK.test(text)
}

export function detectSpam(text: string) {
  const words = text.split(/\s+/)
  if (words.length > 10 && new Set(words).size / words.length < 0.3) return true
  const caps = (text.match(/[A-Z]/g) || []).length
  const letters = (text.match(/[a-zA-Z]/g) || []).length
  return letters > 10 && caps / letters > 0.7
}

// --- Supabase helpers ---
export async function logViolation(userId: string, content: string, type: string, severity: string, categories: string[]) {
  try {
    const supabase = await createSupabaseClient()
    await supabase.from('violations').insert({
      user_id: userId,
      violation_type: type,
      severity,
      message_content: content.slice(0, 500),
      flagged_categories: categories,
      action_taken: determineAction(severity),
    })
  } catch (err) {
    console.error('Error logging violation:', err)
  }
}

export async function suspendUser(userId: string, duration: '10m' | '1h' | '24h' | '7d' | 'permanent', reason: string) {
  const supabase = await createSupabaseClient()
  let until: string | null = null
  let perm = false
  let status = 'suspended'
  if (duration === 'permanent') {
    perm = true; status = 'banned'
  } else {
    const h = duration === '10m' ? 10 / 60 : duration === '1h' ? 1 : duration === '24h' ? 24 : 168
    until = new Date(Date.now() + h * 3600_000).toISOString()
  }
  await supabase.from('profiles').update({
    suspension_status: status,
    suspended_until: until,
    permanent_ban: perm,
    ban_reason: reason,
  }).eq('id', userId)
}

export async function getViolationCount(userId: string): Promise<number> {
  const supabase = await createSupabaseClient()
  const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString()
  const { count } = await supabase.from('violations').select('*', { head: true, count: 'exact' })
    .eq('user_id', userId).gte('created_at', since)
  return count ?? 0
}

export async function checkUserStatus(userId: string) {
  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('profiles')
    .select('suspension_status, suspended_until, permanent_ban, ban_reason').eq('id', userId).single()
  if (!data) return { isSuspended: false, isBanned: false }
  if (data.permanent_ban || data.suspension_status === 'banned') return { isBanned: true, reason: data.ban_reason }
  if (data.suspension_status === 'suspended' && data.suspended_until && new Date(data.suspended_until) > new Date())
    return { isSuspended: true, until: new Date(data.suspended_until), reason: data.ban_reason }
  return { isSuspended: false, isBanned: false }
}

function determineAction(severity: string) {
  return severity === 'critical' ? 'ban'
       : severity === 'high'     ? 'suspension_24h'
       : severity === 'medium'   ? 'suspension_1h'
       : 'warning'
}

// --- Main moderation entrypoint ---
// imageData should be a **data URL or https URL**; files are passed as sampled text.
export async function moderateAllContent(
  userId: string,
  text?: string,
  imageData?: string,
  fileData?: string
) {
  // Whitelist (owner/dev accounts)
  const wl = (process.env.WHITELISTED_USERS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (wl.includes(userId)) return { allowed: true }

  const status = await checkUserStatus(userId)
  if (status.isBanned)   return { allowed: false, reason: 'Banned', action: 'ban' }
  if (status.isSuspended) return { allowed: false, reason: 'Suspended', action: 'suspended' }

  const violations: string[] = []
  let maxSeverity: 'clean' | 'warning' | 'severe' | 'critical' = 'clean'

  const textToCheck = text || ''
  const shouldCheck = textToCheck.trim() !== '' || !!imageData || !!fileData
  if (!shouldCheck) return { allowed: true }

  // Local guards
  if (textToCheck) {
    if (detectSpam(textToCheck))      violations.push('spam')
    if (detectJailbreak(textToCheck)) violations.push('jailbreak')
    if (PROFANITY.test(textToCheck))  violations.push('profanity')
  }

  // OpenAI text moderation
  if (textToCheck) {
    const result = await openAIModerate(textToCheck)
    if (result.flagged) violations.push(...result.categories)
  }

  // OpenAI file moderation (sampled text)
  if (fileData) {
    const snippet = fileData.slice(0, 8000)
    const result = await openAIModerate(snippet)
    if (result.flagged) violations.push(...result.categories)
  }

  // 🔴 OpenAI Vision moderation for images (via image-moderation.ts)
  if (imageData) {
    const analysis = await analyzeImageContent(imageData); // accepts data URL or https
    if (analysis.severity !== 'clean') {
      maxSeverity = analysis.severity; // track image severity
      // If model returned explicit categories, use them; else add a generic tag
      violations.push(...(analysis.categories?.length ? analysis.categories : [`image_${analysis.severity}`]));
    }
  }

  if (violations.length === 0) return { allowed: true }

  // Severity mapping
  const categories = [...new Set(violations)]
  const severity: 'critical' | 'high' | 'medium' =
    maxSeverity === 'critical' ? 'critical' :
    (maxSeverity === 'severe' ? 'high' :
     (categories.some(c => c.includes('violence') || c.includes('hate')) ? 'high' : 'medium'))

  await logViolation(userId, textToCheck, 'content', severity, categories)

  // Progressive discipline
  if (severity === 'critical') {
    await suspendUser(userId, 'permanent', `Critical: ${categories.join(', ')}`)
    return { allowed: false, reason: 'Critical violation (banned)', action: 'ban' }
  }

  const vcount = await getViolationCount(userId)
  if (vcount >= 4) { await suspendUser(userId, '7d',  categories.join(', ')); return { allowed: false, reason: 'Suspended 7 days', action: 'suspension_7d' } }
  if (vcount >= 2) { await suspendUser(userId, '24h', categories.join(', ')); return { allowed: false, reason: 'Suspended 24h', action: 'suspension_24h' } }
  if (vcount >= 1) { await suspendUser(userId, '1h',  categories.join(', ')); return { allowed: false, reason: 'Suspended 1h',  action: 'suspension_1h' } }

  // First offense
  await suspendUser(userId, '10m', categories.join(', '))
  return { allowed: false, reason: 'Temporarily restricted 10m', action: 'warning' }
}
