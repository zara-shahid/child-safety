/**
 * Server-side AI Chat API Route
 * 
 * This keeps API keys secure on the server side and provides:
 * - Rate limiting per user
 * - Request validation
 * - Error handling with safe responses
 * - Fallback between providers
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

// API keys are now server-side only (not exposed to client)
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

// Rate limiting (simple in-memory, use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 30 // requests per minute
const RATE_WINDOW = 60 * 1000 // 1 minute

// Medical system prompt for EPCID
const PEDIATRIC_SYSTEM_PROMPT = `You are the EPCID Assistant - Early Pediatric Critical Illness Detection AI.

Your PRIMARY PURPOSE is to help parents identify EARLY WARNING SIGNS of serious illness in children before they become critical. You support, not replace, clinical judgment.

CORE MISSION:
- Help detect early signs of serious pediatric conditions (sepsis, meningitis, respiratory distress, etc.)
- Guide parents on when symptoms require urgent attention vs. home care
- Reduce delays in seeking care for conditions that can deteriorate rapidly
- Provide clear, actionable guidance based on evidence-based pediatric protocols

CRITICAL SAFETY RULES:
1. You are NOT a diagnostic tool - never diagnose conditions
2. ALWAYS recommend professional evaluation for concerning symptoms
3. For RED FLAG symptoms, IMMEDIATELY advise seeking emergency medical care:
   - Difficulty breathing, blue lips/skin
   - Unresponsive or extremely difficult to wake
   - Seizures or convulsions
   - Severe allergic reaction (throat swelling)
   - Stiff neck with fever
   - Petechiae (tiny purple/red spots that don't fade)
   - High fever (>104°F/40°C) in infants

COMMUNICATION STYLE:
- Be warm, empathetic, and reassuring
- Use clear, simple language (avoid medical jargon)
- Acknowledge parental anxiety is valid
- Always explain the "why" behind recommendations
- Format responses with clear sections and bullet points

Remember: Early detection saves lives. When in doubt, always err on the side of seeking professional care.`

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatRequest {
  messages: Message[]
  context?: {
    childName?: string
    childAge?: number
    symptoms?: string[]
  }
}

// Check rate limit
function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_WINDOW })
    return { allowed: true, remaining: RATE_LIMIT - 1, resetIn: RATE_WINDOW }
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetIn: entry.resetTime - now }
  }

  entry.count++
  return { allowed: true, remaining: RATE_LIMIT - entry.count, resetIn: entry.resetTime - now }
}

// Call Groq API
async function chatWithGroq(messages: Message[]): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key not configured')
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: PEDIATRIC_SYSTEM_PROMPT },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Groq API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// Call OpenRouter API (fallback)
async function chatWithOpenRouter(messages: Message[]): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured')
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://epcid.app',
      'X-Title': 'EPCID Pediatric Health',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.2-3b-instruct:free',
      messages: [
        { role: 'system', content: PEDIATRIC_SYSTEM_PROMPT },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// Call Google Gemini API via official GenAI SDK (primary)
async function chatWithGemini(messages: Message[]): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured')
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

  const contents = [
    {
      role: 'user' as const,
      parts: [{ text: PEDIATRIC_SYSTEM_PROMPT }],
    },
    {
      role: 'model' as const,
      parts: [{ text: 'Understood. I am the EPCID Assistant, ready to help parents detect early warning signs of serious illness in children. I will follow all safety rules and communicate with warmth and clarity. How can I help?' }],
    },
    ...messages.map((msg) => ({
      role: (msg.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: msg.content }],
    })),
  ]

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      topP: 0.95,
    },
  })

  const text = response.text
  if (!text) {
    throw new Error('Gemini returned empty response')
  }
  return text
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  try {
    // Get client identifier for rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'anonymous'

    // Check rate limit
    const rateLimit = checkRateLimit(clientIp)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'RATE_LIMITED',
          message: 'Too many requests. Please wait a moment before trying again.',
          retryAfter: Math.ceil(rateLimit.resetIn / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)),
            'X-RateLimit-Remaining': '0',
            'X-Request-ID': requestId,
          }
        }
      )
    }

    // Parse and validate request
    const body: ChatRequest = await request.json()

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Messages array is required and must not be empty.',
        },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      )
    }

    // Validate message format
    for (const msg of body.messages) {
      if (!msg.role || !msg.content || typeof msg.content !== 'string') {
        return NextResponse.json(
          {
            error: 'VALIDATION_ERROR',
            message: 'Each message must have a role and content.',
          },
          { status: 400, headers: { 'X-Request-ID': requestId } }
        )
      }
    }

    // Enhance messages with context if provided
    let messages = body.messages
    if (body.context) {
      const contextInfo: string[] = []
      if (body.context.childName) contextInfo.push(`Child's name: ${body.context.childName}`)
      if (body.context.childAge) contextInfo.push(`Age: ${body.context.childAge} years`)
      if (body.context.symptoms?.length) contextInfo.push(`Current symptoms: ${body.context.symptoms.join(', ')}`)

      if (contextInfo.length > 0) {
        messages = [
          { role: 'system' as const, content: `Context: ${contextInfo.join('. ')}` },
          ...messages
        ]
      }
    }

    // Try Gemini first, then Groq, then OpenRouter
    let response: string
    let provider: string

    try {
      response = await chatWithGemini(messages)
      provider = 'gemini'
    } catch (geminiError) {
      console.warn(`[${requestId}] Gemini failed, trying Groq:`, geminiError)

      try {
        response = await chatWithGroq(messages)
        provider = 'groq'
      } catch (groqError) {
        console.warn(`[${requestId}] Groq failed, trying OpenRouter:`, groqError)

        try {
          response = await chatWithOpenRouter(messages)
          provider = 'openrouter'
        } catch (openRouterError) {
          console.error(`[${requestId}] All providers failed:`, openRouterError)

          return NextResponse.json(
            {
              message: "I'm having trouble connecting to my AI services right now. For immediate medical concerns, please call your pediatrician or seek care at the nearest emergency room. You can also try again in a moment.",
              provider: 'fallback',
              requestId,
            },
            {
              status: 200,
              headers: {
                'X-Request-ID': requestId,
                'X-RateLimit-Remaining': String(rateLimit.remaining),
              }
            }
          )
        }
      }
    }

    const duration = Date.now() - startTime

    return NextResponse.json(
      {
        message: response,
        provider,
        requestId,
      },
      {
        status: 200,
        headers: {
          'X-Request-ID': requestId,
          'X-Response-Time': `${duration}ms`,
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        }
      }
    )

  } catch (error) {
    console.error(`[${requestId}] Chat API error:`, error)

    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again.',
        requestId,
      },
      { status: 500, headers: { 'X-Request-ID': requestId } }
    )
  }
}

// Handle other methods
export async function GET() {
  return NextResponse.json(
    { error: 'METHOD_NOT_ALLOWED', message: 'Use POST to send chat messages.' },
    { status: 405 }
  )
}
