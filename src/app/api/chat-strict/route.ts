// /src/app/api/chat-strict/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import OpenAI from 'openai'
import { moderateAllContent } from '@/lib/moderation'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeInput, containsSuspiciousContent } from '@/lib/sanitize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const XAI_BASE_URL = 'https://api.x.ai/v1'
const MODEL = 'grok-4-fast-reasoning'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n: string) => cookieStore.get(n)?.value,
        set: (n: string, v: string, o: CookieOptions) => { try { cookieStore.set(n, v, o) } catch {} },
        remove: (n: string, o: CookieOptions) => { try { cookieStore.set({ name: n, value: '', ...o }) } catch {} },
      },
    }
  )

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = rateLimit(user.id, { maxRequests: 20, windowMs: 60000 })
    if (!rl.success)
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const { messages, conversationId, fileUrl, fileMimeType } = await req.json()
    if (!Array.isArray(messages) || !messages.length)
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 })
    if (!conversationId)
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 })

    const last = messages[messages.length - 1]
    const text = typeof last?.content === 'string' ? last.content : ''
    if (!text) return NextResponse.json({ error: 'Empty message' }, { status: 400 })
    if (containsSuspiciousContent(text)) return NextResponse.json({ error: 'Suspicious content' }, { status: 400 })
    const sanitized = sanitizeInput(text)

    // fetch image data if attached
    let imageBase64: string | undefined
    if (fileUrl && fileMimeType?.startsWith('image/')) {
      const res = await fetch(fileUrl)
      const arr = Buffer.from(await res.arrayBuffer()).toString('base64')
      imageBase64 = `data:${fileMimeType};base64,${arr}`
    }

    // --- MODERATION FIRST ---
    const moderation = await moderateAllContent(user.id, sanitized, imageBase64)
    if (!moderation.allowed)
      return NextResponse.json({ error: moderation.reason, action: moderation.action }, { status: 403 })

    // save user message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: 'user',
      content: sanitized,
      file_url: fileUrl || null,
      file_type: fileMimeType || null,
    })

    // --- GROK Chat ---
    const xai = new OpenAI({
      apiKey: process.env.XAI_API_KEY!,
      baseURL: XAI_BASE_URL,
    })

    const completion = await xai.chat.completions.create({
      model: MODEL,
      messages: messages,
      stream: true,
    })

    const stream = completion.toReadableStream()

    ;(async () => {
      const buffer: string[] = []
      for await (const chunk of completion) {
        const delta = chunk?.choices?.[0]?.delta?.content
        if (delta) buffer.push(delta)
      }
      const text = buffer.join('')
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: sanitizeInput(text),
      })
    })()

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
