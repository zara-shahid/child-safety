/**
 * Voice Session API Route
 *
 * Provides the Gemini API key to authenticated clients for
 * client-side Gemini Live API connections. In production this
 * would issue short-lived tokens; for the hackathon demo we
 * pass the key directly with rate-limiting protection.
 */

import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW = 60 * 1000

function checkRateLimit(id: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(id)
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(id, { count: 1, resetTime: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

export async function POST(request: NextRequest) {
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'anonymous'

  if (!checkRateLimit(clientIp)) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Too many voice session requests.' },
      { status: 429 },
    )
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'NOT_CONFIGURED', message: 'Gemini API key is not configured on the server.' },
      { status: 503 },
    )
  }

  return NextResponse.json({
    apiKey: GEMINI_API_KEY,
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    expiresIn: 900,
  })
}
