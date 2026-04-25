'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Heart,
  Smile,
  Frown,
  Meh,
  Wind,
  Shield,
  Activity,
  Palette,
  Users,
  Sparkles,
  Phone,
  MessageCircle,
  Globe,
  AlertTriangle,
  BookOpen,
  Plus,
  ChevronRight,
  X,
  Check,
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  Zap,
  Moon,
  Sun,
  Battery,
  Target,
  Award,
  Anchor,
  Eye,
  Box,
  ListOrdered,
  Loader2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import useStore from '@/store/useStore'

// Types
type MoodLevel = 'very_sad' | 'sad' | 'neutral' | 'happy' | 'very_happy'
type CopingCategory = 'breathing' | 'grounding' | 'movement' | 'creative' | 'social' | 'mindfulness' | 'distraction'

interface MoodEntry {
  id: string
  child_id: string
  timestamp: string
  mood_level: MoodLevel
  energy_level: number
  anxiety_level: number
  sleep_quality?: number
  notes?: string
  triggers?: string[]
  activities?: string[]
}

interface CopingStrategy {
  id: string
  name: string
  description: string
  category: CopingCategory
  age_appropriate_min: number
  age_appropriate_max: number
  duration_minutes: number
  steps: string[]
  benefits: string[]
  when_to_use: string[]
  icon: string
}

interface JournalEntry {
  id: string
  child_id: string
  timestamp: string
  title?: string
  content: string
  mood_before?: MoodLevel
  mood_after?: MoodLevel
  is_private: boolean
  tags?: string[]
}

interface CrisisResource {
  name: string
  description: string
  phone?: string
  text_line?: string
  website?: string
  available_24_7: boolean
  for_children: boolean
  for_parents: boolean
}

// Mood configuration
const moodConfig: Record<MoodLevel, { icon: typeof Smile; color: string; label: string; bg: string }> = {
  very_happy: { icon: Smile, color: 'text-emerald-500', label: 'Great!', bg: 'bg-emerald-500' },
  happy: { icon: Smile, color: 'text-primary-500', label: 'Good', bg: 'bg-primary-500' },
  neutral: { icon: Meh, color: 'text-amber-500', label: 'Okay', bg: 'bg-amber-500' },
  sad: { icon: Frown, color: 'text-orange-500', label: 'Not Great', bg: 'bg-orange-500' },
  very_sad: { icon: Frown, color: 'text-red-500', label: 'Struggling', bg: 'bg-red-500' },
}

// Category icons
const categoryIcons: Record<CopingCategory, typeof Wind> = {
  breathing: Wind,
  grounding: Anchor,
  movement: Activity,
  creative: Palette,
  social: Users,
  mindfulness: Brain,
  distraction: Sparkles,
}

const categoryColors: Record<CopingCategory, string> = {
  breathing: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  grounding: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  movement: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  creative: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  social: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  mindfulness: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  distraction: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

// Demo coping strategies
const demoCopingStrategies: CopingStrategy[] = [
  {
    id: 'breathe_1',
    name: 'Bubble Breathing',
    description: 'Pretend you\'re blowing bubbles to slow down your breathing',
    category: 'breathing',
    age_appropriate_min: 3,
    age_appropriate_max: 10,
    duration_minutes: 3,
    steps: [
      'Get comfortable and close your eyes',
      'Imagine you\'re holding a bubble wand',
      'Take a deep breath in through your nose (count to 4)',
      'Slowly blow out through your mouth like you\'re making a big bubble',
      'Watch your imaginary bubble float away',
      'Repeat 5 times'
    ],
    benefits: ['Calms the nervous system', 'Reduces anxiety quickly', 'Easy to do anywhere'],
    when_to_use: ['Feeling anxious', 'Before bed', 'After an upsetting event'],
    icon: 'wind'
  },
  {
    id: 'ground_1',
    name: '5-4-3-2-1 Grounding',
    description: 'Use your senses to come back to the present moment',
    category: 'grounding',
    age_appropriate_min: 5,
    age_appropriate_max: 18,
    duration_minutes: 5,
    steps: [
      'Look around and name 5 things you can SEE',
      'Touch and name 4 things you can FEEL',
      'Listen and name 3 things you can HEAR',
      'Notice 2 things you can SMELL',
      'Name 1 thing you can TASTE'
    ],
    benefits: ['Stops spiraling thoughts', 'Brings focus to present', 'Works during panic'],
    when_to_use: ['Feeling disconnected', 'Anxious thoughts racing', 'Panic attack starting'],
    icon: 'eye'
  },
  {
    id: 'move_1',
    name: 'Butterfly Hug',
    description: 'Self-soothing technique using bilateral stimulation',
    category: 'movement',
    age_appropriate_min: 4,
    age_appropriate_max: 18,
    duration_minutes: 5,
    steps: [
      'Cross your arms over your chest, hands on shoulders',
      'Your hands are like butterfly wings',
      'Slowly tap alternating hands - left, right, left, right',
      'Keep a slow, steady rhythm',
      'Close your eyes and think of something calming',
      'Continue for 2-3 minutes'
    ],
    benefits: ['Self-soothing', 'Can be done discreetly', 'EMDR-based technique'],
    when_to_use: ['Feeling sad or scared', 'After upsetting news', 'Need comfort'],
    icon: 'heart'
  },
  {
    id: 'creative_1',
    name: 'Worry Box',
    description: 'Write down worries to get them out of your head',
    category: 'creative',
    age_appropriate_min: 5,
    age_appropriate_max: 14,
    duration_minutes: 10,
    steps: [
      'Get a box or container (decorate it if you want!)',
      'Write each worry on a small piece of paper',
      'Fold the paper and put it in the box',
      'Close the box - your worries are safe there',
      'You can throw them away later or talk about them with someone',
      'The worries don\'t need to stay in your head'
    ],
    benefits: ['Externalizes worries', 'Creates sense of control', 'Good for bedtime worries'],
    when_to_use: ['Mind won\'t stop worrying', 'Before sleep', 'Feeling overwhelmed'],
    icon: 'box'
  },
]

// Demo crisis resources
const crisisResources: CrisisResource[] = [
  {
    name: 'Umang Pakistan',
    description: 'Mental health helpline providing 24/7 free counseling',
    phone: '0311-7786264',
    website: 'https://www.umang.com.pk',
    available_24_7: true,
    for_children: true,
    for_parents: true
  },
  {
    name: 'Talk2Me.pk',
    description: 'Online counseling and emotional support platform',
    website: 'https://talk2me.pk',
    available_24_7: true,
    for_children: true,
    for_parents: true
  },
  {
    name: 'Sehat Kahani',
    description: 'Telehealth platform with mental health specialists',
    phone: '021-38222222',
    website: 'https://sehatkahani.com',
    available_24_7: true,
    for_children: true,
    for_parents: true
  },
]

// Common triggers
const commonTriggers = [
  'School stress', 'Friendship issues', 'Family conflict', 'Sleep problems',
  'Health worries', 'Social media', 'Tests/homework', 'Change in routine',
  'Being alone', 'Crowds', 'Performance anxiety', 'Separation'
]

// Common activities
const commonActivities = [
  'Exercise', 'Reading', 'Playing games', 'Watching TV',
  'Talking to friends', 'Art/crafts', 'Music', 'Outside time',
  'Family time', 'Screen time', 'Sports', 'Relaxing'
]

export default function MentalHealthPage() {
  const { selectedChild, children } = useStore()
  
  // State
  const [activeTab, setActiveTab] = useState<'mood' | 'coping' | 'journal' | 'crisis'>('mood')
  const [showMoodLogger, setShowMoodLogger] = useState(false)
  const [showJournalEditor, setShowJournalEditor] = useState(false)
  const [showStrategyDetail, setShowStrategyDetail] = useState<CopingStrategy | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<CopingCategory | 'all'>('all')
  
  // Mood logger state
  const [moodLevel, setMoodLevel] = useState<MoodLevel>('neutral')
  const [energyLevel, setEnergyLevel] = useState(3)
  const [anxietyLevel, setAnxietyLevel] = useState(3)
  const [sleepQuality, setSleepQuality] = useState(3)
  const [moodNotes, setMoodNotes] = useState('')
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([])
  const [selectedActivities, setSelectedActivities] = useState<string[]>([])
  
  // Journal state
  const [journalTitle, setJournalTitle] = useState('')
  const [journalContent, setJournalContent] = useState('')
  const [journalMoodBefore, setJournalMoodBefore] = useState<MoodLevel | null>(null)
  
  // Demo data
  const [moodHistory, setMoodHistory] = useState<MoodEntry[]>([
    {
      id: 'mood_1',
      child_id: selectedChild?.id || 'demo',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      mood_level: 'happy',
      energy_level: 4,
      anxiety_level: 2,
      sleep_quality: 4,
      notes: 'Had a great day at school!',
      triggers: [],
      activities: ['Playing games', 'Outside time']
    },
    {
      id: 'mood_2',
      child_id: selectedChild?.id || 'demo',
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      mood_level: 'neutral',
      energy_level: 3,
      anxiety_level: 5,
      sleep_quality: 3,
      notes: 'Worried about the math test',
      triggers: ['Tests/homework'],
      activities: ['Reading']
    },
    {
      id: 'mood_3',
      child_id: selectedChild?.id || 'demo',
      timestamp: new Date(Date.now() - 259200000).toISOString(),
      mood_level: 'sad',
      energy_level: 2,
      anxiety_level: 6,
      sleep_quality: 2,
      triggers: ['Friendship issues', 'Sleep problems'],
      activities: ['Screen time']
    },
  ])
  
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([
    {
      id: 'journal_1',
      child_id: selectedChild?.id || 'demo',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      title: 'Best Day Ever!',
      content: 'Today was amazing! I scored a goal in soccer and my friends threw me a surprise party. I felt so happy and loved. I want to remember this feeling.',
      mood_before: 'neutral',
      mood_after: 'very_happy',
      is_private: false,
      tags: ['happy', 'friends', 'soccer']
    },
    {
      id: 'journal_2',
      child_id: selectedChild?.id || 'demo',
      timestamp: new Date(Date.now() - 259200000).toISOString(),
      title: 'Feeling worried',
      content: 'I have a big presentation tomorrow and I\'m really nervous. What if I forget what to say? I tried the breathing exercises and they helped a little.',
      mood_before: 'sad',
      mood_after: 'neutral',
      is_private: true,
      tags: ['anxious', 'school']
    },
  ])

  // Filter strategies by age and category
  const filteredStrategies = useMemo(() => {
    const age = selectedChild?.date_of_birth 
      ? Math.floor((Date.now() - new Date(selectedChild.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : 8
    
    return demoCopingStrategies.filter(s => {
      const ageMatch = s.age_appropriate_min <= age && age <= s.age_appropriate_max
      const categoryMatch = selectedCategory === 'all' || s.category === selectedCategory
      return ageMatch && categoryMatch
    })
  }, [selectedChild, selectedCategory])

  // Calculate mood summary
  const moodSummary = useMemo(() => {
    if (moodHistory.length === 0) return null
    
    const moodValues: Record<MoodLevel, number> = {
      very_sad: 1, sad: 2, neutral: 3, happy: 4, very_happy: 5
    }
    
    const avgMood = moodHistory.reduce((sum, e) => sum + moodValues[e.mood_level], 0) / moodHistory.length
    const avgAnxiety = moodHistory.reduce((sum, e) => sum + e.anxiety_level, 0) / moodHistory.length
    const avgEnergy = moodHistory.reduce((sum, e) => sum + e.energy_level, 0) / moodHistory.length
    
    // Trend (compare last entry to average)
    const lastMood = moodValues[moodHistory[0].mood_level]
    const trend = lastMood > avgMood ? 'improving' : lastMood < avgMood ? 'declining' : 'stable'
    
    return { avgMood, avgAnxiety, avgEnergy, trend, totalEntries: moodHistory.length }
  }, [moodHistory])

  // Log mood
  const handleLogMood = () => {
    const entry: MoodEntry = {
      id: `mood_${Date.now()}`,
      child_id: selectedChild?.id || 'demo',
      timestamp: new Date().toISOString(),
      mood_level: moodLevel,
      energy_level: energyLevel,
      anxiety_level: anxietyLevel,
      sleep_quality: sleepQuality,
      notes: moodNotes || undefined,
      triggers: selectedTriggers.length > 0 ? selectedTriggers : undefined,
      activities: selectedActivities.length > 0 ? selectedActivities : undefined,
    }
    
    setMoodHistory([entry, ...moodHistory])
    setShowMoodLogger(false)
    
    // Reset form
    setMoodLevel('neutral')
    setEnergyLevel(3)
    setAnxietyLevel(3)
    setSleepQuality(3)
    setMoodNotes('')
    setSelectedTriggers([])
    setSelectedActivities([])
  }

  // Save journal entry
  const handleSaveJournal = () => {
    const entry: JournalEntry = {
      id: `journal_${Date.now()}`,
      child_id: selectedChild?.id || 'demo',
      timestamp: new Date().toISOString(),
      title: journalTitle || undefined,
      content: journalContent,
      mood_before: journalMoodBefore || undefined,
      is_private: true,
      tags: []
    }
    
    setJournalEntries([entry, ...journalEntries])
    setShowJournalEditor(false)
    
    // Reset form
    setJournalTitle('')
    setJournalContent('')
    setJournalMoodBefore(null)
  }

  const child = selectedChild || children[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            Mental Wellness
          </h1>
          <p className="text-surface-500 dark:text-surface-400 mt-1">
            Track mood, learn coping skills, and find support
          </p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button
            onClick={() => setShowMoodLogger(true)}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Log Mood
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'mood' as const, label: 'Mood Tracker', icon: Heart },
          { id: 'coping' as const, label: 'Coping Tools', icon: Shield },
          { id: 'journal' as const, label: 'Journal', icon: BookOpen },
          { id: 'crisis' as const, label: 'Get Help', icon: Phone },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap
              ${activeTab === tab.id
                ? 'bg-primary-500 text-white'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
              }
            `}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {/* MOOD TRACKER TAB */}
        {activeTab === 'mood' && (
          <motion.div
            key="mood"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Mood Summary Cards */}
            {moodSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
                  <CardContent className="p-4">
                    <div className="text-xs text-surface-500 dark:text-surface-400 uppercase font-medium">Average Mood</div>
                    <div className="text-2xl font-bold text-surface-900 dark:text-white mt-1">
                      {moodSummary.avgMood.toFixed(1)}/5
                    </div>
                    <div className={`text-xs mt-1 flex items-center gap-1 ${
                      moodSummary.trend === 'improving' ? 'text-emerald-500' : 
                      moodSummary.trend === 'declining' ? 'text-red-500' : 'text-amber-500'
                    }`}>
                      {moodSummary.trend === 'improving' ? <TrendingUp className="w-3 h-3" /> : 
                       moodSummary.trend === 'declining' ? <TrendingDown className="w-3 h-3" /> : null}
                      {moodSummary.trend}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
                  <CardContent className="p-4">
                    <div className="text-xs text-surface-500 dark:text-surface-400 uppercase font-medium">Anxiety Level</div>
                    <div className="text-2xl font-bold text-surface-900 dark:text-white mt-1">
                      {moodSummary.avgAnxiety.toFixed(1)}/10
                    </div>
                    <div className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-full mt-2">
                      <div 
                        className={`h-full rounded-full ${
                          moodSummary.avgAnxiety <= 3 ? 'bg-emerald-500' :
                          moodSummary.avgAnxiety <= 6 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${moodSummary.avgAnxiety * 10}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
                  <CardContent className="p-4">
                    <div className="text-xs text-surface-500 dark:text-surface-400 uppercase font-medium">Energy Level</div>
                    <div className="text-2xl font-bold text-surface-900 dark:text-white mt-1">
                      {moodSummary.avgEnergy.toFixed(1)}/5
                    </div>
                    <div className="flex gap-1 mt-2">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div 
                          key={i}
                          className={`h-2 flex-1 rounded-full ${
                            i <= Math.round(moodSummary.avgEnergy) ? 'bg-amber-500' : 'bg-surface-200 dark:bg-surface-700'
                          }`}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
                  <CardContent className="p-4">
                    <div className="text-xs text-surface-500 dark:text-surface-400 uppercase font-medium">Entries</div>
                    <div className="text-2xl font-bold text-surface-900 dark:text-white mt-1">
                      {moodSummary.totalEntries}
                    </div>
                    <div className="text-xs text-surface-500 mt-1">
                      Last 7 days
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Mood History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-500" />
                  Mood History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {moodHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <Heart className="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
                    <p className="text-surface-500">No mood entries yet</p>
                    <Button onClick={() => setShowMoodLogger(true)} className="mt-4">
                      <Plus className="w-4 h-4 mr-2" />
                      Log Your First Mood
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {moodHistory.map((entry, index) => {
                      const config = moodConfig[entry.mood_level]
                      const Icon = config.icon
                      return (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-start gap-4 p-4 rounded-xl bg-surface-50 dark:bg-surface-800/50"
                        >
                          <div className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`font-semibold ${config.color}`}>{config.label}</span>
                              <span className="text-xs text-surface-500">
                                {new Date(entry.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge variant="secondary" size="sm">
                                <Zap className="w-3 h-3 mr-1" />
                                Energy: {entry.energy_level}/5
                              </Badge>
                              <Badge variant={entry.anxiety_level > 5 ? 'warning' : 'secondary'} size="sm">
                                Anxiety: {entry.anxiety_level}/10
                              </Badge>
                              {entry.sleep_quality && (
                                <Badge variant="secondary" size="sm">
                                  <Moon className="w-3 h-3 mr-1" />
                                  Sleep: {entry.sleep_quality}/5
                                </Badge>
                              )}
                            </div>
                            {entry.notes && (
                              <p className="text-sm text-surface-600 dark:text-surface-400 mt-2">
                                {entry.notes}
                              </p>
                            )}
                            {entry.triggers && entry.triggers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {entry.triggers.map(t => (
                                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* COPING TOOLS TAB */}
        {activeTab === 'coping' && (
          <motion.div
            key="coping"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  selectedCategory === 'all'
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                }`}
              >
                All
              </button>
              {Object.entries(categoryIcons).map(([cat, Icon]) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat as CopingCategory)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-primary-500 text-white'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>

            {/* Strategies Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStrategies.map((strategy, index) => {
                const Icon = categoryIcons[strategy.category]
                return (
                  <motion.div
                    key={strategy.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card 
                      className="h-full cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => setShowStrategyDetail(strategy)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${categoryColors[strategy.category]}`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-surface-900 dark:text-white">
                              {strategy.name}
                            </h3>
                            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                              {strategy.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-200 dark:border-surface-700">
                          <div className="flex items-center gap-2 text-xs text-surface-500">
                            <Clock className="w-3 h-3" />
                            {strategy.duration_minutes} min
                          </div>
                          <Button variant="ghost" size="sm">
                            Try It <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* JOURNAL TAB */}
        {activeTab === 'journal' && (
          <motion.div
            key="journal"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <p className="text-surface-500 dark:text-surface-400">
                Writing about your feelings can help you understand them better
              </p>
              <Button onClick={() => setShowJournalEditor(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Entry
              </Button>
            </div>

            {/* Journal Entries */}
            <div className="space-y-4">
              {journalEntries.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <BookOpen className="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
                    <p className="text-surface-500">Start your first journal entry</p>
                    <Button onClick={() => setShowJournalEditor(true)} className="mt-4">
                      <Plus className="w-4 h-4 mr-2" />
                      Write Something
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                journalEntries.map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            {entry.title && (
                              <h3 className="font-semibold text-surface-900 dark:text-white text-lg">
                                {entry.title}
                              </h3>
                            )}
                            <span className="text-sm text-surface-500">
                              {new Date(entry.timestamp).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          {entry.mood_before && entry.mood_after && (
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full ${moodConfig[entry.mood_before].bg} flex items-center justify-center`}>
                                {(() => {
                                  const Icon = moodConfig[entry.mood_before].icon
                                  return <Icon className="w-4 h-4 text-white" />
                                })()}
                              </div>
                              <ChevronRight className="w-4 h-4 text-surface-400" />
                              <div className={`w-8 h-8 rounded-full ${moodConfig[entry.mood_after].bg} flex items-center justify-center`}>
                                {(() => {
                                  const Icon = moodConfig[entry.mood_after].icon
                                  return <Icon className="w-4 h-4 text-white" />
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-surface-700 dark:text-surface-300 whitespace-pre-wrap">
                          {entry.content}
                        </p>
                        {entry.tags && entry.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-4">
                            {entry.tags.map(tag => (
                              <Badge key={tag} variant="secondary" size="sm">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* CRISIS RESOURCES TAB */}
        {activeTab === 'crisis' && (
          <motion.div
            key="crisis"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Emergency Banner */}
            <Card className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-surface-900 dark:text-white">
                      If you&apos;re in immediate danger
                    </h3>
                    <p className="text-surface-600 dark:text-surface-400 mt-1">
                      Call <strong>911</strong> or go to your nearest emergency room. You matter, and help is available.
                    </p>
                    <Button className="mt-4 bg-red-500 hover:bg-red-600 text-white">
                      <Phone className="w-4 h-4 mr-2" />
                      Call 911
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Crisis Hotlines */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-primary-500" />
                  Crisis Support Lines
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {crisisResources.map((resource, index) => (
                    <motion.div
                      key={resource.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                            {resource.name}
                            {resource.available_24_7 && (
                              <Badge variant="success" size="sm">24/7</Badge>
                            )}
                          </h4>
                          <p className="text-sm text-surface-500 mt-1">
                            {resource.description}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mt-3">
                        {resource.phone && (
                          <a 
                            href={`tel:${resource.phone}`}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-500/10 text-primary-500 hover:bg-primary-500/20 transition-colors text-sm font-medium"
                          >
                            <Phone className="w-4 h-4" />
                            {resource.phone}
                          </a>
                        )}
                        {resource.text_line && (
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-sm font-medium">
                            <MessageCircle className="w-4 h-4" />
                            {resource.text_line}
                          </span>
                        )}
                        {resource.website && (
                          <a
                            href={resource.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-300 dark:hover:bg-surface-600 transition-colors text-sm font-medium"
                          >
                            <Globe className="w-4 h-4" />
                            Website
                          </a>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Reassurance */}
            <Card className="bg-gradient-to-br from-purple-500/5 to-pink-500/5">
              <CardContent className="p-6 text-center">
                <Heart className="w-12 h-12 mx-auto text-pink-500 mb-4" />
                <h3 className="font-bold text-lg text-surface-900 dark:text-white">
                  You Are Not Alone
                </h3>
                <p className="text-surface-600 dark:text-surface-400 mt-2 max-w-md mx-auto">
                  Everyone struggles sometimes. Reaching out for help is brave, not weak. 
                  These feelings are temporary, and there are people who want to help you feel better.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MOOD LOGGER MODAL */}
      <AnimatePresence>
        {showMoodLogger && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowMoodLogger(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-surface-200 dark:border-surface-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-surface-900 dark:text-white">
                    How are you feeling?
                  </h2>
                  <button
                    onClick={() => setShowMoodLogger(false)}
                    className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Mood Selection */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">
                    Overall Mood
                  </label>
                  <div className="flex justify-between gap-2">
                    {(Object.entries(moodConfig) as [MoodLevel, typeof moodConfig[MoodLevel]][]).map(([level, config]) => {
                      const Icon = config.icon
                      return (
                        <button
                          key={level}
                          onClick={() => setMoodLevel(level)}
                          className={`flex-1 p-3 rounded-xl flex flex-col items-center gap-1 transition-all ${
                            moodLevel === level
                              ? `${config.bg} text-white`
                              : 'bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700'
                          }`}
                        >
                          <Icon className="w-6 h-6" />
                          <span className="text-xs font-medium">{config.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Energy Level */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Energy Level: {energyLevel}/5
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={energyLevel}
                    onChange={e => setEnergyLevel(parseInt(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-xs text-surface-500 mt-1">
                    <span>Very Tired</span>
                    <span>Energized</span>
                  </div>
                </div>

                {/* Anxiety Level */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Anxiety/Worry Level: {anxietyLevel}/10
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={anxietyLevel}
                    onChange={e => setAnxietyLevel(parseInt(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                  <div className="flex justify-between text-xs text-surface-500 mt-1">
                    <span>Calm</span>
                    <span>Very Anxious</span>
                  </div>
                </div>

                {/* Sleep Quality */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Sleep Last Night: {sleepQuality}/5
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={sleepQuality}
                    onChange={e => setSleepQuality(parseInt(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-xs text-surface-500 mt-1">
                    <span>Poor</span>
                    <span>Great</span>
                  </div>
                </div>

                {/* Triggers */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Any triggers? (optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {commonTriggers.slice(0, 8).map(trigger => (
                      <button
                        key={trigger}
                        onClick={() => {
                          if (selectedTriggers.includes(trigger)) {
                            setSelectedTriggers(selectedTriggers.filter(t => t !== trigger))
                          } else {
                            setSelectedTriggers([...selectedTriggers, trigger])
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                          selectedTriggers.includes(trigger)
                            ? 'bg-red-500 text-white'
                            : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                        }`}
                      >
                        {trigger}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    value={moodNotes}
                    onChange={e => setMoodNotes(e.target.value)}
                    placeholder="What's on your mind?"
                    className="w-full px-4 py-3 rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    rows={3}
                  />
                </div>

                {/* Save Button */}
                <Button onClick={handleLogMood} className="w-full">
                  <Check className="w-4 h-4 mr-2" />
                  Save Mood Entry
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* JOURNAL EDITOR MODAL */}
      <AnimatePresence>
        {showJournalEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowJournalEditor(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-surface-200 dark:border-surface-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-surface-900 dark:text-white">
                    New Journal Entry
                  </h2>
                  <button
                    onClick={() => setShowJournalEditor(false)}
                    className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Title (optional)
                  </label>
                  <input
                    type="text"
                    value={journalTitle}
                    onChange={e => setJournalTitle(e.target.value)}
                    placeholder="Give your entry a title..."
                    className="w-full px-4 py-3 rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    How are you feeling right now?
                  </label>
                  <div className="flex gap-2">
                    {(Object.entries(moodConfig) as [MoodLevel, typeof moodConfig[MoodLevel]][]).map(([level, config]) => {
                      const Icon = config.icon
                      return (
                        <button
                          key={level}
                          onClick={() => setJournalMoodBefore(level)}
                          className={`p-2 rounded-lg transition-all ${
                            journalMoodBefore === level
                              ? `${config.bg} text-white`
                              : 'bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Write your thoughts...
                  </label>
                  <textarea
                    value={journalContent}
                    onChange={e => setJournalContent(e.target.value)}
                    placeholder="What's on your mind? How was your day? What are you grateful for?"
                    className="w-full px-4 py-3 rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    rows={8}
                  />
                </div>

                <Button 
                  onClick={handleSaveJournal} 
                  className="w-full"
                  disabled={!journalContent.trim()}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Save Entry
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COPING STRATEGY DETAIL MODAL */}
      <AnimatePresence>
        {showStrategyDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowStrategyDetail(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-surface-200 dark:border-surface-700">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${categoryColors[showStrategyDetail.category]}`}>
                      {(() => {
                        const Icon = categoryIcons[showStrategyDetail.category]
                        return <Icon className="w-6 h-6" />
                      })()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-surface-900 dark:text-white">
                        {showStrategyDetail.name}
                      </h2>
                      <p className="text-sm text-surface-500 mt-1">
                        {showStrategyDetail.duration_minutes} minutes • Ages {showStrategyDetail.age_appropriate_min}-{showStrategyDetail.age_appropriate_max}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowStrategyDetail(null)}
                    className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <p className="text-surface-600 dark:text-surface-400">
                  {showStrategyDetail.description}
                </p>

                <div>
                  <h3 className="font-semibold text-surface-900 dark:text-white mb-3 flex items-center gap-2">
                    <ListOrdered className="w-4 h-4" />
                    Steps
                  </h3>
                  <ol className="space-y-3">
                    {showStrategyDetail.steps.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary-500/20 text-primary-500 flex items-center justify-center text-sm font-medium flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-surface-700 dark:text-surface-300">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold text-surface-900 dark:text-white mb-2 flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    Benefits
                  </h3>
                  <ul className="space-y-1">
                    {showStrategyDetail.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-center gap-2 text-surface-600 dark:text-surface-400">
                        <Check className="w-4 h-4 text-emerald-500" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-surface-900 dark:text-white mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    When to Use
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {showStrategyDetail.when_to_use.map((when, i) => (
                      <Badge key={i} variant="secondary">{when}</Badge>
                    ))}
                  </div>
                </div>

                <Button className="w-full">
                  <Check className="w-4 h-4 mr-2" />
                  Mark as Practiced
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
