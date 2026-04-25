/**
 * Server-side Symptom Analysis API Route
 * 
 * Analyzes symptoms and provides urgency assessment
 * with safety checks for emergency keywords.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

// Emergency keywords that require immediate escalation
const EMERGENCY_KEYWORDS = [
  'not breathing', 'difficulty breathing', 'can\'t breathe', 'gasping',
  'blue lips', 'blue skin', 'turning blue', 'cyanosis',
  'seizure', 'convulsion', 'fitting', 'shaking uncontrollably',
  'unresponsive', 'unconscious', 'won\'t wake up', 'limp',
  'severe bleeding', 'head injury', 'neck injury', 'spine injury',
  'poisoning', 'swallowed', 'overdose', 'ingested',
  'high fever infant', 'fever newborn', 'fever under 3 months',
  'stiff neck', 'rash that doesn\'t fade', 'petechiae', 'purple spots',
  'severe allergic reaction', 'swelling throat', 'anaphylaxis', 'can\'t swallow',
  'chest pain', 'heart racing', 'irregular heartbeat',
]

interface SymptomAnalysisRequest {
  childName: string
  childAge: number // in years
  symptoms: string[]
  vitals?: {
    temperature?: number
    heart_rate?: number
    respiratory_rate?: number
    oxygen_saturation?: number
  }
  duration?: string
  additionalNotes?: string
}

interface SymptomAnalysisResponse {
  urgency: 'low' | 'moderate' | 'high' | 'critical'
  isEmergency: boolean
  recommendation: string
  homeCareTips?: string[]
  warningSignsToWatch?: string[]
  whenToSeekCare?: string
  requestId: string
}

function checkForEmergencyKeywords(symptoms: string[], notes?: string): boolean {
  const allText = [...symptoms, notes || ''].join(' ').toLowerCase()
  return EMERGENCY_KEYWORDS.some(keyword => allText.includes(keyword.toLowerCase()))
}

function getAgeSpecificContext(ageYears: number): string {
  if (ageYears < 0.25) { // Under 3 months
    return 'CRITICAL AGE GROUP: Infant under 3 months. Any fever (≥100.4°F/38°C) requires immediate medical evaluation. Lower threshold for all symptoms.'
  } else if (ageYears < 1) {
    return 'Infant 3-12 months. Fever >102°F warrants medical attention. Watch for feeding difficulties, lethargy, and breathing changes.'
  } else if (ageYears < 2) {
    return 'Toddler 1-2 years. Cannot reliably communicate symptoms. Watch behavior changes, activity level, and appetite.'
  } else if (ageYears < 5) {
    return 'Preschool age. May exaggerate or minimize symptoms. Correlate reported symptoms with observed behavior.'
  } else {
    return 'School-age child. Can usually describe symptoms. Verify with objective signs.'
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    const body: SymptomAnalysisRequest = await request.json()

    // Validate required fields
    if (!body.childName || body.childAge === undefined || !body.symptoms?.length) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'childName, childAge, and symptoms are required.',
        },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      )
    }

    // Check for emergency keywords first
    if (checkForEmergencyKeywords(body.symptoms, body.additionalNotes)) {
      return NextResponse.json<SymptomAnalysisResponse>(
        {
          urgency: 'critical',
          isEmergency: true,
          recommendation: '🚨 EMERGENCY: Seek medical care immediately at the nearest hospital or emergency room. The symptoms described may indicate a life-threatening condition that requires immediate medical attention.',
          warningSignsToWatch: [
            'Any worsening of breathing',
            'Loss of consciousness',
            'Seizure activity',
            'Skin color changes (blue, grey, mottled)',
          ],
          requestId,
        },
        { status: 200, headers: { 'X-Request-ID': requestId } }
      )
    }

    // Build analysis prompt
    const ageContext = getAgeSpecificContext(body.childAge)
    const vitalsInfo = body.vitals ? `
Vital Signs:
- Temperature: ${body.vitals.temperature ? `${body.vitals.temperature}°F` : 'Not provided'}
- Heart Rate: ${body.vitals.heart_rate ? `${body.vitals.heart_rate} bpm` : 'Not provided'}
- Respiratory Rate: ${body.vitals.respiratory_rate ? `${body.vitals.respiratory_rate}/min` : 'Not provided'}
- Oxygen Saturation: ${body.vitals.oxygen_saturation ? `${body.vitals.oxygen_saturation}%` : 'Not provided'}
` : ''

    const prompt = `Analyze these pediatric symptoms and provide a structured assessment.

Patient: ${body.childName}, ${body.childAge} years old
${ageContext}

Symptoms: ${body.symptoms.join(', ')}
Duration: ${body.duration || 'Not specified'}
${vitalsInfo}
Additional Notes: ${body.additionalNotes || 'None'}

Provide a JSON response with EXACTLY this structure:
{
  "urgency": "low" | "moderate" | "high" | "critical",
  "recommendation": "One paragraph main recommendation",
  "homeCareTips": ["tip1", "tip2", "tip3"],
  "warningSignsToWatch": ["sign1", "sign2", "sign3"],
  "whenToSeekCare": "Specific guidance on when to see a doctor"
}

Rules:
- Be conservative - when in doubt, recommend professional evaluation
- For infants <3 months with any fever, always recommend immediate evaluation
- For breathing difficulties, always escalate to high/critical
- Provide practical, actionable home care tips
- List specific warning signs that would warrant escalation`

    // Try Gemini (via GenAI SDK) first, then Groq, then static fallback
    let analysisText: string

    if (GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
        const geminiResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: 'You are a pediatric triage assistant. Analyze symptoms and provide structured JSON responses. Always prioritize safety and recommend professional evaluation when in doubt.\n\n' + prompt,
          config: {
            temperature: 0.3,
            maxOutputTokens: 800,
            responseMimeType: 'application/json',
          },
        })
        analysisText = geminiResponse.text || ''
        if (!analysisText) throw new Error('Empty Gemini response')
      } catch (geminiErr) {
        console.warn(`[${requestId}] Gemini symptom analysis failed:`, geminiErr)
        analysisText = ''
      }
    } else {
      analysisText = ''
    }

    if (!analysisText && GROQ_API_KEY) {
      try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'You are a pediatric triage assistant. Analyze symptoms and provide structured JSON responses. Always prioritize safety and recommend professional evaluation when in doubt.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 800,
            response_format: { type: 'json_object' },
          }),
        })
        if (!groqResponse.ok) throw new Error(`Groq: ${groqResponse.status}`)
        const groqData = await groqResponse.json()
        analysisText = groqData.choices[0].message.content
      } catch (groqErr) {
        console.warn(`[${requestId}] Groq symptom analysis failed:`, groqErr)
        analysisText = ''
      }
    }

    if (!analysisText) {
      return NextResponse.json<SymptomAnalysisResponse>(
        {
          urgency: 'moderate',
          isEmergency: false,
          recommendation: 'Based on the symptoms described, we recommend consulting with your pediatrician for proper evaluation. While waiting, keep your child comfortable and well-hydrated.',
          homeCareTips: [
            'Keep child comfortable and rested',
            'Ensure adequate fluid intake',
            'Monitor temperature every 4 hours',
            'Note any changes in symptoms',
          ],
          warningSignsToWatch: [
            'Difficulty breathing or rapid breathing',
            'Refusal to drink fluids',
            'Unusual drowsiness or irritability',
            'Rash that doesn\'t fade when pressed',
            'Fever lasting more than 3 days',
          ],
          whenToSeekCare: 'Contact your pediatrician if symptoms worsen or don\'t improve within 24-48 hours, or immediately if any warning signs develop.',
          requestId,
        },
        { status: 200, headers: { 'X-Request-ID': requestId } }
      )
    }

    // Parse AI response
    let analysis
    try {
      analysis = JSON.parse(analysisText)
    } catch {
      // If JSON parsing fails, extract what we can
      analysis = {
        urgency: 'moderate',
        recommendation: analysisText,
        homeCareTips: [],
        warningSignsToWatch: [],
        whenToSeekCare: 'Contact your pediatrician if symptoms worsen.',
      }
    }

    // Validate urgency level
    const validUrgencies = ['low', 'moderate', 'high', 'critical']
    if (!validUrgencies.includes(analysis.urgency)) {
      analysis.urgency = 'moderate'
    }

    return NextResponse.json<SymptomAnalysisResponse>(
      {
        urgency: analysis.urgency,
        isEmergency: analysis.urgency === 'critical',
        recommendation: analysis.recommendation,
        homeCareTips: analysis.homeCareTips || [],
        warningSignsToWatch: analysis.warningSignsToWatch || [],
        whenToSeekCare: analysis.whenToSeekCare || 'Contact your pediatrician if symptoms persist or worsen.',
        requestId,
      },
      { status: 200, headers: { 'X-Request-ID': requestId } }
    )

  } catch (error) {
    console.error(`[${requestId}] Symptom analysis error:`, error)
    
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'Unable to analyze symptoms. For immediate concerns, please contact your pediatrician or go to the emergency room.',
        requestId,
      },
      { status: 500, headers: { 'X-Request-ID': requestId } }
    )
  }
}
