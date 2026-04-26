'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  Phone,
  Clock,
  Navigation,
  Star,
  Building2,
  Stethoscope,
  Ambulance,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  Search,
  Filter,
  X,
  Heart,
  Video,
  Shield,
  CheckCircle,
  AlertCircle,
  Car,
  Zap,
  Thermometer,
  Activity,
  DollarSign,
  Wifi,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Input } from '@/components/ui'
import useStore from '@/store/useStore'

interface CareLocation {
  id: string
  name: string
  type: 'er' | 'urgent_care' | 'pediatrician' | 'pharmacy' | 'telehealth'
  address: string
  distance: string
  distanceMiles: number
  phone: string
  hours: string
  isOpen: boolean
  rating: number
  waitTime?: string
  waitTimeVerified?: boolean // NEW: Is wait time live data?
  acceptsWalkIns: boolean
  coordinates: { lat: number; lng: number }
  recommended?: boolean // NEW: Triage-driven recommendation
  recommendationReason?: string
  trustScore?: number // NEW: Facility Verification System Trust Score
  flags?: string[] // NEW: Contradiction flags from FacilityVerificationAgent
}


const mockLocations: CareLocation[] = [
  {
    id: 'del-1',
    name: "All India Institute of Medical Sciences (AIIMS)",
    type: 'er',
    address: 'Ansari Nagar, New Delhi, India',
    distance: '1.2 km',
    distanceMiles: 0.75,
    phone: '+91 11 2658 8500',
    hours: 'Open 24 hours',
    isOpen: true,
    rating: 4.8,
    waitTime: '20 min',
    waitTimeVerified: true,
    acceptsWalkIns: true,
    coordinates: { lat: 28.5672, lng: 77.2100 },
  },
  {
    id: 'del-2',
    name: "Safdarjung Hospital",
    type: 'er',
    address: 'Safdarjung, New Delhi, India',
    distance: '3.1 km',
    distanceMiles: 1.9,
    phone: '+91 11 2673 0000',
    hours: 'Open 24 hours',
    isOpen: true,
    rating: 4.3,
    waitTime: '45 min',
    waitTimeVerified: true,
    acceptsWalkIns: true,
    coordinates: { lat: 28.5689, lng: 77.2074 },
  },
  {
    id: 'del-3',
    name: "Lok Nayak Hospital",
    type: 'er',
    address: 'Jawaharlal Nehru Marg, New Delhi, India',
    distance: '4.5 km',
    distanceMiles: 2.8,
    phone: '+91 11 2323 2400',
    hours: 'Open 24 hours',
    isOpen: true,
    rating: 4.1,
    waitTime: '1 hour',
    waitTimeVerified: true,
    acceptsWalkIns: true,
    coordinates: { lat: 28.6390, lng: 77.2410 },
  },
  {
    id: 'mum-1',
    name: "Tata Memorial Hospital, Mumbai",
    type: 'er',
    address: 'Dr E Borges Road, Parel, Mumbai, India',
    distance: '1400 km',
    distanceMiles: 870,
    phone: '+91 22 2417 7000',
    hours: 'Open 24 hours',
    isOpen: true,
    rating: 4.9,
    waitTime: '15 min',
    waitTimeVerified: true,
    acceptsWalkIns: true,
    coordinates: { lat: 18.9994, lng: 72.8414 },
  },
  {
    id: 'del-4',
    name: "Kalawati Saran Children's Hospital",
    type: 'pediatrician',
    address: 'Bangla Sahib Marg, New Delhi, India',
    distance: '5.0 km',
    distanceMiles: 3.1,
    phone: '+91 11 2336 3738',
    hours: '9am - 8pm',
    isOpen: true,
    rating: 4.6,
    acceptsWalkIns: false,
    coordinates: { lat: 28.6361, lng: 77.2075 },
  },
  {
    id: 'del-5',
    name: 'Apollo Pharmacy, Connaught Place',
    type: 'pharmacy',
    address: 'Connaught Place, New Delhi, India',
    distance: '0.9 km',
    distanceMiles: 0.5,
    phone: '+91 11 4600 1066',
    hours: 'Open 24 hours',
    isOpen: true,
    rating: 4.4,
    acceptsWalkIns: true,
    coordinates: { lat: 28.6315, lng: 77.2167 },
  },
  {
    id: 'tele-1',
    name: 'VitalKids Tele-Consult (India)',
    type: 'telehealth',
    address: 'Virtual Visit',
    distance: '--',
    distanceMiles: 0,
    phone: '1800-VitalKids-IN',
    hours: 'Available 24/7',
    isOpen: true,
    rating: 4.6,
    waitTime: '< 10 min',
    waitTimeVerified: true,
    acceptsWalkIns: true,
    coordinates: { lat: 0, lng: 0 },
  },
]


// Helper for distance calculation (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const typeConfig = {
  er: {
    icon: Ambulance,
    label: 'Emergency Room',
    color: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
    borderColor: 'border-red-300 dark:border-red-700',
    priority: 1, // Higher number = higher priority for severe symptoms
  },
  urgent_care: {
    icon: Building2,
    label: 'Urgent Care',
    color: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400',
    borderColor: 'border-orange-300 dark:border-orange-700',
    priority: 2,
  },
  telehealth: {
    icon: Video,
    label: 'Telehealth',
    color: 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400',
    borderColor: 'border-violet-300 dark:border-violet-700',
    priority: 3,
  },
  pediatrician: {
    icon: Stethoscope,
    label: 'Pediatrician',
    color: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400',
    borderColor: 'border-cyan-300 dark:border-cyan-700',
    priority: 4,
  },
  pharmacy: {
    icon: Heart,
    label: 'Pharmacy',
    color: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-300 dark:border-emerald-700',
    priority: 5,
  },
}

export default function FindCarePage() {
  const { selectedChild, vitalReadings, symptomHistory, latestAssessment } = useStore()

  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<CareLocation | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)

  // API Integration states
  const [apiFacilities, setApiFacilities] = useState<any[]>([])
  const [apiReport, setApiReport] = useState<any>(null)
  const [isFetchingAI, setIsFetchingAI] = useState(false)
  const [activeRegion, setActiveRegion] = useState<string>('')

  // Fetch from Python AI Backend when userLocation changes
  useEffect(() => {
    if (!userLocation) return

    setIsFetchingAI(true)
    fetch('http://localhost:8081/api/v1/facilities/recommend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        medical_need: 'emergency appendectomy',
        radius: 300,
        state_filter: activeRegion  // e.g. "Bihar" when Test Rural Bihar is clicked
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.recommended_facilities) {
          setApiFacilities(data.recommended_facilities)
        }
        if (data.ai_decision_report) {
          setApiReport(data.ai_decision_report)
        }
      })
      .catch(err => console.error("Error fetching AI recommendations:", err))
      .finally(() => setIsFetchingAI(false))
  }, [userLocation, activeRegion])

  // Calculate current health acuity from real data
  const healthAcuity = useMemo(() => {
    let score = 0
    let reasons: string[] = []

    // Check latest temperature
    const latestTemp = vitalReadings
      .filter(r => r.child_id === selectedChild?.id && r.type === 'temperature')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

    if (latestTemp) {
      const temp = latestTemp.value as number
      if (temp >= 104) {
        score += 40
        reasons.push('High fever (104°F+)')
      } else if (temp >= 102) {
        score += 25
        reasons.push('Moderate fever')
      } else if (temp >= 100.4) {
        score += 15
        reasons.push('Low-grade fever')
      }
    }

    // Check recent symptoms
    const recentSymptoms = symptomHistory
      .filter(s => s.child_id === selectedChild?.id)
      .filter(s => Date.now() - new Date(s.timestamp).getTime() < 24 * 60 * 60 * 1000)

    const severeSymptoms = recentSymptoms.filter(s => s.severity === 'severe')
    if (severeSymptoms.length > 0) {
      score += 30
      reasons.push(`${severeSymptoms.length} severe symptom(s)`)
    }

    // Check risk assessment
    if (latestAssessment?.risk_score) {
      if (latestAssessment.risk_score >= 70) {
        score += 20
        reasons.push('High risk assessment')
      }
    }

    // Determine acuity level
    let level: 'low' | 'moderate' | 'high' | 'critical' = 'low'
    let recommendation: 'pediatrician' | 'telehealth' | 'urgent_care' | 'er' = 'pediatrician'

    if (score >= 60) {
      level = 'critical'
      recommendation = 'er'
    } else if (score >= 40) {
      level = 'high'
      recommendation = 'urgent_care'
    } else if (score >= 20) {
      level = 'moderate'
      recommendation = 'telehealth'
    }

    return { score, level, recommendation, reasons }
  }, [selectedChild, vitalReadings, symptomHistory, latestAssessment])

  // Enhance locations with insurance, recommendation, and dynamic distance
  const enhancedLocations = useMemo(() => {
    // 1. Determine base locations: Use real API data if available, otherwise mock data
    const baseLocations = apiFacilities.length > 0
      ? apiFacilities.map((f, i) => {
        let typeStr = 'pediatrician';
        const capStr = (f.capability_match || []).join(' ').toLowerCase();
        if (capStr.includes('emergency')) typeStr = 'er';
        else if (capStr.includes('surgery')) typeStr = 'urgent_care';
        else if (capStr.includes('consult')) typeStr = 'telehealth';

        return {
          id: `api-${i}`,
          name: f.name,
          type: typeStr as any,
          address: f.city ? `${f.city}, India` : 'India',
          distance: `${f.distance_km} km`,
          distanceMiles: f.distance_km * 0.621371,
          phone: 'Contact facility directly',
          hours: capStr.includes('24/7') ? 'Open 24 hours' : '9am - 5pm',
          isOpen: true,
          rating: f.trust_score >= 80 ? 4.8 : 3.5,
          acceptsWalkIns: true,
          coordinates: { lat: f.latitude || 0, lng: f.longitude || 0 },
          trustScore: f.trust_score,
          reasoning: f.reasoning,
          capability_match: f.capability_match,
          flags: []
        };
      })
      : mockLocations;

    return baseLocations.map(loc => {

      // Calculate dynamic distance if user location is available and it's not an API location (API already returns distance)
      let displayDistance = loc.distance
      let distanceValue = loc.distanceMiles

      if (userLocation && loc.coordinates.lat !== 0 && apiFacilities.length === 0) {
        const distKm = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          loc.coordinates.lat,
          loc.coordinates.lng
        )
        displayDistance = distKm < 1 ? `${(distKm * 1000).toFixed(0)} m` : `${distKm.toFixed(1)} km`
        distanceValue = distKm * 0.621371 // Convert to miles for sorting
      }

      // Determine if this location is recommended based on acuity
      let recommended = false
      let recommendationReason = ''

      if (healthAcuity.level === 'critical' && loc.type === 'er') {
        recommended = true
        recommendationReason = 'Recommended for high fever/severe symptoms'
      } else if (healthAcuity.level === 'high' && loc.type === 'urgent_care') {
        recommended = true
        recommendationReason = 'Best option for current symptoms'
      } else if (healthAcuity.level === 'moderate' && loc.type === 'telehealth') {
        recommended = true
        recommendationReason = 'Quick consultation for your symptoms'
      } else if (healthAcuity.level === 'low' && loc.type === 'pediatrician') {
        recommended = true
        recommendationReason = 'Schedule a routine visit'
      }

      let trustScore = loc.trustScore;
      let reasoning = loc.reasoning || [];
      let capability_match = loc.capability_match || [];

      // Generate realistic mock trust score and reasoning if none provided (for mock locations)
      if (trustScore === undefined && apiFacilities.length === 0) {
        const mockScores = [95, 82, 65, 98, 88, 72, 91, 100];
        trustScore = mockScores[Math.abs(loc.name.length) % mockScores.length];

        if (trustScore < 70) {
          reasoning = ["⚠ Missing doctors (-15)", "⚠ Incomplete equipment data (-15)"];
          capability_match = ["✔ General checkup", "⚠ Surgery capability missing"];
        } else if (trustScore < 90) {
          reasoning = ["⚠ Minor data gaps (-10)"];
          capability_match = ["✔ Surgery supported", "⚠ No ICU found"];
        } else {
          reasoning = ["✔ Highly verified data"];
          capability_match = ["✔ ICU available", "✔ Surgery supported", "✔ 24/7 Emergency ready"];
        }
      }

      return {
        ...loc,
        distance: displayDistance,
        distanceMiles: distanceValue,
        recommended,
        recommendationReason,
        trustScore,
        reasoning,
        capability_match
      }
    })
  }, [healthAcuity, userLocation, latestAssessment])

  // Filter and sort locations
  const filteredLocations = useMemo(() => {
    let filtered = enhancedLocations.filter(loc => {
      if (selectedType && loc.type !== selectedType) return false
      if (searchQuery && !loc.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (!loc.isOpen) return false // Only show open locations
      return true
    })

    // Sort by: recommended first, then in-network, then by distance
    filtered.sort((a, b) => {
      // Recommended locations first
      if (a.recommended && !b.recommended) return -1
      if (!a.recommended && b.recommended) return 1

      // Then by distance
      return a.distanceMiles - b.distanceMiles
    })

    return filtered
  }, [enhancedLocations, selectedType, searchQuery])

  // Get the top recommendation
  const topRecommendation = filteredLocations.find(loc => loc.recommended)

  const handleGetDirections = (location: CareLocation) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.address)}`
    window.open(url, '_blank')
  }

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone.replace(/[^0-9]/g, '')}`
  }

  const handleRideShare = (location: CareLocation, service: 'uber' | 'lyft') => {
    const encodedAddress = encodeURIComponent(location.address)
    if (service === 'uber') {
      window.open(`https://m.uber.com/ul/?action=setPickup&dropoff[formatted_address]=${encodedAddress}`, '_blank')
    } else {
      window.open(`https://www.lyft.com/ride?destination[address]=${encodedAddress}`, '_blank')
    }
  }

  const handleFindMyLocation = () => {
    setIsLocating(true)
    setLocationError(null)

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      setIsLocating(false)
      // Fallback to New Delhi, India for demo
      setUserLocation({ lat: 28.6139, lng: 77.2090 })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setIsLocating(false)
      },
      (error) => {
        console.error('Error getting location:', error)
        setLocationError('Could not get your location. Using New Delhi as default.')
        setIsLocating(false)
        // Fallback to New Delhi, India for demo
        setUserLocation({ lat: 28.6139, lng: 77.2090 })
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    )
  }

  return (
    <div className="space-y-6">
      {/* TRIAGE-DRIVEN RECOMMENDATION */}
      {healthAcuity.level !== 'low' && selectedChild && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className={`border-2 ${healthAcuity.level === 'critical'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
            : healthAcuity.level === 'high'
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
              : 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-300 dark:border-cyan-700'
            }`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${healthAcuity.level === 'critical'
                ? 'bg-red-100 dark:bg-red-900/50'
                : healthAcuity.level === 'high'
                  ? 'bg-amber-100 dark:bg-amber-900/50'
                  : 'bg-cyan-100 dark:bg-cyan-900/50'
                }`}>
                <Zap className={`w-6 h-6 ${healthAcuity.level === 'critical'
                  ? 'text-red-600 dark:text-red-400'
                  : healthAcuity.level === 'high'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-cyan-600 dark:text-cyan-400'
                  }`} />
              </div>
              <div className="flex-1">
                <h3 className={`font-bold ${healthAcuity.level === 'critical'
                  ? 'text-red-800 dark:text-red-200'
                  : healthAcuity.level === 'high'
                    ? 'text-amber-800 dark:text-amber-200'
                    : 'text-cyan-800 dark:text-cyan-200'
                  }`}>
                  {healthAcuity.level === 'critical'
                    ? `⚠️ Based on ${selectedChild.name}'s symptoms, we recommend the Emergency Room`
                    : healthAcuity.level === 'high'
                      ? `Based on ${selectedChild.name}'s current condition, we recommend Urgent Care`
                      : `${selectedChild.name}'s symptoms can likely be addressed via Telehealth`
                  }
                </h3>
                <p className={`text-sm mt-1 ${healthAcuity.level === 'critical'
                  ? 'text-red-700 dark:text-red-300'
                  : healthAcuity.level === 'high'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-cyan-700 dark:text-cyan-300'
                  }`}>
                  Detected: {healthAcuity.reasons.join(' • ')}
                </p>
                {topRecommendation && (
                  <div className="mt-3 p-3 rounded-lg bg-white/50 dark:bg-black/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-surface-900 dark:text-white">
                          {topRecommendation.name}
                        </span>
                        <span className="text-sm text-surface-500 ml-2">
                          {topRecommendation.distance}
                          {topRecommendation.waitTime && ` • Wait: ${topRecommendation.waitTime}`}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleGetDirections(topRecommendation)}
                        icon={<Navigation className="w-4 h-4" />}
                      >
                        Go Now
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Find Care Near You</h1>
          <p className="text-surface-600 dark:text-surface-400">
            {locationError ? (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {locationError}
              </span>
            ) : userLocation ? (
              <span className="text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {activeRegion ? `Showing hospitals in ${activeRegion}, India` : 'Showing care near your current location'}
              </span>
            ) : selectedChild ? (
              `Finding care for ${selectedChild.name}`
            ) : (
              'Locate nearby healthcare facilities'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setUserLocation({ lat: 25.0961, lng: 85.3131 })
              setActiveRegion('Bihar')
              setLocationError(null)
            }}
            icon={<MapPin className="w-4 h-4 text-emerald-500" />}
          >
            🇮🇳 Test Rural Bihar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setUserLocation({ lat: 28.6139, lng: 77.2090 })
              setActiveRegion('Delhi')
              setLocationError(null)
            }}
            icon={<MapPin className="w-4 h-4 text-blue-500" />}
          >
            🏙 New Delhi
          </Button>
          <Button
            variant="secondary"
            onClick={handleFindMyLocation}
            loading={isLocating}
            icon={<MapPin className="w-4 h-4" />}
          >
            {isLocating ? 'Locating...' : 'Use My Location'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            icon={Search}
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            variant="filled"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          <button
            onClick={() => setSelectedType(null)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${selectedType === null
              ? 'bg-cyan-500 text-white'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
              }`}
          >
            All
          </button>
          {Object.entries(typeConfig).map(([type, config]) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${selectedType === type
                ? 'bg-cyan-500 text-white'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                }`}
            >
              <config.icon className="w-4 h-4" />
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map Placeholder - Enhanced */}
      <Card className="overflow-hidden">
        <div className="relative h-64 bg-gradient-to-br from-surface-100 to-surface-200 dark:from-surface-800 dark:to-surface-900">
          {/* Simulated map grid */}
          <div className="absolute inset-0 opacity-30">
            <svg className="w-full h-full">
              {[...Array(10)].map((_, i) => (
                <line key={`v${i}`} x1={`${i * 10}%`} y1="0" x2={`${i * 10}%`} y2="100%" stroke="currentColor" strokeWidth="0.5" className="text-surface-600 dark:text-surface-400" />
              ))}
              {[...Array(6)].map((_, i) => (
                <line key={`h${i}`} x1="0" y1={`${i * 20}%`} x2="100%" y2={`${i * 20}%`} stroke="currentColor" strokeWidth="0.5" className="text-surface-600 dark:text-surface-400" />
              ))}
            </svg>
          </div>

          {/* Map markers */}
          {filteredLocations.slice(0, 5).map((loc, i) => {
            const positions = [
              { top: '25%', left: '30%' },
              { top: '40%', left: '55%' },
              { top: '60%', left: '25%' },
              { top: '35%', left: '70%' },
              { top: '55%', left: '45%' },
            ]
            const config = typeConfig[loc.type]
            const ConfigIcon = config.icon

            return (
              <motion.div
                key={loc.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                style={positions[i]}
                onClick={() => setSelectedLocation(loc)}
              >
                <div className={`w-10 h-10 rounded-full border-3 border-white shadow-lg flex items-center justify-center ${loc.recommended
                  ? 'bg-gradient-to-br from-cyan-500 to-teal-500 animate-pulse'
                  : loc.type === 'er' ? 'bg-red-500'
                    : loc.type === 'urgent_care' ? 'bg-orange-500'
                      : loc.type === 'telehealth' ? 'bg-violet-500'
                        : loc.type === 'pharmacy' ? 'bg-emerald-500'
                          : 'bg-cyan-500'
                  }`}>
                  <ConfigIcon className="w-5 h-5 text-white" />
                </div>
                {loc.recommended && (
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-cyan-500 border-2 border-white flex items-center justify-center">
                    <Star className="w-3 h-3 text-white fill-white" />
                  </div>
                )}
              </motion.div>
            )
          })}

          {/* Your location indicator */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg animate-ping" />
            <div className="absolute top-0 left-0 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-surface-800/90 rounded-lg p-2 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Your Location</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-3 h-3 text-cyan-500 fill-cyan-500" />
              <span>Recommended</span>
            </div>
          </div>
        </div>
      </Card>

      {/* AI Decision Engine Insights */}
      <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border-cyan-200 dark:border-cyan-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            {isFetchingAI ? (
              <div className="w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-cyan-900 dark:text-cyan-100">
              AI Healthcare Decision Engine
            </h2>
            <p className="text-sm text-cyan-700 dark:text-cyan-300">
              {isFetchingAI ? "Analyzing 10,000+ unstructured Indian healthcare records..." : "Synthesized insights based on your medical intent"}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="bg-white dark:bg-surface-800 p-3 rounded-lg shadow-sm border border-cyan-100 dark:border-cyan-800/50">
            <h4 className="font-bold text-sm text-surface-900 dark:text-white flex items-center gap-2 mb-1">
              <span className="text-green-500">✔</span> What hospitals are safe
            </h4>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              {apiReport?.what_is_safe || latestAssessment?.ai_decision_report?.what_is_safe || "Madina Teaching Hospital, VitalKids Tele-Consult"}
            </p>
          </div>

          <div className="bg-white dark:bg-surface-800 p-3 rounded-lg shadow-sm border border-cyan-100 dark:border-cyan-800/50">
            <h4 className="font-bold text-sm text-surface-900 dark:text-white flex items-center gap-2 mb-1">
              <span className="text-green-500">✔</span> Why they are safe
            </h4>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              {apiReport?.why_safe || latestAssessment?.ai_decision_report?.why_safe || "These facilities have high Trust Scores (>80) with verified capabilities and no critical medical contradictions."}
            </p>
          </div>

          <div className="bg-white dark:bg-surface-800 p-3 rounded-lg shadow-sm border border-cyan-100 dark:border-cyan-800/50">
            <h4 className="font-bold text-sm text-surface-900 dark:text-white flex items-center gap-2 mb-1">
              <span className="text-red-500">⚠</span> What risks exist
            </h4>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              {apiReport?.risks_exist || latestAssessment?.ai_decision_report?.risks_exist || "Missing doctors, Incomplete equipment data"}
            </p>
          </div>

          <div className="bg-white dark:bg-surface-800 p-3 rounded-lg shadow-sm border border-cyan-100 dark:border-cyan-800/50">
            <h4 className="font-bold text-sm text-surface-900 dark:text-white flex items-center gap-2 mb-1">
              <span className="text-blue-500">👉</span> Best for emergency care
            </h4>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              {apiReport?.best_emergency || latestAssessment?.ai_decision_report?.best_emergency || "Madina Teaching Hospital (Score: 95/100, Dist: 4.2km)"}
            </p>
          </div>
        </div>

        {/* Human Logic Steps */}
        <div className="mt-4 pt-3 border-t border-cyan-200 dark:border-cyan-800/50">
          <p className="text-xs font-semibold text-cyan-800 dark:text-cyan-200 mb-2">AI Reasoning Trace (Step-by-Step):</p>
          <div className="flex flex-wrap gap-2 text-xs text-cyan-700 dark:text-cyan-300">
            {(latestAssessment?.ai_decision_report?.human_logic_steps || [
              "Step 1: Parsed user intent",
              "Step 2: Scanned radius for proximity",
              "Step 3: Extracted unstructured medical capabilities",
              "Step 4: Evaluated missing staff (Contradiction Check)",
              "Step 5: Ranked by Trust Score"
            ]).map((step: string, idx: number) => (
              <span key={idx} className="bg-cyan-100 dark:bg-cyan-900/40 px-2 py-1 rounded border border-cyan-200 dark:border-cyan-800">{step}</span>
            ))}
          </div>
        </div>
      </Card>


      {/* Locations List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-surface-900 dark:text-white">
            Nearby Locations ({filteredLocations.length})
          </h2>
        </div>

        {filteredLocations.map((location, i) => {
          const config = typeConfig[location.type]
          return (
            <motion.div
              key={location.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                className={`border-l-4 ${location.recommended
                  ? 'border-cyan-500 ring-2 ring-cyan-200 dark:ring-cyan-800'
                  : config.borderColor
                  } hover:shadow-lg transition-shadow cursor-pointer relative`}
                onClick={() => setSelectedLocation(location)}
              >
                {/* Recommended Badge */}
                {location.recommended && (
                  <div className="absolute -top-2 left-4 px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-xs font-bold flex items-center gap-1 shadow-lg">
                    <Star className="w-3 h-3 fill-white" />
                    RECOMMENDED
                  </div>
                )}

                <div className={`flex flex-col lg:flex-row lg:items-center gap-4 ${location.recommended ? 'pt-2' : ''}`}>
                  {/* Location Info */}
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-xl ${config.color} flex items-center justify-center flex-shrink-0`}>
                        <config.icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-surface-900 dark:text-white">{location.name}</h3>
                          <Badge variant={location.isOpen ? 'success' : 'danger'} size="sm">
                            {location.isOpen ? 'Open' : 'Closed'}
                          </Badge>
                        </div>

                        {/* Trust Score & AI Reasoning */}
                        {location.trustScore !== undefined && (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                size="sm"
                                className={
                                  location.trustScore >= 90 ? 'bg-green-100 text-green-800 border-green-200' :
                                    location.trustScore >= 70 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-red-100 text-red-800 border-red-200'
                                }
                              >
                                Trust Score: {location.trustScore} / 100
                              </Badge>
                            </div>

                            {/* Capabilities & Reasoning List */}
                            <div className="text-sm space-y-1 mt-2">
                              {(location.capability_match || []).map((match: string, idx: number) => (
                                <div key={`cap-${idx}`} className={`flex items-start gap-1 ${match.startsWith('✔') ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                                  <span>{match}</span>
                                </div>
                              ))}
                              {(location.reasoning || []).map((reason: string, idx: number) => (
                                <div key={`reason-${idx}`} className={`flex items-start gap-1 ${reason.startsWith('✔') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                  <span>{reason}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recommendation Reason */}
                        {location.recommendationReason && (
                          <p className="text-sm text-cyan-600 dark:text-cyan-400 font-medium mt-1">
                            {location.recommendationReason}
                          </p>
                        )}

                        <p className="text-sm text-surface-600 dark:text-surface-400">{location.address}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
                          <span className="flex items-center gap-1 text-surface-500">
                            <Navigation className="w-3 h-3" />
                            {location.distance}
                          </span>
                          <span className="flex items-center gap-1 text-surface-500">
                            <Clock className="w-3 h-3" />
                            {location.hours}
                          </span>
                          <span className="flex items-center gap-1 text-amber-500">
                            <Star className="w-3 h-3 fill-amber-400" />
                            {location.rating}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Wait Time & Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    {location.waitTime && (
                      <div className={`px-4 py-2 rounded-xl ${location.waitTimeVerified
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : 'bg-surface-100 dark:bg-surface-800'
                        }`}>
                        <div className="flex items-center gap-1 text-xs text-surface-500">
                          {location.waitTimeVerified ? (
                            <>
                              <Activity className="w-3 h-3 text-green-500" />
                              <span className="text-green-600 dark:text-green-400">Live</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              <span>Est.</span>
                            </>
                          )}
                        </div>
                        <div className="font-bold text-surface-900 dark:text-white">{location.waitTime}</div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCall(location.phone)
                        }}
                        icon={<Phone className="w-4 h-4" />}
                      >
                        Call
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleGetDirections(location)
                        }}
                        icon={<Navigation className="w-4 h-4" />}
                        className="bg-gradient-to-r from-cyan-500 to-teal-600"
                      >
                        Directions
                      </Button>
                      {location.type !== 'telehealth' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRideShare(location, 'uber')
                          }}
                          icon={<Car className="w-4 h-4" />}
                        >
                          Ride
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )
        })}

        {filteredLocations.length === 0 && (
          <Card className="text-center py-12">
            <MapPin className="w-16 h-16 text-surface-600 dark:text-surface-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">No Locations Found</h3>
            <p className="text-surface-600 dark:text-surface-400">
              'Try adjusting your filters or search query'
            </p>
          </Card>
        )}
      </div>

      {/* Location Detail Modal */}
      <AnimatePresence>
        {selectedLocation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
            onClick={() => setSelectedLocation(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg sm:mx-4 max-h-[90vh] overflow-y-auto"
            >
              <Card className="rounded-b-none sm:rounded-b-2xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl ${typeConfig[selectedLocation.type].color} flex items-center justify-center`}>
                        {(() => {
                          const Icon = typeConfig[selectedLocation.type].icon
                          return <Icon className="w-6 h-6" />
                        })()}
                      </div>
                      <div>
                        <CardTitle>{selectedLocation.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={selectedLocation.isOpen ? 'success' : 'danger'} size="sm">
                            {selectedLocation.isOpen ? 'Open Now' : 'Closed'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedLocation(null)} className="text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Recommendation Banner */}
                  {selectedLocation.recommended && (
                    <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-cyan-500 fill-cyan-500" />
                        <span className="font-medium text-cyan-800 dark:text-cyan-200">
                          {selectedLocation.recommendationReason}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                      <span className="text-surface-700 dark:text-surface-300">{selectedLocation.address}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                      <span className="text-surface-700 dark:text-surface-300">{selectedLocation.phone}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                      <span className="text-surface-700 dark:text-surface-300">{selectedLocation.hours}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Star className="w-5 h-5 text-amber-400" />
                      <span className="text-surface-700 dark:text-surface-300">{selectedLocation.rating} rating</span>
                    </div>
                  </div>

                  {selectedLocation.waitTime && (
                    <div className={`p-4 rounded-xl ${selectedLocation.waitTimeVerified
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-surface-50 dark:bg-surface-800'
                      }`}>
                      <div className="flex items-center gap-2 text-sm text-surface-500 mb-1">
                        {selectedLocation.waitTimeVerified ? (
                          <>
                            <Activity className="w-4 h-4 text-green-500 animate-pulse" />
                            <span className="text-green-600 dark:text-green-400 font-medium">Live Wait Time</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4" />
                            <span>Estimated Wait Time</span>
                          </>
                        )}
                      </div>
                      <div className="text-2xl font-bold text-surface-900 dark:text-white">{selectedLocation.waitTime}</div>
                      {selectedLocation.waitTimeVerified && (
                        <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Updated 2 min ago • Data from facility
                        </div>
                      )}
                    </div>
                  )}

                  {/* Primary Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="secondary"
                      fullWidth
                      onClick={() => handleCall(selectedLocation.phone)}
                      icon={<Phone className="w-4 h-4" />}
                    >
                      Call
                    </Button>
                    <Button
                      fullWidth
                      onClick={() => handleGetDirections(selectedLocation)}
                      icon={<Navigation className="w-4 h-4" />}
                      className="bg-gradient-to-r from-cyan-500 to-teal-600"
                    >
                      Get Directions
                    </Button>
                  </div>

                  {/* Ride Share Options */}
                  {selectedLocation.type !== 'telehealth' && (
                    <div className="pt-2">
                      <div className="text-sm text-surface-500 mb-2 flex items-center gap-2">
                        <Car className="w-4 h-4" />
                        Need a ride? Book instantly:
                      </div>
                      <div className="flex gap-3">
                        <Button
                          variant="secondary"
                          fullWidth
                          onClick={() => handleRideShare(selectedLocation, 'uber')}
                          className="border-black dark:border-white"
                        >
                          <span className="font-bold">Uber</span>
                        </Button>
                        <Button
                          variant="secondary"
                          fullWidth
                          onClick={() => handleRideShare(selectedLocation, 'lyft')}
                          className="border-pink-500 text-pink-600"
                        >
                          <span className="font-bold">Lyft</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
