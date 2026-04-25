'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Thermometer,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Activity,
  Droplets,
  Heart,
  Pill,
  Share2,
  FileText,
  Download,
  Info,
  Zap,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import useStore from '@/store/useStore'

interface TemperatureReading {
  id: string
  value: number
  timestamp: Date
  notes: string
}

interface SymptomEntry {
  id: string
  symptoms: string[]
  severity: 'mild' | 'moderate' | 'severe'
  timestamp: Date
  notes: string
}

// Mock data for demo
const mockTemperatures: TemperatureReading[] = [
  { id: '1', value: 98.6, timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000), notes: '' },
  { id: '2', value: 100.2, timestamp: new Date(Date.now() - 42 * 60 * 60 * 1000), notes: 'Started feeling warm' },
  { id: '3', value: 101.5, timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000), notes: '' },
  { id: '4', value: 102.1, timestamp: new Date(Date.now() - 30 * 60 * 60 * 1000), notes: 'Peak fever' },
  { id: '5', value: 101.2, timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), notes: 'After Tylenol' },
  { id: '6', value: 100.4, timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000), notes: '' },
  { id: '7', value: 99.8, timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), notes: '' },
  { id: '8', value: 99.1, timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), notes: 'Improving' },
  { id: '9', value: 98.8, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), notes: '' },
]

const mockSymptoms: SymptomEntry[] = [
  { id: '1', symptoms: ['Fever', 'Fatigue'], severity: 'mild', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000), notes: '' },
  { id: '2', symptoms: ['Fever', 'Fatigue', 'Cough'], severity: 'moderate', timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000), notes: '' },
  { id: '3', symptoms: ['Fever', 'Cough', 'Runny Nose'], severity: 'moderate', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), notes: '' },
  { id: '4', symptoms: ['Cough', 'Runny Nose'], severity: 'mild', timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), notes: '' },
  { id: '5', symptoms: ['Runny Nose'], severity: 'mild', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), notes: '' },
]

export default function TrendsPage() {
  const { selectedChild, symptomHistory, doseLogs, medications, vitalReadings } = useStore()
  const [temperatures, setTemperatures] = useState<TemperatureReading[]>(mockTemperatures)
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedChartPoint, setSelectedChartPoint] = useState<string | null>(null)
  
  // Use real symptom data from store if available, otherwise use mock data
  const symptoms = useMemo(() => {
    if (symptomHistory && symptomHistory.length > 0) {
      return symptomHistory.map(entry => ({
        id: entry.id,
        symptoms: entry.symptoms.map(s => s.name),
        severity: entry.symptoms.some(s => s.severity >= 3) ? 'severe' as const : 
                  entry.symptoms.some(s => s.severity >= 2) ? 'moderate' as const : 'mild' as const,
        timestamp: new Date(entry.created_at),
        notes: entry.symptoms.map(s => s.notes).filter(Boolean).join(', ') || '',
      }))
    }
    return mockSymptoms
  }, [symptomHistory])
  
  // Get medication doses for chart annotations
  const medicationDoses = useMemo(() => {
    return doseLogs.map(log => {
      const med = medications.find(m => m.id === log.medicationId)
      return {
        id: log.id,
        timestamp: new Date(log.timestamp),
        medName: med?.name.split('(')[0].trim() || 'Medication',
        dosage: log.dosage,
        color: med?.color || 'bg-cyan-500',
      }
    })
  }, [doseLogs, medications])
  
  const [timeRange, setTimeRange] = useState<'24h' | '48h' | '7d'>('48h')
  const [showAddTemp, setShowAddTemp] = useState(false)
  const [newTemp, setNewTemp] = useState('')
  const [newTempNotes, setNewTempNotes] = useState('')

  // Format time for display - defined early so useMemo hooks can use it
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const formatDate = (date: Date) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return `Today ${formatTime(date)}`
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${formatTime(date)}`
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const timeRangeMs = {
    '24h': 24 * 60 * 60 * 1000,
    '48h': 48 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  }

  const filteredTemperatures = useMemo(() => {
    const cutoff = Date.now() - timeRangeMs[timeRange]
    return temperatures
      .filter(t => new Date(t.timestamp).getTime() > cutoff)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }, [temperatures, timeRange])

  const stats = useMemo(() => {
    if (filteredTemperatures.length === 0) {
      return { current: null, high: null, low: null, trend: 'stable' as const }
    }
    const current = filteredTemperatures[filteredTemperatures.length - 1].value
    const high = Math.max(...filteredTemperatures.map(t => t.value))
    const low = Math.min(...filteredTemperatures.map(t => t.value))
    
    // Calculate trend based on last 3 readings
    const recentReadings = filteredTemperatures.slice(-3)
    let trend: 'improving' | 'worsening' | 'stable' = 'stable'
    if (recentReadings.length >= 2) {
      const first = recentReadings[0].value
      const last = recentReadings[recentReadings.length - 1].value
      if (last < first - 0.5) trend = 'improving'
      else if (last > first + 0.5) trend = 'worsening'
    }
    
    return { current, high, low, trend }
  }, [filteredTemperatures])

  const getTemperatureColor = (temp: number) => {
    if (temp < 99) return 'text-emerald-600 dark:text-emerald-400'
    if (temp < 100.4) return 'text-amber-600 dark:text-amber-400'
    if (temp < 102) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getTemperatureLabel = (temp: number) => {
    if (temp < 99) return 'Normal'
    if (temp < 100.4) return 'Low-grade Fever'
    if (temp < 102) return 'Fever'
    return 'High Fever'
  }

  const handleAddTemperature = () => {
    if (!newTemp) return
    const reading: TemperatureReading = {
      id: Date.now().toString(),
      value: parseFloat(newTemp),
      timestamp: new Date(),
      notes: newTempNotes,
    }
    setTemperatures(prev => [...prev, reading])
    setNewTemp('')
    setNewTempNotes('')
    setShowAddTemp(false)
  }

  // SVG Chart dimensions for mini chart
  const chartWidth = 100
  const chartHeight = 50
  const padding = 5
  
  // Large annotated chart dimensions
  const largeChartWidth = 800
  const largeChartHeight = 300
  const largePadding = 40

  const chartPoints = useMemo(() => {
    if (filteredTemperatures.length < 2) return ''
    
    const minTemp = 97
    const maxTemp = 104
    const tempRange = maxTemp - minTemp
    
    const timeStart = new Date(filteredTemperatures[0].timestamp).getTime()
    const timeEnd = new Date(filteredTemperatures[filteredTemperatures.length - 1].timestamp).getTime()
    const timeRangeVal = timeEnd - timeStart || 1
    
    return filteredTemperatures.map((t, i) => {
      const x = padding + ((new Date(t.timestamp).getTime() - timeStart) / timeRangeVal) * (chartWidth - 2 * padding)
      const y = chartHeight - padding - ((t.value - minTemp) / tempRange) * (chartHeight - 2 * padding)
      return `${x},${y}`
    }).join(' ')
  }, [filteredTemperatures])
  
  // Calculate points for large annotated chart
  const largeChartData = useMemo(() => {
    if (filteredTemperatures.length < 2) return { points: '', dataPoints: [], medMarkers: [], symptomMarkers: [] }
    
    const minTemp = 97
    const maxTemp = 104
    const tempRange = maxTemp - minTemp
    const feverThresholdY = largeChartHeight - largePadding - ((100.4 - minTemp) / tempRange) * (largeChartHeight - 2 * largePadding)
    
    const timeStart = new Date(filteredTemperatures[0].timestamp).getTime()
    const timeEnd = new Date(filteredTemperatures[filteredTemperatures.length - 1].timestamp).getTime()
    const timeRangeVal = timeEnd - timeStart || 1
    
    // Calculate data points
    const dataPoints = filteredTemperatures.map((t) => {
      const x = largePadding + ((new Date(t.timestamp).getTime() - timeStart) / timeRangeVal) * (largeChartWidth - 2 * largePadding)
      const y = largeChartHeight - largePadding - ((t.value - minTemp) / tempRange) * (largeChartHeight - 2 * largePadding)
      return { ...t, x, y }
    })
    
    const points = dataPoints.map(p => `${p.x},${p.y}`).join(' ')
    
    // Find medication doses within the time range
    const medMarkers = medicationDoses
      .filter(d => d.timestamp.getTime() >= timeStart && d.timestamp.getTime() <= timeEnd)
      .map(d => {
        const x = largePadding + ((d.timestamp.getTime() - timeStart) / timeRangeVal) * (largeChartWidth - 2 * largePadding)
        // Find closest temperature reading to position the marker
        const closestTemp = filteredTemperatures.reduce((prev, curr) => 
          Math.abs(new Date(curr.timestamp).getTime() - d.timestamp.getTime()) < 
          Math.abs(new Date(prev.timestamp).getTime() - d.timestamp.getTime()) ? curr : prev
        )
        const y = largeChartHeight - largePadding - ((closestTemp.value - minTemp) / tempRange) * (largeChartHeight - 2 * largePadding)
        return { ...d, x, y: y - 20 }  // Position above the line
      })
    
    // Find symptom changes within the time range
    const symptomMarkers = symptoms
      .filter(s => s.timestamp.getTime() >= timeStart && s.timestamp.getTime() <= timeEnd)
      .map(s => {
        const x = largePadding + ((s.timestamp.getTime() - timeStart) / timeRangeVal) * (largeChartWidth - 2 * largePadding)
        const closestTemp = filteredTemperatures.reduce((prev, curr) => 
          Math.abs(new Date(curr.timestamp).getTime() - s.timestamp.getTime()) < 
          Math.abs(new Date(prev.timestamp).getTime() - s.timestamp.getTime()) ? curr : prev
        )
        const y = largeChartHeight - largePadding - ((closestTemp.value - minTemp) / tempRange) * (largeChartHeight - 2 * largePadding)
        return { ...s, x, y: y + 20 }  // Position below the line
      })
    
    return { points, dataPoints, medMarkers, symptomMarkers, feverThresholdY }
  }, [filteredTemperatures, medicationDoses, symptoms])
  
  // Generate recovery report summary
  const recoveryReport = useMemo(() => {
    const peakTemp = Math.max(...filteredTemperatures.map(t => t.value))
    const currentTemp = filteredTemperatures[filteredTemperatures.length - 1]?.value || 0
    const peakDate = filteredTemperatures.find(t => t.value === peakTemp)?.timestamp
    const totalDoses = doseLogs.filter(d => {
      const doseTime = new Date(d.timestamp).getTime()
      return doseTime >= Date.now() - timeRangeMs[timeRange]
    }).length
    
    return {
      childName: selectedChild?.name || 'Child',
      peakTemp,
      peakDate: peakDate ? formatDate(new Date(peakDate)) : '',
      currentTemp,
      trend: stats.trend,
      totalDoses,
      symptomCount: symptoms.length,
      isRecovered: currentTemp < 100.4 && stats.trend === 'improving',
    }
  }, [filteredTemperatures, doseLogs, symptoms, stats, selectedChild, timeRange])

  if (!selectedChild) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <TrendingUp className="w-16 h-16 text-surface-600 dark:text-surface-300 mb-4" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">No Child Selected</h2>
        <p className="text-surface-600 dark:text-surface-400">Select a child to view health trends</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Health Trends</h1>
          <p className="text-surface-600 dark:text-surface-400">Track {selectedChild.name}'s temperature and symptoms over time</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-xl bg-surface-100 dark:bg-surface-800 p-1">
            {(['24h', '48h', '7d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  timeRange === range
                    ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                    : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Temperature Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="sm" className="col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-surface-500 mb-1">Current Temperature</div>
              <div className={`text-4xl font-bold ${stats.current ? getTemperatureColor(stats.current) : 'text-surface-600 dark:text-surface-400'}`}>
                {stats.current ? `${stats.current}°F` : '--'}
              </div>
              {stats.current && (
                <Badge 
                  variant={stats.current < 100.4 ? 'success' : stats.current < 102 ? 'warning' : 'danger'} 
                  className="mt-2"
                >
                  {getTemperatureLabel(stats.current)}
                </Badge>
              )}
            </div>
            <div className="w-32 h-16">
              {filteredTemperatures.length >= 2 && (
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full">
                  {/* Fever threshold line */}
                  <line 
                    x1={padding} 
                    y1={chartHeight - padding - ((100.4 - 97) / 7) * (chartHeight - 2 * padding)}
                    x2={chartWidth - padding}
                    y2={chartHeight - padding - ((100.4 - 97) / 7) * (chartHeight - 2 * padding)}
                    stroke="currentColor"
                    strokeDasharray="2,2"
                    className="text-amber-300 dark:text-amber-700"
                    strokeWidth="0.5"
                  />
                  {/* Temperature line */}
                  <polyline
                    points={chartPoints}
                    fill="none"
                    stroke="url(#tempGradient)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Points */}
                  {filteredTemperatures.map((t, i) => {
                    const x = padding + (i / (filteredTemperatures.length - 1)) * (chartWidth - 2 * padding)
                    const y = chartHeight - padding - ((t.value - 97) / 7) * (chartHeight - 2 * padding)
                    return (
                      <circle
                        key={t.id}
                        cx={x}
                        cy={y}
                        r="2"
                        className={t.value >= 100.4 ? 'fill-orange-500' : 'fill-cyan-500'}
                      />
                    )
                  })}
                  <defs>
                    <linearGradient id="tempGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#14b8a6" />
                    </linearGradient>
                  </defs>
                </svg>
              )}
            </div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              stats.trend === 'improving' ? 'bg-emerald-100 dark:bg-emerald-900/50' :
              stats.trend === 'worsening' ? 'bg-red-100 dark:bg-red-900/50' :
              'bg-surface-100 dark:bg-surface-800'
            }`}>
              {stats.trend === 'improving' ? (
                <TrendingDown className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : stats.trend === 'worsening' ? (
                <TrendingUp className="w-5 h-5 text-red-600 dark:text-red-400" />
              ) : (
                <Minus className="w-5 h-5 text-surface-500" />
              )}
            </div>
            <div>
              <div className="text-sm text-surface-500">Trend</div>
              <div className={`font-bold capitalize ${
                stats.trend === 'improving' ? 'text-emerald-600 dark:text-emerald-400' :
                stats.trend === 'worsening' ? 'text-red-600 dark:text-red-400' :
                'text-surface-600 dark:text-surface-400'
              }`}>
                {stats.trend}
              </div>
            </div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
              <Thermometer className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <div className="text-sm text-surface-500">Peak</div>
              <div className="font-bold text-surface-900 dark:text-white">
                {stats.high ? `${stats.high}°F` : '--'}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Annotated Temperature Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-500" />
              Illness Timeline
              <Badge variant="primary" size="sm">Interactive</Badge>
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                variant="secondary"
                size="sm"
                onClick={() => setShowShareModal(true)}
                icon={<Share2 className="w-4 h-4" />}
              >
                Share Report
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Chart Legend */}
          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-cyan-500" />
              <span className="text-surface-600 dark:text-surface-400">Normal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-surface-600 dark:text-surface-400">Fever (≥100.4°F)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Pill className="w-4 h-4 text-violet-500" />
              <span className="text-surface-600 dark:text-surface-400">Medication Given</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-surface-600 dark:text-surface-400">Symptom Change</span>
            </div>
          </div>
          
          {/* Large Annotated Chart */}
          {filteredTemperatures.length >= 2 ? (
            <div className="relative overflow-x-auto">
              <svg 
                viewBox={`0 0 ${largeChartWidth} ${largeChartHeight}`} 
                className="w-full min-w-[600px] h-[300px]"
              >
                {/* Fever Danger Zone (red shading above 100.4°F) */}
                <rect
                  x={largePadding}
                  y={largePadding}
                  width={largeChartWidth - 2 * largePadding}
                  height={(largeChartData.feverThresholdY || 0) - largePadding}
                  fill="url(#feverZoneGradient)"
                  opacity="0.15"
                />
                
                {/* Normal Zone (green shading below 100.4°F) */}
                <rect
                  x={largePadding}
                  y={largeChartData.feverThresholdY || 0}
                  width={largeChartWidth - 2 * largePadding}
                  height={largeChartHeight - largePadding - (largeChartData.feverThresholdY || 0)}
                  fill="url(#normalZoneGradient)"
                  opacity="0.1"
                />
                
                {/* Grid lines */}
                {[97, 98, 99, 100, 101, 102, 103, 104].map(temp => {
                  const y = largeChartHeight - largePadding - ((temp - 97) / 7) * (largeChartHeight - 2 * largePadding)
                  return (
                    <g key={temp}>
                      <line
                        x1={largePadding}
                        y1={y}
                        x2={largeChartWidth - largePadding}
                        y2={y}
                        stroke="currentColor"
                        strokeOpacity={temp === 100.4 ? 0.5 : 0.1}
                        strokeWidth={temp === 100.4 ? 2 : 1}
                        strokeDasharray={temp === 100.4 ? "5,5" : "none"}
                        className={temp === 100.4 ? "text-red-400" : "text-surface-600 dark:text-surface-400"}
                      />
                      <text
                        x={largePadding - 5}
                        y={y + 4}
                        textAnchor="end"
                        className="text-xs fill-surface-500"
                      >
                        {temp}°
                      </text>
                    </g>
                  )
                })}
                
                {/* Fever threshold label */}
                <text
                  x={largeChartWidth - largePadding + 5}
                  y={(largeChartData.feverThresholdY || 0) + 4}
                  className="text-xs fill-red-500 font-medium"
                >
                  Fever Line
                </text>
                
                {/* Temperature line */}
                <polyline
                  points={largeChartData.points}
                  fill="none"
                  stroke="url(#tempLineGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                {/* Medication markers (pill icons on the line) */}
                {largeChartData.medMarkers.map((marker, i) => (
                  <g key={`med-${marker.id}`} className="cursor-pointer">
                    <circle
                      cx={marker.x}
                      cy={marker.y}
                      r="12"
                      className="fill-violet-100 dark:fill-violet-900/50 stroke-violet-500"
                      strokeWidth="2"
                    />
                    <text
                      x={marker.x}
                      y={marker.y + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-xs fill-violet-600 dark:fill-violet-400"
                    >
                      💊
                    </text>
                    {/* Tooltip on hover - simplified as text */}
                    <title>{marker.medName} - {marker.dosage}</title>
                  </g>
                ))}
                
                {/* Symptom markers */}
                {largeChartData.symptomMarkers.map((marker, i) => (
                  <g key={`symptom-${marker.id}`} className="cursor-pointer">
                    <circle
                      cx={marker.x}
                      cy={marker.y}
                      r="10"
                      className={`stroke-2 ${
                        marker.severity === 'severe' ? 'fill-red-100 dark:fill-red-900/50 stroke-red-500' :
                        marker.severity === 'moderate' ? 'fill-amber-100 dark:fill-amber-900/50 stroke-amber-500' :
                        'fill-emerald-100 dark:fill-emerald-900/50 stroke-emerald-500'
                      }`}
                    />
                    <text
                      x={marker.x}
                      y={marker.y + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-[8px] fill-current"
                    >
                      {marker.symptoms.length}
                    </text>
                    <title>{marker.symptoms.join(', ')}</title>
                  </g>
                ))}
                
                {/* Data points */}
                {largeChartData.dataPoints.map((point, i) => (
                  <g 
                    key={point.id} 
                    className="cursor-pointer"
                    onClick={() => setSelectedChartPoint(selectedChartPoint === point.id ? null : point.id)}
                  >
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={selectedChartPoint === point.id ? 8 : 5}
                      className={`${point.value >= 100.4 ? 'fill-orange-500' : 'fill-cyan-500'} transition-all`}
                      stroke="white"
                      strokeWidth="2"
                    />
                    {/* Show value on hover/select */}
                    {selectedChartPoint === point.id && (
                      <>
                        <rect
                          x={point.x - 35}
                          y={point.y - 45}
                          width="70"
                          height="35"
                          rx="6"
                          className="fill-surface-900 dark:fill-surface-700"
                        />
                        <text
                          x={point.x}
                          y={point.y - 32}
                          textAnchor="middle"
                          className="text-sm fill-white font-bold"
                        >
                          {point.value}°F
                        </text>
                        <text
                          x={point.x}
                          y={point.y - 18}
                          textAnchor="middle"
                          className="text-[9px] fill-surface-300"
                        >
                          {point.notes || formatTime(new Date(point.timestamp))}
                        </text>
                      </>
                    )}
                    <title>{point.value}°F - {point.notes || formatDate(new Date(point.timestamp))}</title>
                  </g>
                ))}
                
                {/* Gradients */}
                <defs>
                  <linearGradient id="feverZoneGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.1" />
                  </linearGradient>
                  <linearGradient id="normalZoneGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.15" />
                  </linearGradient>
                  <linearGradient id="tempLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
              
              {/* Time labels below chart */}
              <div className="flex justify-between px-10 mt-2 text-xs text-surface-500">
                {filteredTemperatures.length > 0 && (
                  <>
                    <span>{formatDate(new Date(filteredTemperatures[0].timestamp))}</span>
                    <span>{formatDate(new Date(filteredTemperatures[filteredTemperatures.length - 1].timestamp))}</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-surface-500">
              Need at least 2 temperature readings to show chart
            </div>
          )}
          
          {/* Chart Insights */}
          <div className="mt-4 p-4 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-cyan-500 mt-0.5" />
              <div className="text-sm text-surface-600 dark:text-surface-400">
                <strong className="text-surface-900 dark:text-white">Reading the Chart:</strong> The red-shaded zone indicates fever territory (≥100.4°F). 
                Pill icons (💊) show when medication was given - look for the temperature drop that follows. 
                Numbered circles show symptom entries. Click any data point to see details.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Temperature Timeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-orange-500" />
              Temperature History
            </CardTitle>
            <Button 
              onClick={() => setShowAddTemp(true)} 
              icon={<Plus className="w-4 h-4" />}
              className="bg-gradient-to-r from-cyan-500 to-teal-600"
            >
              Log Temperature
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTemperatures.length > 0 ? (
            <div className="space-y-3">
              {[...filteredTemperatures].reverse().map((reading, i) => (
                <motion.div
                  key={reading.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-surface-50 dark:bg-surface-800"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    reading.value < 99 ? 'bg-emerald-100 dark:bg-emerald-900/50' :
                    reading.value < 100.4 ? 'bg-amber-100 dark:bg-amber-900/50' :
                    reading.value < 102 ? 'bg-orange-100 dark:bg-orange-900/50' :
                    'bg-red-100 dark:bg-red-900/50'
                  }`}>
                    <span className={`text-lg font-bold ${getTemperatureColor(reading.value)}`}>
                      {reading.value}°
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${getTemperatureColor(reading.value)}`}>
                        {getTemperatureLabel(reading.value)}
                      </span>
                      {i === 0 && (
                        <Badge variant="primary" size="sm">Latest</Badge>
                      )}
                    </div>
                    <div className="text-sm text-surface-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(new Date(reading.timestamp))}
                    </div>
                    {reading.notes && (
                      <div className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                        "{reading.notes}"
                      </div>
                    )}
                  </div>
                  {i < filteredTemperatures.length - 1 && (
                    <div className={`flex items-center gap-1 text-sm font-medium ${
                      reading.value < filteredTemperatures[filteredTemperatures.length - 1 - i - 1]?.value
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : reading.value > filteredTemperatures[filteredTemperatures.length - 1 - i - 1]?.value
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-surface-600 dark:text-surface-400'
                    }`}>
                      {reading.value < filteredTemperatures[filteredTemperatures.length - 1 - i - 1]?.value ? (
                        <>
                          <TrendingDown className="w-4 h-4" />
                          <span>-{(filteredTemperatures[filteredTemperatures.length - 1 - i - 1]?.value - reading.value).toFixed(1)}°</span>
                        </>
                      ) : reading.value > filteredTemperatures[filteredTemperatures.length - 1 - i - 1]?.value ? (
                        <>
                          <TrendingUp className="w-4 h-4" />
                          <span>+{(reading.value - filteredTemperatures[filteredTemperatures.length - 1 - i - 1]?.value).toFixed(1)}°</span>
                        </>
                      ) : (
                        <Minus className="w-4 h-4" />
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Thermometer className="w-16 h-16 text-surface-600 dark:text-surface-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">No Temperature Data</h3>
              <p className="text-surface-600 dark:text-surface-400 mb-4">Start tracking temperature to see trends</p>
              <Button onClick={() => setShowAddTemp(true)} icon={<Plus className="w-4 h-4" />}>
                Log First Temperature
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Symptom Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-violet-500" />
            Symptom Progression
          </CardTitle>
        </CardHeader>
        <CardContent>
          {symptoms.length > 0 ? (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-surface-200 dark:bg-surface-700" />
              
              <div className="space-y-6">
                {[...symptoms].reverse().map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="relative flex gap-4"
                  >
                    {/* Timeline dot */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center z-10 ${
                      entry.severity === 'mild' ? 'bg-emerald-100 dark:bg-emerald-900/50' :
                      entry.severity === 'moderate' ? 'bg-amber-100 dark:bg-amber-900/50' :
                      'bg-red-100 dark:bg-red-900/50'
                    }`}>
                      {entry.severity === 'mild' ? (
                        <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      ) : entry.severity === 'moderate' ? (
                        <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 pb-6">
                      <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800">
                        <div className="flex items-center justify-between mb-2">
                          <Badge 
                            variant={entry.severity === 'mild' ? 'success' : entry.severity === 'moderate' ? 'warning' : 'danger'}
                          >
                            {entry.severity} symptoms
                          </Badge>
                          <span className="text-sm text-surface-500">
                            {formatDate(new Date(entry.timestamp))}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {entry.symptoms.map((symptom) => (
                            <span 
                              key={symptom}
                              className="px-3 py-1 rounded-full bg-surface-200 dark:bg-surface-700 text-sm text-surface-700 dark:text-surface-300"
                            >
                              {symptom}
                            </span>
                          ))}
                        </div>
                        {entry.notes && (
                          <p className="text-sm text-surface-600 dark:text-surface-400 mt-2">
                            {entry.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Activity className="w-16 h-16 text-surface-600 dark:text-surface-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">No Symptom Data</h3>
              <p className="text-surface-600 dark:text-surface-400">Log symptoms to track progression</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Temperature Modal */}
      {showAddTemp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddTemp(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <Card>
              <CardHeader>
                <CardTitle>Log Temperature</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Temperature (°F)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newTemp}
                    onChange={(e) => setNewTemp(e.target.value)}
                    placeholder="e.g., 101.5"
                    className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none text-2xl font-bold text-center"
                  />
                  {newTemp && (
                    <div className={`text-center mt-2 font-medium ${getTemperatureColor(parseFloat(newTemp))}`}>
                      {getTemperatureLabel(parseFloat(newTemp))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={newTempNotes}
                    onChange={(e) => setNewTempNotes(e.target.value)}
                    placeholder="e.g., After giving Tylenol"
                    className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" onClick={() => setShowAddTemp(false)} fullWidth>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddTemperature} 
                    disabled={!newTemp}
                    fullWidth
                    className="bg-gradient-to-r from-cyan-500 to-teal-600"
                  >
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Insight Card */}
      {stats.trend === 'improving' && (
        <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
          <div className="flex gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-emerald-800 dark:text-emerald-200">Good News! Temperature is Improving</h4>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                The temperature has been trending downward over the past readings. Continue monitoring and 
                ensure adequate hydration and rest.
              </p>
              {recoveryReport.isRecovered && (
                <div className="mt-3 flex gap-2">
                  <Button 
                    size="sm" 
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setShowShareModal(true)}
                    icon={<Share2 className="w-4 h-4" />}
                  >
                    Share Recovery Report with Doctor
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {stats.trend === 'worsening' && (
        <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="flex gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-amber-800 dark:text-amber-200">Temperature is Rising</h4>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                The temperature has been trending upward. Consider giving age-appropriate fever medication 
                and contact your pediatrician if the fever persists or reaches 104°F.
              </p>
              <div className="mt-3 flex gap-2">
                <Link href="/dashboard/telehealth">
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                    Connect with Nurse
                  </Button>
                </Link>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => setShowShareModal(true)}
                  icon={<Share2 className="w-4 h-4" />}
                >
                  Share Data
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Share Recovery Report Modal */}
      {showShareModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowShareModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan-500" />
                    Health Summary Report
                  </CardTitle>
                  <button 
                    onClick={() => setShowShareModal(false)}
                    className="text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-600"
                  >
                    ✕
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Report Preview */}
                <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                  <div className="text-center mb-4 pb-4 border-b border-surface-200 dark:border-surface-700">
                    <h3 className="font-bold text-lg text-surface-900 dark:text-white">
                      {recoveryReport.isRecovered ? '✅ Recovery Report' : '📊 Health Status Report'}
                    </h3>
                    <p className="text-sm text-surface-500">
                      Patient: {recoveryReport.childName} • Generated: {new Date().toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-surface-500">Peak Temperature</div>
                      <div className="text-lg font-bold text-orange-600">{recoveryReport.peakTemp}°F</div>
                      <div className="text-xs text-surface-600 dark:text-surface-400">{recoveryReport.peakDate}</div>
                    </div>
                    <div>
                      <div className="text-xs text-surface-500">Current Temperature</div>
                      <div className={`text-lg font-bold ${
                        recoveryReport.currentTemp < 100.4 ? 'text-emerald-600' : 'text-orange-600'
                      }`}>
                        {recoveryReport.currentTemp}°F
                      </div>
                      <div className="text-xs text-surface-600 dark:text-surface-400">
                        {recoveryReport.currentTemp < 100.4 ? 'Normal range' : 'Elevated'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-2 rounded-lg bg-white dark:bg-surface-900">
                      <div className="text-2xl font-bold text-surface-900 dark:text-white">{recoveryReport.totalDoses}</div>
                      <div className="text-xs text-surface-500">Med Doses</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-surface-900">
                      <div className="text-2xl font-bold text-surface-900 dark:text-white">{filteredTemperatures.length}</div>
                      <div className="text-xs text-surface-500">Temp Logs</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-surface-900">
                      <div className={`text-2xl font-bold capitalize ${
                        recoveryReport.trend === 'improving' ? 'text-emerald-600' :
                        recoveryReport.trend === 'worsening' ? 'text-red-600' : 'text-surface-600'
                      }`}>
                        {recoveryReport.trend === 'improving' ? '↓' : recoveryReport.trend === 'worsening' ? '↑' : '→'}
                      </div>
                      <div className="text-xs text-surface-500">Trend</div>
                    </div>
                  </div>
                  
                  {recoveryReport.isRecovered && (
                    <div className="mt-4 p-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-center">
                      <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                        ✓ Temperature returned to normal range. Treatment appears effective.
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Share Actions */}
                <div className="flex gap-3">
                  <Button 
                    variant="secondary" 
                    fullWidth
                    icon={<Download className="w-4 h-4" />}
                    onClick={() => {
                      // In real app, would generate PDF
                      alert('PDF download would be generated here')
                    }}
                  >
                    Download PDF
                  </Button>
                  <Link href="/dashboard/telehealth" className="flex-1">
                    <Button 
                      fullWidth
                      className="bg-gradient-to-r from-cyan-500 to-teal-600"
                      icon={<Share2 className="w-4 h-4" />}
                    >
                      Send to Doctor
                    </Button>
                  </Link>
                </div>
                
                <p className="text-xs text-center text-surface-500">
                  This report can be shared with your healthcare provider for follow-up care
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
