/**
 * AI Service for EPCID - Client-side interface
 * 
 * SECURITY: All AI API calls are now proxied through server-side API routes
 * to keep API keys secure. This file only contains the client interface.
 */

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatResponse {
  message: string
  provider: string
  requestId?: string
}

export interface ChatContext {
  childName?: string
  childAge?: number
  symptoms?: string[]
}

// Retry configuration for resilient API calls
const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 1000 // ms

async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  retries = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options)
      
      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response
      }
      
      // Retry on server errors or rate limits
      if (response.status >= 500 || response.status === 429) {
        if (attempt < retries - 1) {
          const retryAfter = response.headers.get('Retry-After')
          const delay = retryAfter 
            ? parseInt(retryAfter) * 1000 
            : RETRY_DELAY_BASE * Math.pow(2, attempt) // Exponential backoff
          
          console.log(`Retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
      
      return response
    } catch (error) {
      if (attempt < retries - 1) {
        const delay = RETRY_DELAY_BASE * Math.pow(2, attempt)
        console.log(`Network error, retrying in ${delay}ms`, error)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
  
  throw new Error('Max retries exceeded')
}

/**
 * Main chat function - calls server-side API route
 * API keys are secure on the server
 */
export async function chat(messages: Message[], context?: ChatContext): Promise<ChatResponse> {
  try {
    const response = await fetchWithRetry('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, context }),
    })

    const data = await response.json()

    if (!response.ok) {
      // Handle specific error codes
      if (response.status === 429) {
        return {
          message: `Too many requests. Please wait ${data.retryAfter || 60} seconds before trying again.`,
          provider: 'rate-limited',
          requestId: data.requestId,
        }
      }
      
      throw new Error(data.message || 'Chat API error')
    }

    return {
      message: data.message,
      provider: data.provider,
      requestId: data.requestId,
    }
  } catch (error) {
    console.error('Chat error:', error)
    
    // Return helpful fallback message
    return {
      message: "I'm having trouble connecting to my AI services right now. For immediate medical concerns, please call your pediatrician or go to the nearest emergency room. You can also try again in a moment.",
      provider: 'fallback',
    }
  }
}

// Symptom analysis response type
export interface SymptomAnalysisResponse {
  urgency: 'low' | 'moderate' | 'high' | 'critical'
  isEmergency: boolean
  recommendation: string
  homeCareTips?: string[]
  warningSignsToWatch?: string[]
  whenToSeekCare?: string
  requestId?: string
}

/**
 * Analyze symptoms using server-side API
 */
export async function analyzeSymptoms(
  childName: string,
  childAge: number,
  symptoms: string[],
  vitals?: { 
    temperature?: number
    heart_rate?: number
    respiratory_rate?: number
    oxygen_saturation?: number
  },
  additionalNotes?: string
): Promise<SymptomAnalysisResponse> {
  try {
    const response = await fetchWithRetry('/api/symptoms/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childName,
        childAge,
        symptoms,
        vitals,
        additionalNotes,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Symptom analysis failed')
    }

    return data
  } catch (error) {
    console.error('Symptom analysis error:', error)
    
    // Return safe default
    return {
      urgency: 'moderate',
      isEmergency: false,
      recommendation: 'Unable to analyze symptoms. Please consult your pediatrician for evaluation.',
      warningSignsToWatch: [
        'Difficulty breathing',
        'High fever that won\'t reduce',
        'Unusual drowsiness or confusion',
        'Refusal to drink fluids',
      ],
      whenToSeekCare: 'Contact your pediatrician if you have concerns about your child\'s symptoms.',
    }
  }
}

// Voice transcription using browser's Web Speech API
export function startVoiceRecording(
  onResult: (transcript: string) => void,
  onError: (error: string) => void
): { stop: () => void } | null {
  if (typeof window === 'undefined') return null
  
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  
  if (!SpeechRecognition) {
    onError('Voice recognition not supported in this browser')
    return null
  }

  const recognition = new SpeechRecognition()
  recognition.continuous = false
  recognition.interimResults = true
  recognition.lang = 'en-US'

  let finalTranscript = ''

  recognition.onresult = (event: any) => {
    let interimTranscript = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript
      if (event.results[i].isFinal) {
        finalTranscript += transcript
      } else {
        interimTranscript += transcript
      }
    }
    onResult(finalTranscript || interimTranscript)
  }

  recognition.onerror = (event: any) => {
    onError(event.error)
  }

  recognition.start()

  return {
    stop: () => {
      recognition.stop()
    }
  }
}

// Image analysis prompt generator
export function generateImageAnalysisPrompt(imageType: string, description: string): string {
  return `A parent has shared a photo of their child's ${imageType}. They describe it as: "${description}"

Please provide:
1. General observations based on the description
2. Common causes for similar presentations
3. Home care recommendations
4. When to see a doctor
5. Any red flags to watch for

Remember: This is not a diagnosis. Always recommend professional evaluation for concerning symptoms.`
}

// Dosage calculation response type
export interface DosageResponse {
  medication: string
  recommendedDose: {
    mg: number
    description: string
  }
  byForm: Array<{
    form: string
    amount: string
  }>
  frequency: string
  maxDailyDose: string
  warnings: string[]
  contraindications: string[]
  isContraindicated: boolean
  contraindicationReason?: string
  disclaimer: string
  requestId?: string
}

/**
 * Calculate medication dosage using server-side API
 */
export async function calculateDosage(
  medication: string,
  childWeightLbs: number,
  childAge: number,
  medicalConditions?: string[]
): Promise<DosageResponse> {
  try {
    const response = await fetchWithRetry('/api/dosage/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        medication,
        weightLbs: childWeightLbs,
        ageYears: childAge,
        medicalConditions,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Dosage calculation failed')
    }

    return data
  } catch (error) {
    console.error('Dosage calculation error:', error)
    
    // Return safe fallback
    return {
      medication,
      recommendedDose: { mg: 0, description: 'Unable to calculate' },
      byForm: [],
      frequency: 'Consult your pediatrician',
      maxDailyDose: 'Consult your pediatrician',
      warnings: ['Unable to calculate dosage. Please consult your pediatrician or pharmacist.'],
      contraindications: [],
      isContraindicated: false,
      disclaimer: 'Always consult your pediatrician or pharmacist before giving any medication to your child.',
    }
  }
}

// Emergency assessment
export async function assessEmergency(symptoms: string[]): Promise<{
  isEmergency: boolean
  urgency: 'low' | 'moderate' | 'high' | 'critical'
  recommendation: string
}> {
  const emergencyKeywords = [
    'not breathing', 'difficulty breathing', 'blue lips', 'blue skin',
    'seizure', 'convulsion', 'unresponsive', 'unconscious',
    'severe bleeding', 'head injury', 'neck injury',
    'poisoning', 'swallowed', 'overdose',
    'high fever', 'stiff neck', 'rash that doesn\'t fade',
    'severe allergic reaction', 'swelling throat', 'anaphylaxis'
  ]

  const symptomText = symptoms.join(' ').toLowerCase()
  const hasEmergencyKeyword = emergencyKeywords.some(keyword => 
    symptomText.includes(keyword.toLowerCase())
  )

  if (hasEmergencyKeyword) {
    return {
      isEmergency: true,
      urgency: 'critical',
      recommendation: 'Call 911 immediately or go to the nearest emergency room. These symptoms require urgent medical attention.'
    }
  }

  // Use AI for non-obvious cases
  const response = await chat([{
    role: 'user',
    content: `Quickly assess urgency level for these pediatric symptoms: ${symptoms.join(', ')}. 
    Respond with only: LOW, MODERATE, HIGH, or CRITICAL followed by a one-sentence recommendation.`
  }])

  const responseText = response.message.toUpperCase()
  let urgency: 'low' | 'moderate' | 'high' | 'critical' = 'moderate'
  
  if (responseText.includes('CRITICAL')) urgency = 'critical'
  else if (responseText.includes('HIGH')) urgency = 'high'
  else if (responseText.includes('LOW')) urgency = 'low'

  return {
    isEmergency: urgency === 'critical',
    urgency,
    recommendation: response.message
  }
}

export default { chat, analyzeSymptoms, startVoiceRecording, calculateDosage, assessEmergency }
