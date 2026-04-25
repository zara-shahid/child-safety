'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Thermometer,
  Clock,
  Pill,
  AlertTriangle,
  Moon,
  Sun,
  ChevronLeft,
  Heart,
  Wind,
  Volume2,
  VolumeX,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Mic,
  MicOff,
  Lightbulb,
  CheckCircle,
  X,
} from 'lucide-react'
import useStore from '@/store/useStore'

// Calculate velocity from readings
function getVelocity(readings: Array<{ value: number; timestamp: string }>, type: 'temp' | 'hr' | 'o2') {
  if (readings.length < 2) return 'stable'
  const sorted = [...readings].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const latest = sorted[0].value
  const previous = sorted[1].value
  const change = latest - previous
  
  const thresholds = { temp: 0.5, hr: 10, o2: 2 }
  const threshold = thresholds[type]
  
  if (type === 'o2') {
    // For O2, dropping is bad
    if (change <= -threshold) return 'falling'
    if (change >= threshold) return 'rising'
  } else {
    if (change >= threshold) return 'rising'
    if (change <= -threshold) return 'falling'
  }
  return 'stable'
}

export default function NightVitalsPage() {
  const { 
    selectedChild, 
    vitalReadings, 
    doseLogs, 
    medications,
    detectedEvents,
    addVitalReading,
  } = useStore()
  
  const [currentTime, setCurrentTime] = useState(new Date())
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [softLightMode, setSoftLightMode] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceConfirmation, setVoiceConfirmation] = useState<{ type: string; value: string } | null>(null)
  const recognitionRef = useRef<any>(null)

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])
  
  // Clear voice confirmation after 3 seconds
  useEffect(() => {
    if (voiceConfirmation) {
      const timeout = setTimeout(() => {
        setVoiceConfirmation(null)
        setVoiceTranscript('')
      }, 3000)
      return () => clearTimeout(timeout)
    }
  }, [voiceConfirmation])
  
  // Whisper Mode - Voice Recognition
  const startWhisperMode = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input not supported. Try Chrome or Safari.')
      return
    }
    
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    
    recognition.onstart = () => setIsListening(true)
    
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('')
      setVoiceTranscript(transcript)
      
      // Parse temperature from speech
      if (event.results[0].isFinal) {
        const tempMatch = transcript.match(/(\d{2,3}(?:\.\d)?)/i)
        if (tempMatch) {
          const temp = parseFloat(tempMatch[1])
          if (temp >= 95 && temp <= 108) {
            // Log the temperature
            if (selectedChild) {
              addVitalReading({
                id: `vital_${Date.now()}`,
                child_id: selectedChild.id,
                type: 'temperature',
                value: temp,
                unit: '°F',
                timestamp: new Date().toISOString(),
                source: 'manual',
              })
              setVoiceConfirmation({ type: 'temperature', value: `${temp}°F` })
            }
          }
        }
      }
    }
    
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    
    recognition.start()
  }
  
  const stopWhisperMode = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }
  
  // Format time ago for readings
  const formatTimeAgo = (timestamp: string) => {
    const mins = Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60))
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    return `${hours}h ago`
  }

  // Get latest temperature reading
  const latestTemp = vitalReadings
    .filter(r => r.child_id === selectedChild?.id && r.type === 'temperature')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

  const latestHeartRate = vitalReadings
    .filter(r => r.child_id === selectedChild?.id && r.type === 'heart_rate')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

  const latestOxygen = vitalReadings
    .filter(r => r.child_id === selectedChild?.id && r.type === 'oxygen')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

  // Get last medication dose
  const lastDose = doseLogs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
  
  const lastMed = lastDose ? medications.find(m => m.id === lastDose.medicationId) : null
  
  // Calculate time since last dose
  const timeSinceLastDose = lastDose 
    ? Math.floor((Date.now() - new Date(lastDose.timestamp).getTime()) / (1000 * 60))
    : null

  // Calculate next dose time
  const nextDoseTime = lastDose && lastMed
    ? new Date(new Date(lastDose.timestamp).getTime() + lastMed.intervalHours * 60 * 60 * 1000)
    : null

  const minutesToNextDose = nextDoseTime
    ? Math.max(0, Math.floor((nextDoseTime.getTime() - Date.now()) / (1000 * 60)))
    : null

  // Check for pending alerts
  const pendingAlerts = detectedEvents.filter(
    e => e.status === 'pending' && e.child_id === selectedChild?.id && e.threshold_exceeded
  )

  // Determine if temperature is concerning
  const tempValue = latestTemp?.value || 98.6
  const isFever = typeof tempValue === 'number' && tempValue > 100.4
  const isHighFever = typeof tempValue === 'number' && tempValue > 102

  // Soft Light Mode - warm peach/cream color at low brightness
  const softLightStyle = softLightMode ? {
    backgroundColor: '#fff5e6',
    color: '#8b7355',
  } : {}

  return (
    <div 
      className={`fixed inset-0 overflow-hidden transition-all duration-500 ${
        softLightMode ? '' : 'bg-black text-white'
      }`}
      style={softLightMode ? softLightStyle : {}}
    >
      {/* Voice Confirmation Toast */}
      <AnimatePresence>
        {voiceConfirmation && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-green-500 text-white shadow-lg">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Logged {voiceConfirmation.value}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${
        softLightMode ? 'border-amber-200' : 'border-gray-800'
      }`}>
        <Link href="/dashboard" className={`flex items-center gap-2 transition-colors ${
          softLightMode ? 'text-amber-700 hover:text-amber-900' : 'text-gray-400 hover:text-white'
        }`}>
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </Link>
        
        <div className="flex items-center gap-3">
          {/* Whisper Mode Button */}
          <button
            onClick={isListening ? stopWhisperMode : startWhisperMode}
            className={`p-2 rounded-lg transition-all ${
              isListening 
                ? 'bg-cyan-500 text-white animate-pulse' 
                : softLightMode
                  ? 'hover:bg-amber-200 text-amber-700'
                  : 'hover:bg-gray-800 text-gray-400'
            }`}
            title="Whisper Mode - Say temperature"
          >
            {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          
          {/* Soft Light Toggle */}
          <button
            onClick={() => setSoftLightMode(!softLightMode)}
            className={`p-2 rounded-lg transition-colors ${
              softLightMode 
                ? 'bg-amber-300 text-amber-800' 
                : 'hover:bg-gray-800 text-gray-400'
            }`}
            title="Night Light"
          >
            <Lightbulb className="w-5 h-5" />
          </button>
          
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg transition-colors ${
              softLightMode ? 'hover:bg-amber-200' : 'hover:bg-gray-800'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className={`w-5 h-5 ${softLightMode ? 'text-cyan-600' : 'text-cyan-400'}`} />
            ) : (
              <VolumeX className={`w-5 h-5 ${softLightMode ? 'text-amber-600' : 'text-gray-500'}`} />
            )}
          </button>
          
          <div className={`flex items-center gap-2 ${softLightMode ? 'text-amber-700' : 'text-cyan-400'}`}>
            {softLightMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span className="text-sm font-medium hidden sm:inline">
              {softLightMode ? 'Night Light' : 'Night Mode'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Whisper Mode Active Indicator */}
      {isListening && (
        <div className={`px-4 py-2 text-center ${softLightMode ? 'bg-amber-100' : 'bg-gray-900'}`}>
          <span className={`text-sm ${softLightMode ? 'text-amber-700' : 'text-cyan-400'}`}>
            🎤 Listening... say "temp is 101.2" or just the number
          </span>
          {voiceTranscript && (
            <span className={`ml-2 ${softLightMode ? 'text-amber-600' : 'text-gray-400'}`}>
              "{voiceTranscript}"
            </span>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className={`h-[calc(100vh-${isListening ? '100px' : '60px'})] flex flex-col items-center justify-center p-8 overflow-y-auto`}>
        {/* Child Name */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className={`text-2xl font-light ${softLightMode ? 'text-amber-600' : 'text-gray-400'}`}>
            {selectedChild?.name || 'No Child Selected'}
          </h1>
        </motion.div>

        {/* Current Time */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-10"
        >
          <div className={`text-6xl sm:text-8xl font-light tabular-nums ${
            softLightMode ? 'text-amber-800' : 'text-gray-300'
          }`}>
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </motion.div>

        {/* Alert Banner */}
        {pendingAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 w-full max-w-md"
          >
            <div className="p-4 rounded-xl bg-red-900/50 border border-red-500 animate-pulse">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <span className="text-red-300 font-medium">
                  {pendingAlerts.length} Alert{pendingAlerts.length > 1 ? 's' : ''} Pending Review
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Vitals Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl mb-10">
          {/* Temperature */}
          {(() => {
            const tempReadings = vitalReadings
              .filter(r => r.child_id === selectedChild?.id && r.type === 'temperature')
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            const velocity = getVelocity(tempReadings, 'temp')
            
            const getTempBgColor = () => {
              if (softLightMode) {
                if (isHighFever) return 'bg-red-100 border-red-400'
                if (isFever) return 'bg-orange-100 border-orange-400'
                return 'bg-amber-50 border-amber-200'
              }
              if (isHighFever) return 'bg-red-900/30 border-red-500'
              if (isFever) return 'bg-orange-900/30 border-orange-500'
              return 'bg-gray-900/50 border-gray-700'
            }
            
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`
                  p-6 rounded-2xl border-2 text-center relative
                  ${getTempBgColor()}
                `}
              >
                {/* Velocity indicator */}
                {velocity !== 'stable' && (
                  <div className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                    velocity === 'rising' 
                      ? softLightMode ? 'bg-red-200 text-red-700' : 'bg-red-500/30 text-red-300' 
                      : softLightMode ? 'bg-green-200 text-green-700' : 'bg-green-500/30 text-green-300'
                  }`}>
                    {velocity === 'rising' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {velocity === 'rising' ? 'Rising' : 'Falling'}
                  </div>
                )}
                
                <Thermometer className={`w-8 h-8 mx-auto mb-3 ${
                  isHighFever 
                    ? softLightMode ? 'text-red-500' : 'text-red-400' 
                    : isFever 
                    ? softLightMode ? 'text-orange-500' : 'text-orange-400' 
                    : softLightMode ? 'text-amber-500' : 'text-gray-400'
                }`} />
                <div className={`text-5xl font-bold mb-1 ${
                  isHighFever 
                    ? softLightMode ? 'text-red-600' : 'text-red-400' 
                    : isFever 
                    ? softLightMode ? 'text-orange-600' : 'text-orange-400' 
                    : softLightMode ? 'text-amber-900' : 'text-white'
                }`}>
                  {tempValue}°F
                </div>
                <div className={`text-sm ${softLightMode ? 'text-amber-600' : 'text-gray-500'}`}>Temperature</div>
                {latestTemp && (
                  <div className={`text-xs mt-2 ${softLightMode ? 'text-amber-500' : 'text-gray-600'}`}>
                    {formatTimeAgo(latestTemp.timestamp)}
                  </div>
                )}
              </motion.div>
            )
          })()}

          {/* Heart Rate - Only show if data exists */}
          {latestHeartRate ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`p-6 rounded-2xl border-2 text-center ${
                softLightMode 
                  ? 'bg-amber-50 border-amber-200' 
                  : 'bg-gray-900/50 border-gray-700'
              }`}
            >
              <Heart className={`w-8 h-8 mx-auto mb-3 ${softLightMode ? 'text-pink-500' : 'text-pink-400'}`} />
              <div className={`text-5xl font-bold mb-1 ${softLightMode ? 'text-amber-900' : 'text-white'}`}>
                {latestHeartRate.value}
              </div>
              <div className={`text-sm ${softLightMode ? 'text-amber-600' : 'text-gray-500'}`}>Heart Rate (bpm)</div>
              <div className={`text-xs mt-2 ${softLightMode ? 'text-amber-500' : 'text-gray-600'}`}>
                {formatTimeAgo(latestHeartRate.timestamp)}
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`p-6 rounded-2xl border-2 border-dashed text-center ${
                softLightMode 
                  ? 'bg-amber-50/50 border-amber-200' 
                  : 'bg-gray-900/30 border-gray-800'
              }`}
            >
              <Heart className={`w-8 h-8 mx-auto mb-3 ${softLightMode ? 'text-amber-300' : 'text-gray-700'}`} />
              <div className={`text-lg font-medium mb-1 ${softLightMode ? 'text-amber-400' : 'text-gray-600'}`}>
                No Data
              </div>
              <div className={`text-xs ${softLightMode ? 'text-amber-400' : 'text-gray-700'}`}>
                Connect wearable or log manually
              </div>
            </motion.div>
          )}

          {/* Oxygen - Only show if data exists */}
          {latestOxygen ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`p-6 rounded-2xl border-2 text-center ${
                softLightMode 
                  ? 'bg-amber-50 border-amber-200' 
                  : 'bg-gray-900/50 border-gray-700'
              }`}
            >
              <Wind className={`w-8 h-8 mx-auto mb-3 ${softLightMode ? 'text-blue-500' : 'text-blue-400'}`} />
              <div className={`text-5xl font-bold mb-1 ${softLightMode ? 'text-amber-900' : 'text-white'}`}>
                {latestOxygen.value}%
              </div>
              <div className={`text-sm ${softLightMode ? 'text-amber-600' : 'text-gray-500'}`}>Oxygen Saturation</div>
              <div className={`text-xs mt-2 ${softLightMode ? 'text-amber-500' : 'text-gray-600'}`}>
                {formatTimeAgo(latestOxygen.timestamp)}
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`p-6 rounded-2xl border-2 border-dashed text-center ${
                softLightMode 
                  ? 'bg-amber-50/50 border-amber-200' 
                  : 'bg-gray-900/30 border-gray-800'
              }`}
            >
              <Wind className={`w-8 h-8 mx-auto mb-3 ${softLightMode ? 'text-amber-300' : 'text-gray-700'}`} />
              <div className={`text-lg font-medium mb-1 ${softLightMode ? 'text-amber-400' : 'text-gray-600'}`}>
                No Data
              </div>
              <div className={`text-xs ${softLightMode ? 'text-amber-400' : 'text-gray-700'}`}>
                Connect pulse oximeter
              </div>
            </motion.div>
          )}
        </div>

        {/* Medication Status - The "3 AM Answer" */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-md"
        >
          {lastMed && timeSinceLastDose !== null ? (
            // Has medication history - show clear status
            <div className={`
              p-6 rounded-2xl border-2 
              ${minutesToNextDose !== null && minutesToNextDose <= 0
                ? softLightMode 
                  ? 'bg-green-100 border-green-400' 
                  : 'bg-green-900/30 border-green-500'
                : minutesToNextDose !== null && minutesToNextDose <= 30
                  ? softLightMode 
                    ? 'bg-amber-100 border-amber-400' 
                    : 'bg-amber-900/30 border-amber-500'
                  : softLightMode 
                    ? 'bg-amber-50 border-amber-200' 
                    : 'bg-gray-900/50 border-gray-700'
              }
            `}>
              {/* Primary Status - Big & Clear */}
              <div className="text-center mb-4">
                {minutesToNextDose !== null && minutesToNextDose <= 0 ? (
                  <>
                    <div className={`text-2xl font-bold mb-1 ${
                      softLightMode ? 'text-green-700' : 'text-green-400'
                    }`}>
                      ✓ Safe to Give Meds
                    </div>
                    <div className={`text-sm ${softLightMode ? 'text-green-600' : 'text-green-300'}`}>
                      Last dose was {Math.floor(timeSinceLastDose / 60)}h {timeSinceLastDose % 60}m ago
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`text-2xl font-bold mb-1 ${
                      softLightMode ? 'text-amber-700' : 'text-amber-400'
                    }`}>
                      Wait {Math.floor((minutesToNextDose || 0) / 60)}h {(minutesToNextDose || 0) % 60}m
                    </div>
                    <div className={`text-sm ${softLightMode ? 'text-amber-600' : 'text-amber-300'}`}>
                      Next dose at {nextDoseTime?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </>
                )}
              </div>
              
              {/* Medication Details */}
              <div className={`flex items-center gap-4 p-3 rounded-xl ${
                softLightMode ? 'bg-white/50' : 'bg-black/30'
              }`}>
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center
                  ${lastMed.color || (softLightMode ? 'bg-amber-200' : 'bg-gray-800')}
                `}>
                  <Pill className="w-6 h-6 text-white" />
                </div>
                
                <div className="flex-1">
                  <div className={`font-medium ${softLightMode ? 'text-amber-900' : 'text-white'}`}>
                    {lastMed.name.split('(')[0].trim()}
                  </div>
                  <div className={`text-sm ${softLightMode ? 'text-amber-600' : 'text-gray-400'}`}>
                    {lastDose?.dosage} • Given {Math.floor(timeSinceLastDose / 60) > 0 
                      ? `${Math.floor(timeSinceLastDose / 60)}h ${timeSinceLastDose % 60}m ago`
                      : `${timeSinceLastDose}m ago`
                    }
                  </div>
                </div>
              </div>
              
              {/* Quick Action if Safe */}
              {minutesToNextDose !== null && minutesToNextDose <= 0 && (
                <Link href="/dashboard/medications" className="block mt-4">
                  <button className={`w-full py-3 rounded-xl font-medium transition-colors ${
                    softLightMode 
                      ? 'bg-green-500 hover:bg-green-600 text-white' 
                      : 'bg-green-600 hover:bg-green-500 text-white'
                  }`}>
                    Log Dose Now
                  </button>
                </Link>
              )}
            </div>
          ) : (
            // No medication history - helpful empty state
            <div className={`
              p-6 rounded-2xl border-2 border-dashed text-center
              ${softLightMode ? 'bg-amber-50/50 border-amber-200' : 'bg-gray-900/30 border-gray-800'}
            `}>
              <Pill className={`w-10 h-10 mx-auto mb-3 ${softLightMode ? 'text-amber-300' : 'text-gray-600'}`} />
              <div className={`text-lg font-medium mb-2 ${softLightMode ? 'text-amber-700' : 'text-gray-400'}`}>
                No Medications Logged
              </div>
              <div className={`text-sm mb-4 ${softLightMode ? 'text-amber-500' : 'text-gray-500'}`}>
                Log a dose to track when the next one is safe
              </div>
              <Link href="/dashboard/medications">
                <button className={`px-6 py-2 rounded-xl font-medium transition-colors ${
                  softLightMode 
                    ? 'bg-amber-200 hover:bg-amber-300 text-amber-800' 
                    : 'bg-gray-800 hover:bg-gray-700 text-white'
                }`}>
                  Log First Dose
                </button>
              </Link>
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-4"
        >
          <Link href="/dashboard/medications">
            <button className={`px-6 py-3 rounded-xl font-medium transition-colors ${
              softLightMode 
                ? 'bg-amber-200 hover:bg-amber-300 text-amber-800' 
                : 'bg-gray-800 hover:bg-gray-700 text-white'
            }`}>
              Log Dose
            </button>
          </Link>
          <Link href="/dashboard/symptom-checker">
            <button className={`px-6 py-3 rounded-xl font-medium transition-colors ${
              softLightMode 
                ? 'bg-amber-200 hover:bg-amber-300 text-amber-800' 
                : 'bg-gray-800 hover:bg-gray-700 text-white'
            }`}>
              Log Symptom
            </button>
          </Link>
          <button 
            onClick={startWhisperMode}
            className={`px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
              softLightMode 
                ? 'bg-cyan-200 hover:bg-cyan-300 text-cyan-800' 
                : 'bg-cyan-900 hover:bg-cyan-800 text-cyan-200'
            }`}
          >
            <Mic className="w-4 h-4" />
            Whisper Temp
          </button>
        </motion.div>
      </div>

      {/* Footer */}
      <div className={`fixed bottom-0 left-0 right-0 p-4 ${
        softLightMode 
          ? 'bg-gradient-to-t from-amber-50 to-transparent' 
          : 'bg-gradient-to-t from-black to-transparent'
      }`}>
        <div className={`text-center text-xs ${softLightMode ? 'text-amber-500' : 'text-gray-600'}`}>
          {softLightMode 
            ? '💡 Night Light mode • Tap bulb icon to return to dark mode'
            : '🌙 Night mode active • Whisper "temp 101.2" to log'
          }
        </div>
      </div>
    </div>
  )
}
