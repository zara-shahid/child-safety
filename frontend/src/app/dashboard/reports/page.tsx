'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Download,
  Calendar,
  Clock,
  Printer,
  Mail,
  CheckCircle,
  Thermometer,
  Pill,
  Activity,
  AlertCircle,
  ChevronRight,
  Eye,
  Share2,
  Sparkles,
  Zap,
  Filter,
  Shield,
  EyeOff,
  Send,
  Phone,
  Building2,
  X,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import useStore from '@/store/useStore'
import { calculateAge } from '@/lib/utils'

interface ReportSection {
  id: string
  name: string
  icon: typeof FileText
  description: string
  included: boolean
  sensitive?: boolean // For privacy control
  dataCount?: number // Number of entries in this section
  abnormalCount?: number // Number of abnormal entries
}

interface RedactedItem {
  sectionId: string
  itemId: string
  description: string
}

export default function ReportsPage() {
  const { selectedChild, vitalReadings, symptomHistory, doseLogs, medications } = useStore()
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [generating, setGenerating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [showLivePreview, setShowLivePreview] = useState(false)
  const [abnormalOnly, setAbnormalOnly] = useState(false)
  const [redactedItems, setRedactedItems] = useState<RedactedItem[]>([])
  const [deliveryMethod, setDeliveryMethod] = useState<'download' | 'email' | 'fax' | 'emr' | null>(null)
  const [recipientInfo, setRecipientInfo] = useState({ email: '', fax: '', provider: '' })
  
  // Calculate date range boundaries
  const dateRangeDays = useMemo(() => {
    if (dateRange === '7d') return 7
    if (dateRange === '30d') return 30
    if (dateRange === '90d') return 90
    return 30
  }, [dateRange])
  
  const startDate = useMemo(() => {
    if (dateRange === 'custom' && customStartDate) {
      return new Date(customStartDate)
    }
    const date = new Date()
    date.setDate(date.getDate() - dateRangeDays)
    return date
  }, [dateRange, dateRangeDays, customStartDate])
  
  const endDate = useMemo(() => {
    if (dateRange === 'custom' && customEndDate) {
      return new Date(customEndDate)
    }
    return new Date()
  }, [dateRange, customEndDate])
  
  // Filter data by date range and child
  const filteredVitals = useMemo(() => {
    return vitalReadings.filter(v => 
      v.child_id === selectedChild?.id &&
      new Date(v.timestamp) >= startDate &&
      new Date(v.timestamp) <= endDate
    )
  }, [vitalReadings, selectedChild, startDate, endDate])
  
  const filteredSymptoms = useMemo(() => {
    return symptomHistory.filter(s => 
      s.child_id === selectedChild?.id &&
      new Date(s.timestamp) >= startDate &&
      new Date(s.timestamp) <= endDate
    )
  }, [symptomHistory, selectedChild, startDate, endDate])
  
  const filteredDoses = useMemo(() => {
    return doseLogs.filter(d => 
      d.child_id === selectedChild?.id &&
      new Date(d.timestamp) >= startDate &&
      new Date(d.timestamp) <= endDate
    )
  }, [doseLogs, selectedChild, startDate, endDate])
  
  // Identify abnormal readings
  const abnormalVitals = useMemo(() => {
    return filteredVitals.filter(v => {
      if (v.type === 'temperature') return (v.value as number) >= 100.4
      if (v.type === 'heart_rate') return (v.value as number) > 100 || (v.value as number) < 60
      if (v.type === 'oxygen') return (v.value as number) < 95
      return false
    })
  }, [filteredVitals])
  
  const abnormalSymptoms = useMemo(() => {
    return filteredSymptoms.filter(s => s.severity === 'severe' || s.severity === 'moderate')
  }, [filteredSymptoms])
  
  // Generate AI Executive Summary
  const aiSummary = useMemo(() => {
    if (!selectedChild) return ''
    
    const age = calculateAge(selectedChild.date_of_birth)
    const gender = selectedChild.gender === 'male' ? 'male' : 'female'
    
    // Find fever events
    const feverReadings = filteredVitals.filter(v => v.type === 'temperature' && (v.value as number) >= 100.4)
    const peakTemp = feverReadings.length > 0 
      ? Math.max(...feverReadings.map(v => v.value as number))
      : null
    const peakTempDate = peakTemp 
      ? feverReadings.find(v => v.value === peakTemp)?.timestamp
      : null
    
    // Analyze medication effectiveness
    const antipyreticDoses = filteredDoses.filter(d => 
      d.medication_name?.toLowerCase().includes('tylenol') ||
      d.medication_name?.toLowerCase().includes('acetaminophen') ||
      d.medication_name?.toLowerCase().includes('ibuprofen') ||
      d.medication_name?.toLowerCase().includes('advil')
    )
    
    // Build summary
    let summary = `Patient ${selectedChild.name} (${age}yo ${gender})`
    
    if (selectedChild.weight_lbs) {
      summary += `, weight ${selectedChild.weight_lbs} lbs`
    }
    
    if (peakTemp) {
      const peakDate = peakTempDate ? new Date(peakTempDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
      summary += `. Experienced fever event with peak temperature of ${peakTemp}°F on ${peakDate}`
      
      // Check current status
      const latestTemp = filteredVitals
        .filter(v => v.type === 'temperature')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
      
      if (latestTemp && (latestTemp.value as number) < 100.4) {
        summary += `, currently resolved at ${latestTemp.value}°F`
      }
    } else {
      summary += `. No fever events recorded during this period`
    }
    
    if (antipyreticDoses.length > 0) {
      summary += `. ${antipyreticDoses.length} antipyretic dose(s) administered`
    }
    
    if (filteredSymptoms.length > 0) {
      const uniqueSymptoms = Array.from(new Set(filteredSymptoms.map(s => s.symptom)))
      summary += `. Associated symptoms: ${uniqueSymptoms.slice(0, 3).join(', ')}`
      if (uniqueSymptoms.length > 3) {
        summary += ` (+${uniqueSymptoms.length - 3} more)`
      }
    }
    
    if (selectedChild.medical_conditions?.length) {
      summary += `. Medical history includes: ${selectedChild.medical_conditions.join(', ')}`
    }
    
    summary += '.'
    
    return summary
  }, [selectedChild, filteredVitals, filteredDoses, filteredSymptoms])
  
  // Sections with data counts
  const [sections, setSections] = useState<ReportSection[]>([
    { id: 'summary', name: 'AI Executive Summary', icon: Sparkles, description: 'Natural language overview for clinicians', included: true },
    { id: 'symptoms', name: 'Symptom History', icon: Activity, description: 'All logged symptoms and assessments', included: true },
    { id: 'temperature', name: 'Temperature Log', icon: Thermometer, description: 'Temperature readings over time', included: true },
    { id: 'medications', name: 'Medication History', icon: Pill, description: 'All medication doses given', included: true },
    { id: 'growth', name: 'Growth Data', icon: Activity, description: 'Height, weight, and percentiles', included: true },
    { id: 'vaccines', name: 'Vaccination Record', icon: CheckCircle, description: 'Immunization history', included: true },
    { id: 'alerts', name: 'Health Alerts', icon: AlertCircle, description: 'AI-generated health insights', included: false },
    { id: 'mood', name: 'Mood & Notes', icon: Activity, description: 'Personal notes and mood tracking', included: false, sensitive: true },
  ])
  
  // Update section counts
  const sectionsWithCounts = useMemo(() => {
    return sections.map(s => {
      let dataCount = 0
      let abnormalCount = 0
      
      if (s.id === 'temperature') {
        dataCount = filteredVitals.filter(v => v.type === 'temperature').length
        abnormalCount = abnormalVitals.filter(v => v.type === 'temperature').length
      } else if (s.id === 'symptoms') {
        dataCount = filteredSymptoms.length
        abnormalCount = abnormalSymptoms.length
      } else if (s.id === 'medications') {
        dataCount = filteredDoses.length
      }
      
      return { ...s, dataCount, abnormalCount }
    })
  }, [sections, filteredVitals, filteredSymptoms, filteredDoses, abnormalVitals, abnormalSymptoms])

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => 
      s.id === id ? { ...s, included: !s.included } : s
    ))
  }

  const handleGenerate = async () => {
    setGenerating(true)
    // Simulate PDF generation
    await new Promise(resolve => setTimeout(resolve, 2000))
    setGenerating(false)
    setShowPreview(true)
  }

  const handleDownload = () => {
    setDeliveryMethod('download')
    setShowDeliveryModal(true)
  }

  const handleEmail = () => {
    setDeliveryMethod('email')
    setShowDeliveryModal(true)
  }
  
  const handleFax = () => {
    setDeliveryMethod('fax')
    setShowDeliveryModal(true)
  }
  
  const handleEMR = () => {
    setDeliveryMethod('emr')
    setShowDeliveryModal(true)
  }
  
  const handleDeliveryConfirm = () => {
    if (deliveryMethod === 'download') {
      alert('PDF downloaded! (Demo mode)')
    } else if (deliveryMethod === 'email') {
      alert(`Report sent to ${recipientInfo.email}! (Demo mode)`)
    } else if (deliveryMethod === 'fax') {
      alert(`Report faxed to ${recipientInfo.fax}! (Demo mode)`)
    } else if (deliveryMethod === 'emr') {
      alert(`Report sent to ${recipientInfo.provider} via MyChart! (Demo mode)`)
    }
    setShowDeliveryModal(false)
    setDeliveryMethod(null)
  }

  const handlePrint = () => {
    window.print()
  }
  
  // Calculate "compressed" data for abnormal-only mode
  const normalRangesSummary = useMemo(() => {
    if (!abnormalOnly) return null
    
    const normalTemps = filteredVitals.filter(v => 
      v.type === 'temperature' && (v.value as number) < 100.4
    )
    
    if (normalTemps.length === 0) return null
    
    const firstNormal = new Date(normalTemps[normalTemps.length - 1].timestamp)
    const lastNormal = new Date(normalTemps[0].timestamp)
    
    return {
      tempCount: normalTemps.length,
      startDate: firstNormal.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      endDate: lastNormal.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }
  }, [filteredVitals, abnormalOnly])

  if (!selectedChild) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <FileText className="w-16 h-16 text-surface-600 dark:text-surface-300 mb-4" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">No Child Selected</h2>
        <p className="text-surface-600 dark:text-surface-400">Select a child to generate reports</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Doctor Visit Reports</h1>
          <p className="text-surface-600 dark:text-surface-400">Generate comprehensive health summaries for {selectedChild.name}'s doctor visits</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setShowLivePreview(true)}
          icon={<Eye className="w-4 h-4" />}
        >
          Live Preview
        </Button>
      </div>
      
      {/* AI Executive Summary Preview */}
      <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-violet-200 dark:border-violet-800">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold text-violet-900 dark:text-violet-100">AI Executive Summary</h3>
              <Badge variant="info" size="sm">
                <Zap className="w-3 h-3 mr-1" />
                Auto-Generated
              </Badge>
            </div>
            <p className="text-sm text-violet-800 dark:text-violet-200 leading-relaxed italic">
              "{aiSummary}"
            </p>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-2">
              This summary will appear at the top of your report, giving clinicians instant context.
            </p>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card 
          className={`cursor-pointer hover:shadow-lg transition-all ${
            dateRange === '7d' 
              ? 'bg-gradient-to-br from-cyan-100 to-teal-100 dark:from-cyan-800/40 dark:to-teal-800/40 border-cyan-400 dark:border-cyan-600 ring-2 ring-cyan-300' 
              : 'bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 border-cyan-200 dark:border-cyan-800'
          }`} 
          onClick={() => setDateRange('7d')}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h3 className="font-bold text-surface-900 dark:text-white">Last 7 Days</h3>
              <p className="text-sm text-surface-600 dark:text-surface-400">Quick illness summary</p>
            </div>
            {dateRange === '7d' && <CheckCircle className="w-5 h-5 text-cyan-500 ml-auto" />}
          </div>
        </Card>

        <Card 
          className={`cursor-pointer hover:shadow-lg transition-all ${
            dateRange === '30d' 
              ? 'bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-800/40 dark:to-purple-800/40 border-violet-400 dark:border-violet-600 ring-2 ring-violet-300' 
              : 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-violet-200 dark:border-violet-800'
          }`}
          onClick={() => setDateRange('30d')}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
              <FileText className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-bold text-surface-900 dark:text-white">Last 30 Days</h3>
              <p className="text-sm text-surface-600 dark:text-surface-400">Monthly health report</p>
            </div>
            {dateRange === '30d' && <CheckCircle className="w-5 h-5 text-violet-500 ml-auto" />}
          </div>
        </Card>

        <Card 
          className={`cursor-pointer hover:shadow-lg transition-all ${
            dateRange === '90d' 
              ? 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-800/40 dark:to-orange-800/40 border-amber-400 dark:border-amber-600 ring-2 ring-amber-300' 
              : 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800'
          }`}
          onClick={() => setDateRange('90d')}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-surface-900 dark:text-white">Last 90 Days</h3>
              <p className="text-sm text-surface-600 dark:text-surface-400">Quarterly review</p>
            </div>
            {dateRange === '90d' && <CheckCircle className="w-5 h-5 text-amber-500 ml-auto" />}
          </div>
        </Card>
      </div>
      
      {/* Smart Filtering Options */}
      <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <Filter className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h4 className="font-semibold text-emerald-800 dark:text-emerald-200">Smart Filtering</h4>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                Reduce clinician fatigue by highlighting what matters
              </p>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={abnormalOnly}
              onChange={(e) => setAbnormalOnly(e.target.checked)}
              className="w-5 h-5 rounded text-emerald-600"
            />
            <span className="font-medium text-emerald-800 dark:text-emerald-200">
              Highlight Abnormal Events Only
            </span>
          </label>
        </div>
        {abnormalOnly && normalRangesSummary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 p-3 rounded-lg bg-white/50 dark:bg-black/20"
          >
            <div className="text-sm text-emerald-700 dark:text-emerald-300">
              <strong>Preview:</strong> {normalRangesSummary.tempCount} normal readings from {normalRangesSummary.startDate} to {normalRangesSummary.endDate} will be compressed into: 
              <span className="italic ml-1">"Vitals within normal limits (WNL)"</span>
            </div>
          </motion.div>
        )}
      </Card>

      {/* Report Builder */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Date Range */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-cyan-500" />
                Date Range
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { value: '7d', label: 'Last 7 days' },
                  { value: '30d', label: 'Last 30 days' },
                  { value: '90d', label: 'Last 90 days' },
                  { value: 'custom', label: 'Custom range' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDateRange(option.value as typeof dateRange)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      dateRange === option.value
                        ? 'bg-cyan-500 text-white'
                        : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {dateRange === 'custom' && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Report Sections */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-500" />
                  Include in Report
                </CardTitle>
                <Badge variant="secondary" size="sm">
                  {sectionsWithCounts.filter(s => s.included).length} sections selected
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sectionsWithCounts.map((section) => (
                  <div
                    key={section.id}
                    onClick={() => toggleSection(section.id)}
                    className={`p-4 rounded-xl cursor-pointer transition-all border-2 ${
                      section.included
                        ? section.sensitive 
                          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                          : 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-300 dark:border-cyan-700'
                        : 'bg-surface-50 dark:bg-surface-800 border-transparent hover:border-surface-300 dark:hover:border-surface-600'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        section.included
                          ? section.sensitive 
                            ? 'bg-amber-100 dark:bg-amber-900/50'
                            : 'bg-cyan-100 dark:bg-cyan-900/50'
                          : 'bg-surface-200 dark:bg-surface-700'
                      }`}>
                        <section.icon className={`w-5 h-5 ${
                          section.included
                            ? section.sensitive 
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-cyan-600 dark:text-cyan-400'
                            : 'text-surface-500'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-surface-900 dark:text-white">{section.name}</h4>
                          {section.sensitive && (
                            <Badge variant="warning" size="sm">
                              <Shield className="w-3 h-3 mr-1" />
                              Sensitive
                            </Badge>
                          )}
                          {section.dataCount !== undefined && section.dataCount > 0 && (
                            <Badge variant="secondary" size="sm">
                              {abnormalOnly && section.abnormalCount !== undefined 
                                ? `${section.abnormalCount} abnormal` 
                                : `${section.dataCount} entries`
                              }
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-surface-500">{section.description}</p>
                        {section.abnormalCount !== undefined && section.abnormalCount > 0 && !abnormalOnly && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {section.abnormalCount} abnormal event{section.abnormalCount > 1 ? 's' : ''} detected
                          </p>
                        )}
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        section.included
                          ? section.sensitive 
                            ? 'bg-amber-500 border-amber-500'
                            : 'bg-cyan-500 border-cyan-500'
                          : 'border-surface-300 dark:border-surface-600'
                      }`}>
                        {section.included && <CheckCircle className="w-4 h-4 text-white" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Privacy Warning */}
              {sectionsWithCounts.some(s => s.included && s.sensitive) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700"
                >
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-medium text-amber-800 dark:text-amber-200">Privacy Notice</h5>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        You've selected sensitive data sections. Review the report before sharing with school nurses or non-primary providers.
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-2"
                        icon={<EyeOff className="w-3 h-3" />}
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowLivePreview(true)
                        }}
                      >
                        Review & Redact Items
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview & Actions */}
        <div className="space-y-6">
          {/* Preview Card */}
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Report Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Mini Preview */}
              <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 mb-4 shadow-inner">
                <div className="text-center mb-4 pb-4 border-b border-surface-200 dark:border-surface-700">
                  <div className="text-xs text-surface-500 uppercase tracking-wider">Health Report</div>
                  <div className="font-bold text-surface-900 dark:text-white">{selectedChild.name}</div>
                  <div className="text-xs text-surface-500">
                    {dateRange === '7d' ? 'Last 7 Days' : dateRange === '30d' ? 'Last 30 Days' : dateRange === '90d' ? 'Last 90 Days' : 'Custom Range'}
                  </div>
                  {abnormalOnly && (
                    <Badge variant="success" size="sm" className="mt-2">
                      <Filter className="w-3 h-3 mr-1" />
                      Abnormal Only
                    </Badge>
                  )}
                </div>
                <div className="space-y-2 text-xs">
                  {sectionsWithCounts.filter(s => s.included).map(section => (
                    <div key={section.id} className="flex items-center justify-between text-surface-600 dark:text-surface-400">
                      <div className="flex items-center gap-2">
                        <CheckCircle className={`w-3 h-3 ${section.sensitive ? 'text-amber-500' : 'text-cyan-500'}`} />
                        {section.name}
                      </div>
                      {section.dataCount !== undefined && section.dataCount > 0 && (
                        <span className="text-surface-600 dark:text-surface-400">
                          {abnormalOnly && section.abnormalCount !== undefined 
                            ? section.abnormalCount 
                            : section.dataCount
                          }
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {sectionsWithCounts.filter(s => s.included).length === 0 && (
                  <p className="text-center text-surface-600 dark:text-surface-400 text-xs py-4">Select sections to include</p>
                )}
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                loading={generating}
                disabled={sectionsWithCounts.filter(s => s.included).length === 0}
                fullWidth
                className="bg-gradient-to-r from-cyan-500 to-teal-600 mb-3"
                icon={<FileText className="w-4 h-4" />}
              >
                {generating ? 'Generating...' : 'Generate Report'}
              </Button>

              {showPreview && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="text-center py-2">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
                    <span className="text-sm text-emerald-600 dark:text-emerald-400">Report Ready!</span>
                  </div>
                  
                  {/* Primary Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      onClick={handleDownload}
                      icon={<Download className="w-4 h-4" />}
                      className="bg-gradient-to-r from-cyan-500 to-teal-600"
                    >
                      Download PDF
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handlePrint}
                      icon={<Printer className="w-4 h-4" />}
                    >
                      Print
                    </Button>
                  </div>
                  
                  {/* Direct Delivery Section */}
                  <div className="pt-2 border-t border-surface-200 dark:border-surface-700">
                    <p className="text-xs text-surface-500 mb-2 flex items-center gap-1">
                      <Send className="w-3 h-3" />
                      Send directly to provider:
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleEmail}
                        icon={<Mail className="w-4 h-4" />}
                      >
                        Email
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleFax}
                        icon={<Phone className="w-4 h-4" />}
                      >
                        Fax
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleEMR}
                        icon={<Building2 className="w-4 h-4" />}
                      >
                        MyChart
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* Recent Reports */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { date: 'Jan 15, 2026', type: '7-day Summary', size: '245 KB', sent: 'Dr. Smith via Email' },
                  { date: 'Jan 8, 2026', type: '30-day Report', size: '512 KB', sent: 'MyChart' },
                  { date: 'Dec 20, 2025', type: 'Vaccine Record', size: '128 KB', sent: null },
                ].map((report, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 cursor-pointer transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-surface-200 dark:bg-surface-700 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-surface-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-surface-900 dark:text-white truncate">{report.type}</div>
                      <div className="text-xs text-surface-500">
                        {report.date} • {report.size}
                        {report.sent && (
                          <span className="text-emerald-500 ml-1">• Sent to {report.sent}</span>
                        )}
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-surface-400" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tips */}
      <Card className="bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800">
        <div className="flex gap-3">
          <Sparkles className="w-5 h-5 text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-cyan-800 dark:text-cyan-200">Pro Tip</h4>
            <p className="text-sm text-cyan-700 dark:text-cyan-300 mt-1">
              Generate a report before your pediatrician appointment. Having detailed symptom logs, temperature trends, 
              and medication history helps your doctor make better-informed decisions about your child's care.
            </p>
          </div>
        </div>
      </Card>
      
      {/* Live Preview Modal */}
      <AnimatePresence>
        {showLivePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowLivePreview(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Eye className="w-5 h-5 text-cyan-500" />
                      <CardTitle>Report Preview</CardTitle>
                    </div>
                    <button 
                      onClick={() => setShowLivePreview(false)}
                      className="text-surface-400 hover:text-surface-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Simulated Report Document */}
                  <div className="bg-white border border-surface-200 rounded-lg p-6 shadow-inner space-y-6">
                    {/* Header */}
                    <div className="text-center pb-4 border-b-2 border-surface-200">
                      <h2 className="text-xl font-bold text-surface-900">PEDIATRIC HEALTH REPORT</h2>
                      <p className="text-sm text-surface-500 mt-1">
                        {dateRange === '7d' ? 'Last 7 Days' : dateRange === '30d' ? 'Last 30 Days' : dateRange === '90d' ? 'Last 90 Days' : 'Custom Range'} Summary
                      </p>
                    </div>
                    
                    {/* Patient Info */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold text-surface-600">Patient:</span>
                        <span className="ml-2 text-surface-900">{selectedChild.name}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-surface-600">Age:</span>
                        <span className="ml-2 text-surface-900">{calculateAge(selectedChild.date_of_birth)} years</span>
                      </div>
                      <div>
                        <span className="font-semibold text-surface-600">Weight:</span>
                        <span className="ml-2 text-surface-900">{selectedChild.weight_lbs || '--'} lbs</span>
                      </div>
                      <div>
                        <span className="font-semibold text-surface-600">Report Date:</span>
                        <span className="ml-2 text-surface-900">{new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    {/* AI Summary */}
                    {sectionsWithCounts.find(s => s.id === 'summary')?.included && (
                      <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
                        <h3 className="font-bold text-violet-900 flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4" />
                          Clinical Summary
                        </h3>
                        <p className="text-sm text-violet-800 italic">"{aiSummary}"</p>
                      </div>
                    )}
                    
                    {/* Temperature Data */}
                    {sectionsWithCounts.find(s => s.id === 'temperature')?.included && (
                      <div>
                        <h3 className="font-bold text-surface-900 flex items-center gap-2 mb-3">
                          <Thermometer className="w-4 h-4 text-red-500" />
                          Temperature Log
                        </h3>
                        
                        {abnormalOnly && normalRangesSummary ? (
                          <div className="space-y-2">
                            <div className="p-3 bg-emerald-50 rounded-lg text-sm text-emerald-700">
                              <CheckCircle className="w-4 h-4 inline mr-2" />
                              {normalRangesSummary.startDate} - {normalRangesSummary.endDate}: Vitals within normal limits ({normalRangesSummary.tempCount} readings)
                            </div>
                            {abnormalVitals.filter(v => v.type === 'temperature').length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-red-600 uppercase">Abnormal Readings:</p>
                                {abnormalVitals.filter(v => v.type === 'temperature').map((v, i) => (
                                  <div key={i} className="p-2 bg-red-50 rounded text-sm flex items-center justify-between">
                                    <span className="font-semibold text-red-800">{v.value}°F</span>
                                    <span className="text-red-600">{new Date(v.timestamp).toLocaleString()}</span>
                                    <TrendingUp className="w-4 h-4 text-red-500" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {filteredVitals.filter(v => v.type === 'temperature').slice(0, 5).map((v, i) => (
                              <div key={i} className={`p-2 rounded text-sm flex items-center justify-between ${
                                (v.value as number) >= 100.4 ? 'bg-red-50' : 'bg-surface-50'
                              }`}>
                                <span className={`font-semibold ${(v.value as number) >= 100.4 ? 'text-red-800' : 'text-surface-800'}`}>
                                  {v.value}°F
                                </span>
                                <span className="text-surface-500">{new Date(v.timestamp).toLocaleString()}</span>
                              </div>
                            ))}
                            {filteredVitals.filter(v => v.type === 'temperature').length > 5 && (
                              <p className="text-xs text-surface-500 text-center pt-2">
                                +{filteredVitals.filter(v => v.type === 'temperature').length - 5} more readings...
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Medications */}
                    {sectionsWithCounts.find(s => s.id === 'medications')?.included && filteredDoses.length > 0 && (
                      <div>
                        <h3 className="font-bold text-surface-900 flex items-center gap-2 mb-3">
                          <Pill className="w-4 h-4 text-cyan-500" />
                          Medication History
                        </h3>
                        <div className="space-y-1">
                          {filteredDoses.slice(0, 5).map((d, i) => (
                            <div key={i} className="p-2 bg-cyan-50 rounded text-sm flex items-center justify-between">
                              <span className="font-semibold text-cyan-800">{d.medication_name}</span>
                              <span className="text-cyan-600">{new Date(d.timestamp).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Symptoms */}
                    {sectionsWithCounts.find(s => s.id === 'symptoms')?.included && filteredSymptoms.length > 0 && (
                      <div>
                        <h3 className="font-bold text-surface-900 flex items-center gap-2 mb-3">
                          <Activity className="w-4 h-4 text-orange-500" />
                          Symptom History
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {Array.from(new Set(filteredSymptoms.map(s => s.symptom))).map((symptom, i) => (
                            <Badge key={i} variant="warning" size="sm">{String(symptom)}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Footer */}
                    <div className="pt-4 border-t border-surface-200 text-xs text-surface-500 text-center">
                      Generated by EPCID • {new Date().toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-4">
                    <Button variant="secondary" fullWidth onClick={() => setShowLivePreview(false)}>
                      Close Preview
                    </Button>
                    <Button 
                      fullWidth 
                      onClick={() => {
                        setShowLivePreview(false)
                        handleGenerate()
                      }}
                      className="bg-gradient-to-r from-cyan-500 to-teal-600"
                      icon={<FileText className="w-4 h-4" />}
                    >
                      Generate This Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Delivery Method Modal */}
      <AnimatePresence>
        {showDeliveryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDeliveryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {deliveryMethod === 'download' && <Download className="w-5 h-5 text-cyan-500" />}
                      {deliveryMethod === 'email' && <Mail className="w-5 h-5 text-cyan-500" />}
                      {deliveryMethod === 'fax' && <Phone className="w-5 h-5 text-cyan-500" />}
                      {deliveryMethod === 'emr' && <Building2 className="w-5 h-5 text-cyan-500" />}
                      {deliveryMethod === 'download' && 'Download Report'}
                      {deliveryMethod === 'email' && 'Email Report'}
                      {deliveryMethod === 'fax' && 'Fax Report'}
                      {deliveryMethod === 'emr' && 'Send to MyChart'}
                    </CardTitle>
                    <button 
                      onClick={() => setShowDeliveryModal(false)}
                      className="text-surface-400 hover:text-surface-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {deliveryMethod === 'download' && (
                    <div className="text-center py-4">
                      <div className="w-16 h-16 rounded-full bg-cyan-100 flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-cyan-600" />
                      </div>
                      <p className="text-surface-600 dark:text-surface-400">
                        Your report is ready to download as a PDF file.
                      </p>
                      <p className="text-sm text-surface-500 mt-2">
                        {selectedChild.name}_Health_Report_{dateRange}.pdf
                      </p>
                    </div>
                  )}
                  
                  {deliveryMethod === 'email' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                          Recipient Email
                        </label>
                        <input
                          type="email"
                          placeholder="doctor@clinic.com"
                          value={recipientInfo.email}
                          onChange={(e) => setRecipientInfo(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                        />
                      </div>
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Report will be sent as a password-protected PDF
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {deliveryMethod === 'fax' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                          Fax Number
                        </label>
                        <input
                          type="tel"
                          placeholder="(555) 123-4567"
                          value={recipientInfo.fax}
                          onChange={(e) => setRecipientInfo(prev => ({ ...prev, fax: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                        />
                      </div>
                      <div className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
                        <p className="text-sm text-violet-700 dark:text-violet-300">
                          <strong>Tip:</strong> Most doctor offices and specialists still accept fax for medical records.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {deliveryMethod === 'emr' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                          Healthcare Provider
                        </label>
                        <select
                          value={recipientInfo.provider}
                          onChange={(e) => setRecipientInfo(prev => ({ ...prev, provider: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                        >
                          <option value="">Select provider...</option>
                          <option value="Kaiser Permanente">Kaiser Permanente</option>
                          <option value="Sutter Health">Sutter Health</option>
                          <option value="UCSF Health">UCSF Health</option>
                          <option value="Stanford Health">Stanford Health</option>
                        </select>
                      </div>
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                        <p className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Securely transmitted via HIPAA-compliant connection
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-3 pt-2">
                    <Button 
                      variant="secondary" 
                      fullWidth 
                      onClick={() => setShowDeliveryModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      fullWidth 
                      onClick={handleDeliveryConfirm}
                      disabled={
                        (deliveryMethod === 'email' && !recipientInfo.email) ||
                        (deliveryMethod === 'fax' && !recipientInfo.fax) ||
                        (deliveryMethod === 'emr' && !recipientInfo.provider)
                      }
                      className="bg-gradient-to-r from-cyan-500 to-teal-600"
                      icon={<Send className="w-4 h-4" />}
                    >
                      {deliveryMethod === 'download' ? 'Download' : 'Send Report'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
