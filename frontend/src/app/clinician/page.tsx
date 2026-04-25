'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  User,
  Heart,
  Thermometer,
  Wind,
  Pill,
  Activity,
  Video,
  Phone,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  Shield,
  Stethoscope,
  TrendingUp,
  TrendingDown,
  Minus,
  Weight,
  AlertCircle,
  Send,
  MessageSquare,
  ArrowUpRight,
} from 'lucide-react'
import useStore from '@/store/useStore'

// Type for velocity field
type VelocityType = 'worsening' | 'improving' | 'stable'
type PriorityLevel = 'ROUTINE' | 'URGENT' | 'CRITICAL'

// Type for the handoff state
interface HandoffState {
  handoff_id: string
  generated_at: string
  priority_level: PriorityLevel
  patient_context: {
    patient_id: string
    name: string
    age_months: number
    weight_lbs: number
    chronic_conditions: string[]
    allergies: string[]
  }
  triage_summary: {
    risk_score: number
    risk_level: string
    velocity: VelocityType
    ai_generated_complaint: string
  }
  vitals_snapshot: {
    current_temp: { value: number; unit: string; source: string; delta_baseline: string }
    heart_rate: { value: number; unit: string; status: string; source: string }
    oxygen_saturation: { value: number; unit: string; status: string }
  }
  medication_history_24h: Array<{
    drug_name: string
    dosage_mg: number
    administered_at: string
    efficacy_flag: string
  }>
  recent_event_timeline: Array<{
    time: string
    event: string
    detail: string
  }>
}

// Mock handoff data for demo - in production this comes from the backend
const mockHandoff: HandoffState = {
  handoff_id: "ho_9921_nancy_urgent",
  generated_at: new Date().toISOString(),
  priority_level: "URGENT",
  patient_context: {
    patient_id: "pt_5541_encrypted",
    name: "Nancy S.",
    age_months: 156,
    weight_lbs: 98,
    chronic_conditions: ["Mild Asthma"],
    allergies: ["Penicillin"],
  },
  triage_summary: {
    risk_score: 78,
    risk_level: "high",
    velocity: "worsening" as VelocityType,
    ai_generated_complaint: "13yo female presenting with persistent moderate fever (101.2°F) for 6.5 hours. Fever shows resistance to antipyretics administered 1 hour ago.",
  },
  vitals_snapshot: {
    current_temp: { value: 101.2, unit: "F", source: "Kinsa Smart Ear (Verified)", delta_baseline: "+2.6" },
    heart_rate: { value: 110, unit: "bpm", status: "elevated", source: "Apple Watch" },
    oxygen_saturation: { value: 98, unit: "%", status: "normal" },
  },
  medication_history_24h: [
    { drug_name: "Acetaminophen (Tylenol)", dosage_mg: 500, administered_at: new Date(Date.now() - 60*60*1000).toISOString(), efficacy_flag: "low_response" },
    { drug_name: "Ibuprofen", dosage_mg: 400, administered_at: new Date(Date.now() - 8*60*60*1000).toISOString(), efficacy_flag: "normal" },
  ],
  recent_event_timeline: [
    { time: "14:00", event: "Vital Alert", detail: "Temp spike to 101.2°F detected via wearable." },
    { time: "13:45", event: "Medication", detail: "Acetaminophen 500mg administered by parent." },
    { time: "08:00", event: "Symptom Log", detail: "Child reported mild headache and fatigue." },
  ],
}

const priorityConfig: Record<PriorityLevel, { bg: string; text: string; label: string }> = {
  ROUTINE: { bg: 'bg-green-600', text: 'text-white', label: 'Routine' },
  URGENT: { bg: 'bg-amber-500', text: 'text-white', label: 'Urgent' },
  CRITICAL: { bg: 'bg-red-600', text: 'text-white', label: 'Critical' },
}

export default function ClinicianDashboard() {
  const { telehealthHandoffs } = useStore()
  const [selectedHandoff, setSelectedHandoff] = useState<HandoffState>(mockHandoff)
  const [actionTaken, setActionTaken] = useState<string | null>(null)

  // Use real handoff if available
  useEffect(() => {
    if (telehealthHandoffs.length > 0) {
      const latest = telehealthHandoffs[0]
      const merged: HandoffState = {
        handoff_id: latest.handoff_id || mockHandoff.handoff_id,
        generated_at: latest.generated_at || mockHandoff.generated_at,
        priority_level: (latest.priority_level || mockHandoff.priority_level) as PriorityLevel,
        patient_context: {
          ...mockHandoff.patient_context,
          ...latest.patient_context,
        },
        triage_summary: {
          risk_score: latest.triage_summary?.risk_score ?? mockHandoff.triage_summary.risk_score,
          risk_level: latest.triage_summary?.risk_level || mockHandoff.triage_summary.risk_level,
          velocity: (latest.triage_summary?.velocity || mockHandoff.triage_summary.velocity) as VelocityType,
          ai_generated_complaint: latest.triage_summary?.ai_generated_complaint || mockHandoff.triage_summary.ai_generated_complaint,
        },
        vitals_snapshot: {
          current_temp: {
            value: latest.vitals_snapshot?.current_temp?.value ?? mockHandoff.vitals_snapshot.current_temp.value,
            unit: latest.vitals_snapshot?.current_temp?.unit || mockHandoff.vitals_snapshot.current_temp.unit,
            source: latest.vitals_snapshot?.current_temp?.source || mockHandoff.vitals_snapshot.current_temp.source,
            delta_baseline: latest.vitals_snapshot?.current_temp?.delta_baseline || mockHandoff.vitals_snapshot.current_temp.delta_baseline,
          },
          heart_rate: {
            value: latest.vitals_snapshot?.heart_rate?.value ?? mockHandoff.vitals_snapshot.heart_rate.value,
            unit: latest.vitals_snapshot?.heart_rate?.unit || mockHandoff.vitals_snapshot.heart_rate.unit,
            status: latest.vitals_snapshot?.heart_rate?.status || mockHandoff.vitals_snapshot.heart_rate.status,
            source: latest.vitals_snapshot?.heart_rate?.source || mockHandoff.vitals_snapshot.heart_rate.source,
          },
          oxygen_saturation: {
            value: latest.vitals_snapshot?.oxygen_saturation?.value ?? mockHandoff.vitals_snapshot.oxygen_saturation.value,
            unit: latest.vitals_snapshot?.oxygen_saturation?.unit || mockHandoff.vitals_snapshot.oxygen_saturation.unit,
            status: latest.vitals_snapshot?.oxygen_saturation?.status || mockHandoff.vitals_snapshot.oxygen_saturation.status,
          },
        },
        medication_history_24h: latest.medication_history_24h || mockHandoff.medication_history_24h,
        recent_event_timeline: latest.recent_event_timeline || mockHandoff.recent_event_timeline,
      }
      setSelectedHandoff(merged)
    }
  }, [telehealthHandoffs])

  const priority = selectedHandoff.priority_level
  const config = priorityConfig[priority]

  const handleProtocolAction = (action: string) => {
    setActionTaken(action)
    // In production, this would send a notification to the parent's device
  }

  // Calculate if ibuprofen is safe (simple demo logic)
  const lastMed = selectedHandoff.medication_history_24h[0]
  const isTylenolLast = lastMed?.drug_name.includes('Acetaminophen')
  const canGiveIbuprofen = isTylenolLast && !selectedHandoff.patient_context.allergies.includes('NSAID')
  const hasAsthma = selectedHandoff.patient_context.chronic_conditions.some(c => c.toLowerCase().includes('asthma'))

  // Calculate safe ibuprofen dose based on weight
  const weightLbs = selectedHandoff.patient_context.weight_lbs || 0
  const safeDoseMg = Math.round((weightLbs / 2.2) * 10) // ~10mg/kg

  return (
    <div className="min-h-screen text-surface-900 dark:text-white">
      {/* Zone A: Triage Header - Red Alert Banner */}
      <div className={`${config.bg} ${config.text}`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-full bg-white/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold">
                    {selectedHandoff.patient_context.name}
                  </h1>
                  <span className="text-sm opacity-90">
                    ({Math.floor(selectedHandoff.patient_context.age_months / 12)}yo | {selectedHandoff.patient_context.weight_lbs} lbs)
                  </span>
                  {selectedHandoff.patient_context.weight_lbs && (
                    <span className="px-2 py-0.5 rounded text-xs bg-white/20 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Verified Weight
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-semibold uppercase text-sm tracking-wider">
                    {config.label} - FEVER SPIKE
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{selectedHandoff.triage_summary.risk_score}</div>
              <div className="text-sm opacity-90 flex items-center justify-end gap-1">
                {selectedHandoff.triage_summary.velocity === 'worsening' && <TrendingUp className="w-4 h-4" />}
                {selectedHandoff.triage_summary.velocity === 'improving' && <TrendingDown className="w-4 h-4" />}
                {selectedHandoff.triage_summary.velocity === 'stable' && <Minus className="w-4 h-4" />}
                Risk Score ({selectedHandoff.triage_summary.velocity})
              </div>
            </div>
          </div>
          
          {/* AI Summary */}
          <div className="mt-4 p-3 rounded-lg bg-black/20">
            <p className="text-sm italic">
              <Stethoscope className="w-4 h-4 inline mr-2" />
              "{selectedHandoff.triage_summary.ai_generated_complaint}"
            </p>
          </div>

          {/* Conditions & Allergies */}
          <div className="mt-3 flex items-center gap-4 text-sm">
            {selectedHandoff.patient_context.chronic_conditions.length > 0 && (
              <span className="flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                History: {selectedHandoff.patient_context.chronic_conditions.join(', ')}
              </span>
            )}
            {selectedHandoff.patient_context.allergies.length > 0 && (
              <span className="flex items-center gap-1 text-red-200">
                <XCircle className="w-4 h-4" />
                Allergies: {selectedHandoff.patient_context.allergies.join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Zone B: Evidence Block */}
          <div className="space-y-6">
            {/* Vitals Trend */}
            <div className="bg-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Vitals Snapshot
              </h2>
              
              <div className="grid grid-cols-3 gap-4">
                {/* Temperature */}
                <div className="p-4 rounded-lg bg-red-900/30 border border-red-800">
                  <Thermometer className="w-5 h-5 text-red-400 mb-2" />
                  <div className="text-2xl font-bold text-red-400">
                    {selectedHandoff.vitals_snapshot.current_temp?.value}°F
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {selectedHandoff.vitals_snapshot.current_temp?.delta_baseline} from baseline
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    via {selectedHandoff.vitals_snapshot.current_temp?.source}
                  </div>
                </div>

                {/* Heart Rate */}
                <div className="p-4 rounded-lg bg-gray-700/50 border border-gray-600">
                  <Heart className="w-5 h-5 text-pink-400 mb-2" />
                  <div className="text-2xl font-bold">
                    {selectedHandoff.vitals_snapshot.heart_rate?.value} <span className="text-sm font-normal text-gray-400">bpm</span>
                  </div>
                  <div className="text-xs text-amber-400 mt-1">
                    {selectedHandoff.vitals_snapshot.heart_rate?.status}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    via {selectedHandoff.vitals_snapshot.heart_rate?.source}
                  </div>
                </div>

                {/* O2 Sat */}
                <div className="p-4 rounded-lg bg-gray-700/50 border border-gray-600">
                  <Wind className="w-5 h-5 text-blue-400 mb-2" />
                  <div className="text-2xl font-bold">
                    {selectedHandoff.vitals_snapshot.oxygen_saturation?.value}%
                  </div>
                  <div className="text-xs text-green-400 mt-1">
                    {selectedHandoff.vitals_snapshot.oxygen_saturation?.status}
                  </div>
                </div>
              </div>

              {/* Trend Note */}
              <div className="mt-4 p-3 rounded-lg bg-amber-900/20 border border-amber-800/50">
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-medium">Rapid Onset Detected</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Temperature increased +2.6°F in last hour. Velocity: High.
                </p>
              </div>
            </div>

            {/* Medication Efficacy */}
            <div className="bg-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Pill className="w-5 h-5 text-purple-400" />
                Medication Efficacy (24h)
              </h2>
              
              <div className="space-y-3">
                {selectedHandoff.medication_history_24h.map((med, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-700/50">
                    <div>
                      <div className="font-medium">{med.drug_name}</div>
                      <div className="text-sm text-gray-400">{med.dosage_mg}mg</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">
                        {new Date(med.administered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {med.efficacy_flag === 'low_response' ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-900/50 text-red-400">
                          Low Response
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-900/50 text-green-400">
                          Normal
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {lastMed?.efficacy_flag === 'low_response' && (
                <div className="mt-4 p-3 rounded-lg bg-red-900/20 border border-red-800/50">
                  <p className="text-sm text-red-300">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    <strong>Insight:</strong> Medication failed to arrest fever trajectory. Consider alternative intervention.
                  </p>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="bg-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                Event Timeline
              </h2>
              
              <div className="space-y-3">
                {selectedHandoff.recent_event_timeline.map((event, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="text-sm font-mono text-gray-500 w-12">
                      {event.time}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{event.event}</div>
                      <div className="text-sm text-gray-400">{event.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Zone C: Decision Matrix */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-400" />
                Recommended Actions
              </h2>

              {actionTaken ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-6 rounded-xl bg-green-900/30 border border-green-700 text-center"
                >
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-green-400 mb-2">
                    Action Sent to Parent
                  </h3>
                  <p className="text-gray-300">{actionTaken}</p>
                  <button
                    onClick={() => setActionTaken(null)}
                    className="mt-4 text-sm text-gray-400 hover:text-white"
                  >
                    Send Another Action
                  </button>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  {/* Protocol A: Ibuprofen */}
                  <button
                    onClick={() => handleProtocolAction(`Advise Ibuprofen ${safeDoseMg}mg. Protocol: Antipyretic Stacking.`)}
                    disabled={!canGiveIbuprofen}
                    className={`w-full p-4 rounded-xl text-left transition-all ${
                      canGiveIbuprofen 
                        ? 'bg-green-900/30 border-2 border-green-600 hover:bg-green-900/50' 
                        : 'bg-gray-700/50 border border-gray-600 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-green-400 flex items-center gap-2">
                          <Pill className="w-5 h-5" />
                          Advise Ibuprofen Stacking
                        </h3>
                        <p className="text-sm text-gray-300 mt-1">
                          Safe Dose: <strong>{safeDoseMg}mg</strong> (based on {weightLbs}lbs)
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Next Tylenol available at {new Date(Date.now() + 4*60*60*1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-green-400" />
                    </div>
                  </button>

                  {/* Protocol B: Video Triage */}
                  {hasAsthma && (
                    <button
                      onClick={() => handleProtocolAction('Initiating video call to assess breathing. Asthma risk flagged.')}
                      className="w-full p-4 rounded-xl text-left bg-amber-900/30 border-2 border-amber-600 hover:bg-amber-900/50 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-amber-400 flex items-center gap-2">
                            <Video className="w-5 h-5" />
                            Request Video Triage
                          </h3>
                          <p className="text-sm text-gray-300 mt-1">
                            Assess Breathing - <strong>Asthma Risk Flagged</strong>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Opens secure video link for respiratory check
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-amber-400" />
                      </div>
                    </button>
                  )}

                  {/* Protocol C: Escalate */}
                  <button
                    onClick={() => handleProtocolAction('Referral to ER initiated. PDF summary generated for intake nurse.')}
                    className="w-full p-4 rounded-xl text-left bg-red-900/30 border-2 border-red-600 hover:bg-red-900/50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-red-400 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          Escalate to ER
                        </h3>
                        <p className="text-sm text-gray-300 mt-1">
                          Generate PDF summary for ER intake
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Use if fever persists or respiratory distress develops
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-red-400" />
                    </div>
                  </button>

                  {/* Custom Message */}
                  <button
                    onClick={() => handleProtocolAction('Custom guidance sent to parent device.')}
                    className="w-full p-4 rounded-xl text-left bg-gray-700/50 border border-gray-600 hover:bg-gray-700 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-300 flex items-center gap-2">
                          <MessageSquare className="w-5 h-5" />
                          Send Custom Message
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">
                          Write personalized guidance for this case
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="bg-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-4">Patient Quick Stats</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Age</span>
                  <p className="font-medium">{Math.floor(selectedHandoff.patient_context.age_months / 12)} years</p>
                </div>
                <div>
                  <span className="text-gray-400">Weight</span>
                  <p className="font-medium">{selectedHandoff.patient_context.weight_lbs} lbs</p>
                </div>
                <div>
                  <span className="text-gray-400">Risk Level</span>
                  <p className="font-medium capitalize">{selectedHandoff.triage_summary.risk_level}</p>
                </div>
                <div>
                  <span className="text-gray-400">Trend</span>
                  <p className="font-medium capitalize flex items-center gap-1">
                    {selectedHandoff.triage_summary.velocity === 'worsening' && <TrendingUp className="w-4 h-4 text-red-400" />}
                    {selectedHandoff.triage_summary.velocity === 'improving' && <TrendingDown className="w-4 h-4 text-green-400" />}
                    {selectedHandoff.triage_summary.velocity}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-800 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-sm text-gray-500">
          <span>EPCID Clinician Portal v1.0 • HIPAA Compliant</span>
          <span>Handoff ID: {selectedHandoff.handoff_id}</span>
        </div>
      </div>
    </div>
  )
}
