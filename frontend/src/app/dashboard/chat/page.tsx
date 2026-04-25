'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Mic,
  MicOff,
  Send,
  Camera,
  CameraOff,
  Video,
  Eye,
  Bot,
  User,
  Sparkles,
  X,
  Volume2,
  Loader2,
  Zap,
  Clock,
  Calculator,
  CheckCircle,
  Thermometer,
  Bell,
  Pill,
  TrendingUp,
  Heart,
  AlertTriangle,
  Phone,
  FileText,
  Radio,
  PhoneOff,
} from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import type { VitalReading, SymptomEntry, Medication, DoseLog } from '@/store/useStore'
import useStore from '@/store/useStore'
import { chat, startVoiceRecording, Message as AIMessage } from '@/lib/ai'
import { VoiceTriageSession, type VoiceTriageStatus, type VoiceTriageCallbacks } from '@/lib/voiceTriage'

// Action types that can be embedded in messages
type ActionType = 
  | 'set_reminder' 
  | 'calculate_dosage' 
  | 'log_vital' 
  | 'log_symptom'
  | 'view_trends'
  | 'call_nurse'
  | 'export_report'

interface MessageAction {
  type: ActionType
  label: string
  icon: typeof Clock
  data?: any
  completed?: boolean
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  attachments?: { type: 'image' | 'audio'; url: string; name: string }[]
  isStreaming?: boolean
  provider?: string
  actions?: MessageAction[]
  systemNote?: string // For auto-logged vitals confirmation
}

// Extract vitals from user message
function extractVitals(message: string): { type: string; value: number; unit: string } | null {
  // Temperature patterns
  const tempPattern = /(?:fever|temperature|temp)\s*(?:of|is|at|:)?\s*(\d{2,3}(?:\.\d)?)\s*(?:°?F|degrees?)?/i
  const tempMatch = message.match(tempPattern)
  if (tempMatch) {
    return { type: 'temperature', value: parseFloat(tempMatch[1]), unit: '°F' }
  }

  // Direct temperature pattern
  const directTempPattern = /(\d{2,3}(?:\.\d)?)\s*(?:°F|degrees?\s*f)/i
  const directMatch = message.match(directTempPattern)
  if (directMatch) {
    return { type: 'temperature', value: parseFloat(directMatch[1]), unit: '°F' }
  }

  // Heart rate patterns
  const hrPattern = /(?:heart\s*rate|pulse|hr|bpm)\s*(?:of|is|at|:)?\s*(\d{2,3})/i
  const hrMatch = message.match(hrPattern)
  if (hrMatch) {
    return { type: 'heart_rate', value: parseInt(hrMatch[1]), unit: 'bpm' }
  }

  // Oxygen patterns
  const o2Pattern = /(?:oxygen|o2|spo2|saturation)\s*(?:of|is|at|:)?\s*(\d{2,3})\s*%?/i
  const o2Match = message.match(o2Pattern)
  if (o2Match) {
    return { type: 'oxygen', value: parseInt(o2Match[1]), unit: '%' }
  }

  return null
}

// Extract symptoms from message
function extractSymptoms(message: string): string[] {
  const symptomKeywords = [
    'fever', 'cough', 'coughing', 'runny nose', 'congestion', 'sore throat',
    'headache', 'nausea', 'vomiting', 'diarrhea', 'rash', 'fatigue', 'tired',
    'stomach ache', 'belly ache', 'ear ache', 'earache', 'constipation'
  ]
  
  const found: string[] = []
  const lowerMessage = message.toLowerCase()
  
  for (const symptom of symptomKeywords) {
    if (lowerMessage.includes(symptom)) {
      found.push(symptom.charAt(0).toUpperCase() + symptom.slice(1))
    }
  }
  
  return found
}

// Generate contextual actions based on AI response
function generateActions(response: string, userMessage: string): MessageAction[] {
  const actions: MessageAction[] = []
  const lowerResponse = response.toLowerCase()
  const lowerUserMsg = userMessage.toLowerCase()

  // Check for temperature monitoring mentions
  if (lowerResponse.includes('monitor') && (lowerResponse.includes('temp') || lowerResponse.includes('fever'))) {
    actions.push({
      type: 'set_reminder',
      label: 'Set 1-Hour Reminder',
      icon: Bell,
      data: { minutes: 60, reason: 'Check temperature' }
    })
  }

  // Check for medication/dosage mentions
  if (lowerResponse.includes('acetaminophen') || lowerResponse.includes('tylenol') || 
      lowerResponse.includes('ibuprofen') || lowerResponse.includes('advil') ||
      lowerResponse.includes('dosage') || lowerResponse.includes('medication')) {
    actions.push({
      type: 'calculate_dosage',
      label: 'Calculate Safe Dosage',
      icon: Calculator,
    })
  }

  // Check if fever was mentioned - suggest logging
  if ((lowerUserMsg.includes('fever') || lowerUserMsg.includes('temperature')) && 
      !actions.some(a => a.type === 'log_vital')) {
    const vital = extractVitals(userMessage)
    if (vital) {
      actions.push({
        type: 'log_vital',
        label: `Log ${vital.value}${vital.unit} to Health Trends`,
        icon: TrendingUp,
        data: vital
      })
    }
  }

  // Check for concerning symptoms - suggest nurse call
  if (lowerResponse.includes('seek medical') || lowerResponse.includes('call your doctor') ||
      lowerResponse.includes('healthcare provider') || lowerResponse.includes('emergency')) {
    actions.push({
      type: 'call_nurse',
      label: 'Connect with Nurse',
      icon: Phone,
    })
  }

  // Always offer to view trends if discussing symptoms
  if (lowerResponse.includes('monitor') || lowerResponse.includes('track') || lowerResponse.includes('watch')) {
    actions.push({
      type: 'view_trends',
      label: 'View Health Trends',
      icon: TrendingUp,
    })
  }

  return actions.slice(0, 4) // Max 4 actions
}

const suggestedPrompts = [
  "My child has a fever of 101°F - should I be worried?",
  "What are warning signs I should watch for?",
  "When should I take my child to the ER?",
  "How do I know if it's just a cold or something serious?",
]

export default function ChatPage() {
  const { 
    selectedChild, 
    addVitalReading, 
    addSymptomEntry,
    vitalReadings,
    medications,
  } = useStore()
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: selectedChild
        ? `👋 Welcome to **EPCID** - Early Pediatric Critical Illness Detection!

I'm your AI-powered pediatric health assistant, here to help you monitor **${selectedChild.name}**'s health and detect early warning signs of illness.

**How I can help:**
• 🩺 Assess symptoms and identify potential concerns
• ⚠️ Flag early warning signs that need attention  
• 🏠 Provide home care guidance for common conditions
• 📋 Help you prepare for healthcare visits
• 💊 Answer questions about medications and dosing

**Smart Features:**
• 📊 I'll automatically log vitals you mention to ${selectedChild.name}'s health trends
• ⏰ I can set reminders to check on symptoms
• 📱 Quick actions to calculate dosages or connect with care

**Important:** I'm not a doctor and can't diagnose conditions. For emergencies, always seek medical care immediately.

How can I help you today?`
        : `👋 Welcome to **EPCID** - Early Pediatric Critical Illness Detection!

I'm your AI-powered pediatric health assistant designed to help parents identify early warning signs of serious illness in children.

**Please select a child** from the sidebar to get started with personalized health monitoring.

Once you've added a child profile, I can help you:
• Assess symptoms and risk levels
• Provide age-appropriate care guidance
• Track health trends over time
• Prepare for healthcare visits`,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [reminders, setReminders] = useState<Array<{ id: string; time: Date; reason: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const voiceRecognitionRef = useRef<{ stop: () => void } | null>(null)

  const startRecording = () => {
    setIsRecording(true)
    setInput('')
    
    const recognition = startVoiceRecording(
      (transcript) => {
        setInput(transcript)
      },
      (error) => {
        console.error('Voice recognition error:', error)
        setIsRecording(false)
        if (error === 'Voice recognition not supported in this browser') {
          const mockTranscripts = [
            "My child has a fever and runny nose",
            "She's been coughing for two days",
            "He has a rash on his arm",
          ]
          setInput(mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)])
        }
      }
    )
    
    if (recognition) {
      voiceRecognitionRef.current = recognition
    } else {
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    if (voiceRecognitionRef.current) {
      voiceRecognitionRef.current.stop()
    }
    setIsRecording(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments([...attachments, ...files])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  const [aiProvider, setAiProvider] = useState<string>('')

  // ── Voice Triage (Gemini Live API) state ──
  const [voiceMode, setVoiceMode] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<VoiceTriageStatus>('idle')
  const [voiceTranscript, setVoiceTranscript] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([])
  const [audioLevel, setAudioLevel] = useState(0)
  const [cameraActive, setCameraActive] = useState(false)
  const voiceSessionRef = useRef<VoiceTriageSession | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraPreviewRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number>(0)

  const startVoiceTriage = useCallback(async () => {
    setVoiceTranscript([])
    setVoiceMode(true)
    setVoiceStatus('connecting')

    try {
      const res = await fetch('/api/voice-session', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Could not start voice session')
      }
      const { apiKey } = await res.json()

      const callbacks: VoiceTriageCallbacks = {
        onStatusChange: (s) => setVoiceStatus(s),
        onTranscriptUpdate: (role, text) => {
          setVoiceTranscript((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.role === role) {
              return [...prev.slice(0, -1), { role, text: last.text + text }]
            }
            return [...prev, { role, text }]
          })
        },
        onAudioLevel: (level) => setAudioLevel(level),
        onError: (msg) => {
          console.error('[VoiceTriage]', msg)
        },
        onCameraChange: (active) => setCameraActive(active),
      }

      const session = new VoiceTriageSession(callbacks)
      voiceSessionRef.current = session

      const childCtx = selectedChild
        ? `Child: ${selectedChild.name}, age context available`
        : undefined

      await session.start(apiKey, childCtx)
      setAiProvider('gemini-live')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Voice triage failed'
      console.error(message)
      setVoiceStatus('error')
    }
  }, [selectedChild])

  const toggleCamera = useCallback(async () => {
    const session = voiceSessionRef.current
    if (!session) return
    if (session.cameraActive) {
      session.disableCamera()
      if (cameraPreviewRef.current) cameraPreviewRef.current.innerHTML = ''
    } else {
      const videoEl = await session.enableCamera()
      if (videoEl && cameraPreviewRef.current) {
        videoEl.style.width = '100%'
        videoEl.style.height = '100%'
        videoEl.style.objectFit = 'cover'
        videoEl.style.borderRadius = '0.75rem'
        cameraPreviewRef.current.innerHTML = ''
        cameraPreviewRef.current.appendChild(videoEl)
      }
    }
  }, [])

  const stopVoiceTriage = useCallback(() => {
    if (cameraPreviewRef.current) cameraPreviewRef.current.innerHTML = ''
    voiceSessionRef.current?.stop()
    voiceSessionRef.current = null
    setVoiceMode(false)
    setVoiceStatus('idle')
    setAudioLevel(0)
    setCameraActive(false)
  }, [])

  // Waveform animation
  useEffect(() => {
    if (!voiceMode || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let phase = 0
    const draw = () => {
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      const amplitude = Math.min(audioLevel * 800, h / 2.5)
      const barCount = 48
      const barW = w / barCount - 2

      for (let i = 0; i < barCount; i++) {
        const x = i * (barW + 2)
        const barH = Math.max(4, amplitude * Math.abs(Math.sin((i + phase) * 0.3)))
        const gradient = ctx.createLinearGradient(x, h / 2 - barH / 2, x, h / 2 + barH / 2)

        if (voiceStatus === 'ai_speaking') {
          gradient.addColorStop(0, 'rgba(99,102,241,0.8)')
          gradient.addColorStop(1, 'rgba(168,85,247,0.4)')
        } else {
          gradient.addColorStop(0, 'rgba(6,182,212,0.8)')
          gradient.addColorStop(1, 'rgba(20,184,166,0.4)')
        }

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.roundRect(x, h / 2 - barH / 2, barW, barH, 2)
        ctx.fill()
      }

      phase += 0.15
      animFrameRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [voiceMode, audioLevel, voiceStatus])

  // Handle action button clicks
  const handleAction = (messageId: string, action: MessageAction) => {
    switch (action.type) {
      case 'set_reminder':
        const reminderTime = new Date(Date.now() + (action.data?.minutes || 60) * 60 * 1000)
        setReminders(prev => [...prev, { 
          id: Date.now().toString(), 
          time: reminderTime, 
          reason: action.data?.reason || 'Health check' 
        }])
        // Mark action as completed
        setMessages(prev => prev.map(msg => 
          msg.id === messageId
            ? {
                ...msg,
                actions: msg.actions?.map(a => 
                  a.type === action.type ? { ...a, completed: true, label: `Reminder set for ${reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` } : a
                )
              }
            : msg
        ))
        break

      case 'log_vital':
        if (selectedChild && action.data) {
          addVitalReading({
            id: `vital-${Date.now()}`,
            child_id: selectedChild.id,
            type: action.data.type as any,
            value: action.data.value,
            unit: action.data.unit,
            timestamp: new Date().toISOString(),
            source: 'manual',
          })
          // Mark as completed
          setMessages(prev => prev.map(msg => 
            msg.id === messageId
              ? {
                  ...msg,
                  actions: msg.actions?.map(a => 
                    a.type === action.type ? { ...a, completed: true, label: `✓ Logged to ${selectedChild.name}'s trends` } : a
                  )
                }
              : msg
          ))
        }
        break

      case 'calculate_dosage':
        // Navigate to dosage calculator
        window.location.href = '/dashboard/dosage'
        break

      case 'call_nurse':
        window.location.href = '/dashboard/telehealth'
        break

      case 'view_trends':
        window.location.href = '/dashboard/trends'
        break

      case 'export_report':
        window.location.href = '/dashboard/reports'
        break
    }
  }

  const sendMessage = async () => {
    if (!input.trim() && attachments.length === 0) return

    const userContent = input.trim()
    
    // Extract vitals from user message for auto-logging
    const extractedVital = extractVitals(userContent)
    const extractedSymptoms = extractSymptoms(userContent)
    
    // Auto-log vital if detected
    let systemNote = ''
    if (extractedVital && selectedChild) {
      addVitalReading({
        id: `vital-${Date.now()}`,
        child_id: selectedChild.id,
        type: extractedVital.type as any,
        value: extractedVital.value,
        unit: extractedVital.unit,
        timestamp: new Date().toISOString(),
        source: 'manual',
      })
      systemNote = `✓ Logged ${extractedVital.value}${extractedVital.unit} ${extractedVital.type === 'temperature' ? 'fever' : extractedVital.type} to ${selectedChild.name}'s Health Trends`
    }
    
    // Auto-log symptoms if detected
    if (extractedSymptoms.length > 0 && selectedChild) {
      addSymptomEntry({
        id: `symptom-${Date.now()}`,
        child_id: selectedChild.id,
        symptoms: extractedSymptoms.map(s => ({ name: s, severity: 2 })),
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      if (systemNote) {
        systemNote += ` • Logged symptoms: ${extractedSymptoms.join(', ')}`
      } else {
        systemNote = `✓ Logged symptoms to ${selectedChild.name}'s record: ${extractedSymptoms.join(', ')}`
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
      timestamp: new Date(),
      attachments: attachments.map(file => ({
        type: file.type.startsWith('image/') ? 'image' : 'audio',
        url: URL.createObjectURL(file),
        name: file.name,
      })),
      systemNote: systemNote || undefined,
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setAttachments([])
    setShowSuggestions(false)

    // Add streaming placeholder message
    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }

    setMessages(prev => [...prev, assistantMessage])

    // Build conversation history for AI
    const conversationHistory: AIMessage[] = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    
    // Add context about the child if selected
    let contextualMessage = userContent
    if (selectedChild) {
      const recentVitals = vitalReadings
        .filter((v: VitalReading) => v.child_id === selectedChild.id)
        .slice(0, 5)
        .map((v: VitalReading) => `${v.type}: ${v.value}${v.unit} at ${new Date(v.timestamp).toLocaleTimeString()}`)
        .join(', ')
      
      contextualMessage = `[Context: This is about ${selectedChild.name}${selectedChild.medical_conditions?.length ? `, who has: ${selectedChild.medical_conditions.join(', ')}` : ''}${selectedChild.allergies?.length ? `. Allergies: ${selectedChild.allergies.join(', ')}` : ''}${recentVitals ? `. Recent vitals: ${recentVitals}` : ''}]\n\n${userContent}`
    }
    
    conversationHistory.push({ role: 'user', content: contextualMessage })

    try {
      // Call real AI
      const response = await chat(conversationHistory)
      setAiProvider(response.provider)
      
      // Generate contextual actions
      const actions = generateActions(response.message, userContent)
      
      // Simulate streaming effect for the response
      const fullResponse = response.message
      for (let i = 0; i <= fullResponse.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 8))
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: fullResponse.slice(0, i) }
              : msg
          )
        )
      }

      // Mark streaming as complete and add actions
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, isStreaming: false, provider: response.provider, actions }
            : msg
        )
      )
    } catch (error) {
      console.error('AI chat error:', error)
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { 
                ...msg, 
                content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment, or contact your healthcare provider for urgent concerns.",
                isStreaming: false 
              }
            : msg
        )
      )
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Chat Header */}
      <div className="flex items-center justify-between pb-4 border-b border-surface-200 dark:border-surface-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
              EPCID Assistant
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                Online
              </span>
              {aiProvider && (
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                  aiProvider === 'gemini-live'
                    ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                    : 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                }`}>
                  {aiProvider === 'gemini-live' ? <Radio className="w-3 h-3 animate-pulse" /> : <Zap className="w-3 h-3" />}
                  {aiProvider === 'gemini-live' ? 'Gemini Live' : aiProvider}
                </span>
              )}
            </h2>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              {selectedChild 
                ? `Smart Health Assistant for ${selectedChild.name}` 
                : 'Early Pediatric Critical Illness Detection'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {reminders.length > 0 && (
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
              <Bell className="w-3 h-3" />
              {reminders.length} Reminder{reminders.length > 1 ? 's' : ''}
            </span>
          )}
          {isRecording && (
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 text-xs animate-pulse">
              <Mic className="w-3 h-3" />
              Listening...
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6">
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}
            >
              {message.role === 'assistant' && (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              
              <div className={`max-w-[80%] ${message.role === 'user' ? 'order-first' : ''}`}>
                {/* System note for auto-logged data */}
                {message.systemNote && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-2 px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{message.systemNote}</span>
                  </motion.div>
                )}

                <div
                  className={`
                    rounded-2xl px-4 py-3
                    ${message.role === 'user'
                      ? 'bg-primary-500 text-white rounded-tr-none'
                      : 'glass text-surface-800 dark:text-surface-200 rounded-tl-none'
                    }
                  `}
                >
                  {/* Attachments */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {message.attachments.map((attachment, i) => (
                        <div
                          key={i}
                          className="relative w-24 h-24 rounded-lg overflow-hidden bg-surface-100 dark:bg-surface-800"
                        >
                          {attachment.type === 'image' ? (
                            <img
                              src={attachment.url}
                              alt={attachment.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Volume2 className="w-8 h-8 text-surface-500" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Message content */}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                    {message.isStreaming && (
                      <span className="inline-block w-2 h-4 ml-1 bg-primary-400 animate-pulse" />
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                {message.actions && message.actions.length > 0 && !message.isStreaming && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-wrap gap-2 mt-3"
                  >
                    {message.actions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => handleAction(message.id, action)}
                        disabled={action.completed}
                        className={`
                          flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all
                          ${action.completed
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white border border-surface-300 dark:border-surface-700'
                          }
                        `}
                      >
                        <action.icon className="w-4 h-4" />
                        {action.label}
                      </button>
                    ))}
                  </motion.div>
                )}
                
                <div className={`text-xs text-surface-500 mt-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {message.role === 'user' && (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Suggested Prompts */}
        {showSuggestions && messages.length === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-2 justify-center mt-8"
          >
            {suggestedPrompts.map((prompt, i) => (
                <button
                key={i}
                onClick={() => {
                  setInput(prompt)
                  setShowSuggestions(false)
                }}
                className="px-4 py-2 glass rounded-full text-sm text-surface-700 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-95 transform"
              >
                <Sparkles className="w-3 h-3 inline mr-2" />
                {prompt}
              </button>
            ))}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Voice + Vision Triage Panel ── */}
      <AnimatePresence>
        {voiceMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-surface-200 dark:border-surface-800"
          >
            <div className="py-4 space-y-4">
              {/* Status + Camera Badge */}
              <div className="flex items-center justify-center gap-3">
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                  voiceStatus === 'listening'
                    ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400'
                    : voiceStatus === 'ai_speaking'
                    ? 'bg-purple-500/20 text-purple-700 dark:text-purple-400'
                    : voiceStatus === 'connecting'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                    : voiceStatus === 'error'
                    ? 'bg-red-500/20 text-red-700 dark:text-red-400'
                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                }`}>
                  {voiceStatus === 'listening' && <><span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" /> Listening...</>}
                  {voiceStatus === 'ai_speaking' && <><span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" /> AI Speaking...</>}
                  {voiceStatus === 'connecting' && <><Loader2 className="w-4 h-4 animate-spin" /> Connecting...</>}
                  {voiceStatus === 'processing' && <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>}
                  {voiceStatus === 'error' && <>Connection Error</>}
                  {voiceStatus === 'ended' && <>Session Ended</>}
                  {voiceStatus === 'idle' && <>Ready</>}
                </span>
                {cameraActive && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                    <Eye className="w-3 h-3" />
                    Vision Active
                  </span>
                )}
              </div>

              {/* Camera Preview + Waveform */}
              <div className="flex items-center justify-center gap-4">
                {cameraActive && (
                  <div
                    ref={cameraPreviewRef}
                    className="w-40 h-30 rounded-xl overflow-hidden bg-surface-900 border-2 border-emerald-500/40 flex-shrink-0"
                    style={{ aspectRatio: '4/3' }}
                  />
                )}
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={60}
                  className={`rounded-lg bg-surface-100 dark:bg-surface-900/50 ${cameraActive ? 'w-48' : 'w-full max-w-md'}`}
                />
              </div>

              {/* Transcript */}
              {voiceTranscript.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-2 px-4">
                  {voiceTranscript.map((entry, i) => (
                    <div key={i} className={`text-sm ${entry.role === 'user' ? 'text-cyan-700 dark:text-cyan-400' : 'text-purple-700 dark:text-purple-400'}`}>
                      <span className="font-semibold">{entry.role === 'user' ? 'You: ' : 'AI: '}</span>
                      {entry.text}
                    </div>
                  ))}
                </div>
              )}

              {/* Controls */}
              <div className="flex justify-center gap-3">
                <button
                  onClick={toggleCamera}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all font-medium ${
                    cameraActive
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 border border-surface-300 dark:border-surface-700'
                  }`}
                >
                  {cameraActive ? <CameraOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  {cameraActive ? 'Turn Off Camera' : 'Show Symptom on Camera'}
                </button>
                <button
                  onClick={stopVoiceTriage}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30 transition-all font-medium"
                >
                  <PhoneOff className="w-5 h-5" />
                  End Session
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex gap-2 pb-3 overflow-x-auto">
          {attachments.map((file, i) => (
            <div
              key={i}
              className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-surface-100 dark:bg-surface-800 group"
            >
              {file.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Volume2 className="w-8 h-8 text-surface-500" />
                </div>
              )}
              <button
                onClick={() => removeAttachment(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-surface-200 dark:border-surface-800 pt-4">
        {/* Voice Triage CTA */}
        {!voiceMode && (
          <div className="flex justify-center mb-3">
            <button
              onClick={startVoiceTriage}
              className="group flex items-center gap-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600/20 to-cyan-600/20 border border-purple-500/30 hover:border-purple-500/60 text-surface-900 dark:text-white transition-all hover:shadow-lg hover:shadow-purple-500/10"
            >
              <div className="relative">
                <Radio className="w-5 h-5 text-purple-500 dark:text-purple-400 group-hover:text-purple-600 dark:group-hover:text-purple-300" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <span className="text-sm font-medium">Talk to EPCID</span>
              <span className="text-xs text-surface-500">Gemini Live</span>
            </button>
          </div>
        )}

        <div className="flex items-end gap-3">
          {/* Attachment Buttons */}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-xl glass text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90"
              title="Upload image"
              disabled={voiceMode}
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={isProcessing ? 'Processing voice...' : 'Describe symptoms or ask a question...'}
              disabled={isProcessing}
              rows={1}
              className="w-full px-4 py-3 pr-12 rounded-xl bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none transition-all disabled:opacity-50"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            {isProcessing && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />
              </div>
            )}
          </div>

          {/* Voice Button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`
              p-3 rounded-xl transition-all
              ${isRecording
                ? 'bg-red-500 text-white recording-pulse'
                : 'glass text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
              }
              disabled:opacity-50
            `}
            title={isRecording ? 'Stop recording' : 'Start voice input'}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Send Button */}
          <Button
            onClick={sendMessage}
            disabled={(!input.trim() && attachments.length === 0) || isProcessing}
            className="px-4"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>

        {/* Recording Indicator */}
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 mt-3 text-red-600 dark:text-red-400"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Recording... Click the microphone to stop
          </motion.div>
        )}

        <p className="text-xs text-surface-600 dark:text-surface-400 text-center mt-3 px-2">
          EPCID helps identify early warning signs but is NOT a diagnostic tool. Vitals mentioned are automatically logged. Always consult healthcare professionals. Call 911 for emergencies.
        </p>
      </div>
    </div>
  )
}
