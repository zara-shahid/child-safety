'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HelpCircle,
  BookOpen,
  Shield,
  Phone,
  AlertTriangle,
  ChevronDown,
  LayoutDashboard,
  Users,
  Stethoscope,
  Pill,
  TrendingUp,
  Ruler,
  Syringe,
  MapPin,
  FileText,
  UsersRound,
  Calculator,
  MessageSquare,
  Lock,
  CheckCircle,
  Activity,
  Search,
  PlayCircle,
  ArrowRight,
  Mail,
  Bug,
  Lightbulb,
  Brain,
  X,
  Sparkles,
  Video,
  Send,
} from 'lucide-react'
import { Card, Button, Badge } from '@/components/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Smart routing keywords for search
const SEARCH_ROUTES: Record<string, { route: string; label: string; type: 'page' | 'ai' | 'faq' }> = {
  'dose': { route: '/dashboard/dosage', label: 'Dosage Calculator', type: 'page' },
  'dosage': { route: '/dashboard/dosage', label: 'Dosage Calculator', type: 'page' },
  'calculate': { route: '/dashboard/dosage', label: 'Dosage Calculator', type: 'page' },
  'medication': { route: '/dashboard/medications', label: 'Medication Tracker', type: 'page' },
  'medicine': { route: '/dashboard/medications', label: 'Medication Tracker', type: 'page' },
  'fever': { route: '/dashboard/care-advice', label: 'Care Guides', type: 'page' },
  'temperature': { route: '/dashboard/trends', label: 'Health Trends', type: 'page' },
  'symptom': { route: '/dashboard/symptom-checker', label: 'Symptom Checker', type: 'page' },
  'growth': { route: '/dashboard/growth', label: 'Growth Charts', type: 'page' },
  'vaccine': { route: '/dashboard/vaccines', label: 'Vaccination Schedule', type: 'page' },
  'shot': { route: '/dashboard/vaccines', label: 'Vaccination Schedule', type: 'page' },
  'doctor': { route: '/dashboard/telehealth', label: 'Telehealth', type: 'page' },
  'telehealth': { route: '/dashboard/telehealth', label: 'Telehealth', type: 'page' },
  'emergency': { route: '/dashboard/find-care', label: 'Find Care', type: 'page' },
  'er': { route: '/dashboard/find-care', label: 'Find Care', type: 'page' },
  'clinic': { route: '/dashboard/find-care', label: 'Find Care', type: 'page' },
  'report': { route: '/dashboard/reports', label: 'Doctor Reports', type: 'page' },
  'family': { route: '/dashboard/family', label: 'Family Sharing', type: 'page' },
  'share': { route: '/dashboard/family', label: 'Family Sharing', type: 'page' },
  'caregiver': { route: '/dashboard/family', label: 'Family Sharing', type: 'page' },
  'risk': { route: '/dashboard/assess', label: 'Risk Assessment', type: 'page' },
  'assessment': { route: '/dashboard/assess', label: 'Risk Assessment', type: 'page' },
  'night': { route: '/dashboard/night-vitals', label: 'Night Mode', type: 'page' },
  'dark': { route: '/dashboard/night-vitals', label: 'Night Mode', type: 'page' },
  // AI routing keywords
  'how do i': { route: '/dashboard/chat', label: 'Ask AI Assistant', type: 'ai' },
  'what is': { route: '/dashboard/chat', label: 'Ask AI Assistant', type: 'ai' },
  'should i': { route: '/dashboard/chat', label: 'Ask AI Assistant', type: 'ai' },
  'when to': { route: '/dashboard/chat', label: 'Ask AI Assistant', type: 'ai' },
  'why': { route: '/dashboard/chat', label: 'Ask AI Assistant', type: 'ai' },
  'help with': { route: '/dashboard/chat', label: 'Ask AI Assistant', type: 'ai' },
}

// Support issue categories
const SUPPORT_CATEGORIES = [
  { id: 'technical', label: 'Technical Issue', icon: Bug, description: 'App crashes, errors, or bugs', route: 'tech' },
  { id: 'howto', label: 'How To Question', icon: Lightbulb, description: 'Learn how to use a feature', route: 'ai' },
  { id: 'medical', label: 'Medical Question', icon: Stethoscope, description: 'Questions about health guidance', route: 'ai' },
  { id: 'account', label: 'Account/Billing', icon: Users, description: 'Login, subscription, or profile issues', route: 'email' },
  { id: 'feedback', label: 'Feedback/Suggestion', icon: MessageSquare, description: 'Ideas to improve EPCID', route: 'email' },
]

interface FAQItem {
  question: string
  answer: string
  keywords?: string[]
}

interface FeatureGuide {
  icon: any
  title: string
  description: string
  steps: string[]
  tips?: string[]
  route: string // For "Show Me" deep linking
  keywords?: string[]
}

const faqs: FAQItem[] = [
  {
    question: 'How is EPCID better than a Google search?',
    answer: `EPCID offers several advantages over searching symptoms online:

• **Personalized**: Knows your child's age, weight, medical conditions, and allergies - Google gives generic results for everyone
• **Age-Aware**: Understands that fever in a 2-month-old is very different from a 5-year-old
• **Clear Triage**: Gives one clear answer (Seek Emergency Care / See Doctor / Home Care) instead of 50 conflicting articles
• **Less Anxiety**: Structured, reassuring guidance vs. overwhelming scary search results
• **Tracks History**: Remembers past symptoms, spots trends over time
• **Clinical Scores**: Uses validated medical scoring systems (PEWS, Phoenix Sepsis)
• **No Doom Scrolling**: Answers THE question parents have: "Is this serious?"`,
  },
  {
    question: 'Is EPCID a replacement for medical advice?',
    answer: 'No. EPCID is a clinical decision support tool designed to help you understand when to seek medical care. It is NOT a diagnostic tool and does NOT replace professional medical judgment. Always consult with a healthcare provider for medical concerns, and seek emergency care immediately for serious symptoms.',
  },
  {
    question: 'What makes EPCID\'s AI different?',
    answer: `EPCID uses AI specifically trained for pediatric health concerns:

• **Early Warning Focus**: Designed to detect early signs of serious illness BEFORE they become critical
• **Pediatric-Specific**: Understands age-appropriate vital signs, dosing, and symptoms
• **Safety-First**: Programmed to err on the side of caution - when in doubt, recommends professional care
• **Context-Aware**: Considers your child's complete health profile when providing guidance
• **Evidence-Based**: Responses align with current pediatric guidelines and clinical protocols`,
  },
  {
    question: 'How accurate is the symptom checker?',
    answer: 'The symptom checker uses validated clinical scoring systems including the Phoenix Sepsis Score (2024 JAMA criteria), PEWS (Pediatric Early Warning Score), and evidence-based triage algorithms. However, it provides guidance, not diagnosis. The recommendations are conservative and will always err on the side of caution.',
  },
  {
    question: 'Who can access my child\'s health data?',
    answer: 'Only you and family members you explicitly invite through Family Sharing can access your child\'s data. All data is encrypted at rest and in transit. We follow HIPAA-aligned security practices and maintain comprehensive audit logs.',
  },
  {
    question: 'Can I share data with my pediatrician?',
    answer: 'Yes! Use the Doctor Reports feature to generate comprehensive health summaries that you can export as PDF, email, or print. These reports include symptom history, temperature trends, medication logs, and growth data.',
  },
  {
    question: 'How do I add another caregiver?',
    answer: 'Go to Family Sharing in the sidebar. Click "Invite Member" and enter their email address. You can set their role as Caregiver (can view and add data) or Viewer (read-only access). They\'ll receive an email invitation to join.',
  },
  {
    question: 'What should I do if the app recommends seeking emergency care?',
    answer: 'If EPCID displays a "Seek Emergency Care" recommendation, it has detected critical warning signs. Trust this guidance and go to the nearest hospital immediately. Do not wait. The app identifies life-threatening conditions like signs of sepsis, respiratory distress, or altered consciousness.',
  },
  {
    question: 'How often should I log symptoms?',
    answer: 'Log symptoms whenever you notice changes in your child\'s condition. For active illnesses, we recommend checking and logging every 4-6 hours. Regular logging helps track trends and provides valuable information for healthcare providers.',
  },
  {
    question: 'Is my data backed up?',
    answer: 'Yes. All data is stored securely in our PostgreSQL database with regular automated backups. Your data is never lost, even if you uninstall and reinstall the app.',
  },
  {
    question: 'Can I use EPCID offline?',
    answer: 'Basic features work offline, but AI chat and real-time analysis require an internet connection. Your logged symptoms and child profiles are stored locally and will sync when you\'re back online.',
  },
  {
    question: 'What age range does EPCID support?',
    answer: 'EPCID is designed for children from newborn to 18 years old. Age-appropriate calculations, vital sign ranges, and medication dosing are automatically adjusted based on your child\'s age and weight.',
  },
]

const featureGuides: FeatureGuide[] = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard Overview',
    description: 'Your central hub for health monitoring',
    route: '/dashboard',
    keywords: ['dashboard', 'home', 'overview', 'summary'],
    steps: [
      'View your selected child\'s health summary at a glance',
      'See recent activity feed with all health events',
      'Quick access to common actions like symptom checking',
      'Monitor current health status and any alerts',
    ],
    tips: ['Switch between children using the dropdown in the sidebar', 'The activity feed shows the last 5 events by default'],
  },
  {
    icon: Stethoscope,
    title: 'Symptom Checker',
    description: 'Guided assessment for health concerns',
    route: '/dashboard/symptom-checker',
    keywords: ['symptom', 'sick', 'check', 'body', 'pain'],
    steps: [
      'Select your child\'s current symptoms from the body map or list',
      'Rate the severity of each symptom (mild, moderate, severe)',
      'Answer follow-up questions about duration and associated symptoms',
      'Receive a 4-tier triage recommendation (Emergency Care, Call Now, 24hr, Home Care)',
    ],
    tips: ['Be honest about severity - the system is designed to be conservative', 'Include all symptoms, even if they seem unrelated'],
  },
  {
    icon: Pill,
    title: 'Medication Tracker',
    description: 'Never miss a dose',
    route: '/dashboard/medications',
    keywords: ['medication', 'medicine', 'dose', 'drug', 'pill'],
    steps: [
      'Add medications your child is currently taking',
      'Set dosing schedule with frequency and times',
      'Log each dose when administered',
      'View medication history and adherence',
    ],
    tips: ['Enable notifications for dose reminders', 'The countdown timer shows time until next dose'],
  },
  {
    icon: TrendingUp,
    title: 'Health Trends',
    description: 'Track temperature and symptom patterns',
    route: '/dashboard/trends',
    keywords: ['trend', 'temperature', 'fever', 'chart', 'history'],
    steps: [
      'Log temperature readings with timestamps',
      'View temperature charts over time',
      'Track symptom progression and patterns',
      'Identify improving, worsening, or stable trends',
    ],
    tips: ['Log readings at consistent times for better trend analysis', 'The system automatically detects patterns'],
  },
  {
    icon: Ruler,
    title: 'Growth Charts',
    description: 'Monitor height, weight, and percentiles',
    route: '/dashboard/growth',
    keywords: ['growth', 'height', 'weight', 'percentile', 'bmi'],
    steps: [
      'Enter current height, weight, and head circumference',
      'View growth plotted against WHO percentile curves',
      'Track growth velocity over time',
      'Identify any growth concerns early',
    ],
    tips: ['Update measurements at each pediatrician visit', 'Export growth data for doctor appointments'],
  },
  {
    icon: Syringe,
    title: 'Vaccination Schedule',
    description: 'Stay on track with immunizations',
    route: '/dashboard/vaccines',
    keywords: ['vaccine', 'shot', 'immunization', 'schedule'],
    steps: [
      'View CDC-recommended vaccination schedule',
      'Mark vaccines as completed with date administered',
      'See upcoming and overdue vaccinations',
      'Track overall immunization progress',
    ],
    tips: ['Bring this to pediatrician visits to ensure nothing is missed', 'The system alerts you to overdue vaccines'],
  },
  {
    icon: MapPin,
    title: 'Find Care Near Me',
    description: 'Locate nearby healthcare facilities',
    route: '/dashboard/find-care',
    keywords: ['care', 'clinic', 'hospital', 'er', 'urgent', 'doctor', 'near'],
    steps: [
      'Filter by care type (ER, Urgent Care, Pediatrician, Pharmacy)',
      'View locations on the map',
      'See wait times and distance estimates',
      'Get directions or call directly',
    ],
    tips: ['For emergencies, always seek medical care immediately', 'Telehealth option available for non-urgent concerns'],
  },
  {
    icon: FileText,
    title: 'Doctor Reports',
    description: 'Export health summaries',
    route: '/dashboard/reports',
    keywords: ['report', 'export', 'pdf', 'doctor', 'summary'],
    steps: [
      'Select the date range for the report',
      'Choose which sections to include',
      'Generate a comprehensive health summary',
      'Export as PDF, email, or print',
    ],
    tips: ['Generate a report before each doctor visit', 'Include all sections for comprehensive records'],
  },
  {
    icon: UsersRound,
    title: 'Family Sharing',
    description: 'Manage multi-caregiver access',
    route: '/dashboard/family',
    keywords: ['family', 'share', 'caregiver', 'invite', 'access'],
    steps: [
      'View current family members and their roles',
      'Invite new caregivers via email or shareable link',
      'Set permissions (Owner, Caregiver, Viewer)',
      'Remove or modify access as needed',
    ],
    tips: ['Caregivers can log symptoms; Viewers can only see data', 'You can revoke access at any time'],
  },
  {
    icon: Calculator,
    title: 'Dosage Calculator',
    description: 'Safe medication dosing',
    route: '/dashboard/dosage',
    keywords: ['dosage', 'calculate', 'dose', 'tylenol', 'ibuprofen', 'ml'],
    steps: [
      'Enter your child\'s current weight',
      'Select the medication (Acetaminophen, Ibuprofen, etc.)',
      'Choose the formulation (liquid, chewable, tablet)',
      'View the calculated safe dose with max daily limits',
    ],
    tips: ['Always verify with medication packaging', 'Weight should be current for accurate dosing'],
  },
  {
    icon: Activity,
    title: 'Risk Assessment',
    description: 'AI-powered health risk analysis',
    route: '/dashboard/assess',
    keywords: ['risk', 'assessment', 'score', 'ai', 'analysis'],
    steps: [
      'Click "Run Assessment" to analyze current health status',
      'View the risk score with contributing factors',
      'See personalized recommendations based on the assessment',
      'Set reminders to re-assess as symptoms change',
    ],
    tips: ['Run assessments when symptoms change significantly', 'The score considers all logged vitals and symptoms'],
  },
  {
    icon: Brain,
    title: 'AI Health Assistant',
    description: 'Chat with our medical AI',
    route: '/dashboard/chat',
    keywords: ['ai', 'chat', 'assistant', 'question', 'help'],
    steps: [
      'Type your health question in natural language',
      'The AI considers your child\'s profile and history',
      'Receive personalized guidance and recommendations',
      'Use action buttons to log vitals or set reminders',
    ],
    tips: ['Be specific about symptoms for better guidance', 'The AI can calculate doses and set reminders for you'],
  },
]


export default function HelpPage() {
  const router = useRouter()
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)
  const [openFeature, setOpenFeature] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'guide' | 'faq' | 'contact'>('guide')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [contactMessage, setContactMessage] = useState('')
  const [messageSent, setMessageSent] = useState(false)
  
  // Smart search results
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return { route: null, suggestions: [] }
    
    const query = searchQuery.toLowerCase()
    
    // Check for direct route matches
    for (const [keyword, config] of Object.entries(SEARCH_ROUTES)) {
      if (query.includes(keyword)) {
        return { route: config, suggestions: [] }
      }
    }
    
    // Search feature guides
    const matchingGuides = featureGuides.filter(guide => 
      guide.title.toLowerCase().includes(query) ||
      guide.description.toLowerCase().includes(query) ||
      guide.keywords?.some(k => k.includes(query))
    ).slice(0, 3)
    
    // Search FAQs
    const matchingFaqs = faqs.filter(faq =>
      faq.question.toLowerCase().includes(query) ||
      faq.answer.toLowerCase().includes(query)
    ).slice(0, 2)
    
    return { 
      route: null, 
      suggestions: [...matchingGuides.map(g => ({ type: 'guide' as const, item: g })), ...matchingFaqs.map(f => ({ type: 'faq' as const, item: f }))]
    }
  }, [searchQuery])
  
  // Handle search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchResults.route) {
      if (searchResults.route.type === 'ai') {
        router.push(`/dashboard/chat?q=${encodeURIComponent(searchQuery)}`)
      } else {
        router.push(searchResults.route.route)
      }
    }
    setShowSearchResults(false)
  }
  
  // Handle support contact
  const handleSendMessage = () => {
    // Simulate sending message
    setMessageSent(true)
    setTimeout(() => {
      setMessageSent(false)
      setShowContactModal(false)
      setContactMessage('')
      setSelectedCategory(null)
    }, 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-white" />
            </div>
            Help Center
          </h1>
          <p className="text-surface-600 dark:text-surface-400 mt-1">
            Learn how to use EPCID to monitor your child's health
          </p>
        </div>
        <Link href="/dashboard/chat">
          <Button variant="secondary" icon={<Brain className="w-4 h-4" />}>
            Ask AI Assistant
          </Button>
        </Link>
      </div>
      
      {/* Smart Search Bar */}
      <Card className="bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 border-cyan-200 dark:border-cyan-800">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
            How can we help you?
          </h2>
          <form onSubmit={handleSearchSubmit} className="relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-600 dark:text-surface-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowSearchResults(true)
                }}
                onFocus={() => setShowSearchResults(true)}
                placeholder="Search for help... (e.g., 'calculate dose', 'add family member', 'fever')"
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white placeholder-surface-500 focus:border-cyan-500 focus:outline-none text-lg"
              />
              {searchQuery && (
                <button 
                  type="button"
                  onClick={() => { setSearchQuery(''); setShowSearchResults(false); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            
            {/* Search Results Dropdown */}
            <AnimatePresence>
              {showSearchResults && searchQuery.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-lg z-20 overflow-hidden"
                >
                  {/* Smart Route Suggestion */}
                  {searchResults.route && (
                    <div className="p-4 bg-cyan-50 dark:bg-cyan-900/30 border-b border-cyan-200 dark:border-cyan-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {searchResults.route.type === 'ai' ? (
                            <Brain className="w-5 h-5 text-cyan-600" />
                          ) : (
                            <Sparkles className="w-5 h-5 text-cyan-600" />
                          )}
                          <div>
                            <span className="font-medium text-cyan-800 dark:text-cyan-200">
                              {searchResults.route.type === 'ai' ? 'Ask the AI Assistant' : `Go to ${searchResults.route.label}`}
                            </span>
                            <p className="text-xs text-cyan-600 dark:text-cyan-400">
                              {searchResults.route.type === 'ai' ? 'Get personalized help for your question' : 'Jump directly to this feature'}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" type="submit" icon={<ArrowRight className="w-4 h-4" />}>
                          Go
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Matching Guides & FAQs */}
                  {searchResults.suggestions.length > 0 && (
                    <div className="p-2">
                      {searchResults.suggestions.map((result, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            if (result.type === 'guide') {
                              router.push((result.item as FeatureGuide).route)
                            } else {
                              setActiveTab('faq')
                              setOpenFAQ(faqs.indexOf(result.item as FAQItem))
                            }
                            setShowSearchResults(false)
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700 text-left"
                        >
                          {result.type === 'guide' ? (
                            (() => {
                              const guide = result.item as FeatureGuide
                              const IconComponent = guide.icon
                              return (
                                <>
                                  <IconComponent className="w-5 h-5 text-cyan-600" />
                                  <div>
                                    <span className="font-medium text-surface-900 dark:text-white">
                                      {guide.title}
                                    </span>
                                    <p className="text-xs text-surface-500">Feature Guide</p>
                                  </div>
                                </>
                              )
                            })()
                          ) : (
                            <>
                              <HelpCircle className="w-5 h-5 text-amber-600" />
                              <div>
                                <span className="font-medium text-surface-900 dark:text-white line-clamp-1">
                                  {(result.item as FAQItem).question}
                                </span>
                                <p className="text-xs text-surface-500">FAQ</p>
                              </div>
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* No Results */}
                  {!searchResults.route && searchResults.suggestions.length === 0 && (
                    <div className="p-4 text-center text-surface-500">
                      <p>No results found. Try asking the AI Assistant!</p>
                      <Link href={`/dashboard/chat?q=${encodeURIComponent(searchQuery)}`}>
                        <Button size="sm" variant="secondary" className="mt-2" icon={<Brain className="w-4 h-4" />}>
                          Ask AI Assistant
                        </Button>
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </form>
          
          {/* Quick Links */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-sm text-surface-500">Popular:</span>
            <Link href="/dashboard/dosage">
              <Badge variant="secondary" className="cursor-pointer hover:bg-surface-200 dark:hover:bg-surface-700">
                Calculate Dose
              </Badge>
            </Link>
            <Link href="/dashboard/symptom-checker">
              <Badge variant="secondary" className="cursor-pointer hover:bg-surface-200 dark:hover:bg-surface-700">
                Check Symptoms
              </Badge>
            </Link>
            <Link href="/dashboard/telehealth">
              <Badge variant="secondary" className="cursor-pointer hover:bg-surface-200 dark:hover:bg-surface-700">
                Talk to Doctor
              </Badge>
            </Link>
            <Link href="/dashboard/family">
              <Badge variant="secondary" className="cursor-pointer hover:bg-surface-200 dark:hover:bg-surface-700">
                Add Caregiver
              </Badge>
            </Link>
          </div>
        </div>
      </Card>

      {/* Emergency Banner */}
      <Card className="bg-gradient-to-r from-danger-50 to-danger-100 dark:from-danger-900/30 dark:to-danger-800/30 border-danger-200 dark:border-danger-800">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-danger-500 flex items-center justify-center flex-shrink-0">
            <Phone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-danger-800 dark:text-danger-200 text-lg">
              Medical Emergency?
            </h3>
            <p className="text-danger-700 dark:text-danger-300 mt-1">
              If your child is experiencing a medical emergency, <strong>call 911 immediately</strong>. 
              Do not wait or use this app to assess emergency situations.
            </p>
            <div className="flex gap-3 mt-3">
              <Button
                variant="primary"
                className="bg-danger-600 hover:bg-danger-700"
                onClick={() => window.open('https://www.google.com/maps/search/emergency+room+near+me', '_blank')}
              >
                <MapPin className="w-4 h-4 mr-2" />
                Find Emergency Room
              </Button>
              <Button
                variant="outline"
                className="border-danger-300 text-danger-700 hover:bg-danger-100"
                onClick={() => window.open('https://www.google.com/maps/search/emergency+room+near+me', '_blank')}
              >
                <MapPin className="w-4 h-4 mr-2" />
                Find ER
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Disclaimer */}
      <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 dark:text-amber-200">Important Disclaimer</h3>
            <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
              EPCID is a <strong>clinical decision support tool</strong>, not a diagnostic system. 
              It provides guidance to help you understand when to seek care, but it does <strong>not</strong> replace 
              professional medical advice, diagnosis, or treatment. Always consult with a qualified healthcare 
              provider for any medical concerns.
            </p>
          </div>
        </div>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-surface-200 dark:border-surface-700">
        {[
          { id: 'guide', label: 'Feature Guides', icon: BookOpen },
          { id: 'faq', label: 'FAQ', icon: HelpCircle },
          { id: 'contact', label: 'Contact Support', icon: MessageSquare },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`
              flex items-center gap-2 px-4 py-3 border-b-2 transition-colors font-medium text-sm
              ${activeTab === tab.id
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200'
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
        {activeTab === 'guide' && (
          <motion.div
            key="guide"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="grid gap-4">
              {featureGuides.map((feature, index) => (
                <Card key={feature.title} className="overflow-hidden">
                  <button
                    onClick={() => setOpenFeature(openFeature === index ? null : index)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                        <feature.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-surface-900 dark:text-white">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-surface-600 dark:text-surface-400">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link 
                        href={feature.route} 
                        onClick={(e) => e.stopPropagation()}
                        className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                      >
                        <PlayCircle className="w-4 h-4" />
                        Show Me
                      </Link>
                      <ChevronDown
                        className={`w-5 h-5 text-surface-400 transition-transform ${
                          openFeature === index ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  <AnimatePresence>
                    {openFeature === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-2 border-t border-surface-200 dark:border-surface-700">
                          <div className="ml-16">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium text-surface-900 dark:text-white">
                                How to use:
                              </h4>
                              <Link href={feature.route}>
                                <Button 
                                  size="sm" 
                                  icon={<PlayCircle className="w-4 h-4" />}
                                  className="bg-gradient-to-r from-cyan-500 to-teal-600"
                                >
                                  Launch Walkthrough
                                </Button>
                              </Link>
                            </div>
                            <ol className="space-y-2">
                              {feature.steps.map((step, i) => (
                                <li key={i} className="flex items-start gap-3">
                                  <span className="w-6 h-6 rounded-full bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400 text-sm font-medium flex items-center justify-center flex-shrink-0">
                                    {i + 1}
                                  </span>
                                  <span className="text-surface-600 dark:text-surface-300 text-sm">
                                    {step}
                                  </span>
                                </li>
                              ))}
                            </ol>

                            {feature.tips && (
                              <div className="mt-4 p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
                                <h5 className="font-medium text-cyan-800 dark:text-cyan-200 text-sm mb-2">
                                  Pro Tips:
                                </h5>
                                <ul className="space-y-1">
                                  {feature.tips.map((tip, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-cyan-700 dark:text-cyan-300">
                                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                      {tip}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Video Tutorial Placeholder */}
                            <div className="mt-4 p-4 rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                                  <Video className="w-5 h-5 text-violet-600" />
                                </div>
                                <div className="flex-1">
                                  <h5 className="font-medium text-surface-900 dark:text-white text-sm">
                                    Video Tutorial
                                  </h5>
                                  <p className="text-xs text-surface-500">Watch a 2-minute walkthrough</p>
                                </div>
                                <Button size="sm" variant="secondary" disabled>
                                  Coming Soon
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'faq' && (
          <motion.div
            key="faq"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-3"
          >
            {faqs.map((faq, index) => (
              <Card key={index} className="overflow-hidden">
                <button
                  onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                >
                  <span className="font-medium text-surface-900 dark:text-white pr-4">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-surface-400 transition-transform flex-shrink-0 ${
                      openFAQ === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {openFAQ === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-2 border-t border-surface-200 dark:border-surface-700">
                        <div className="text-surface-600 dark:text-surface-400 whitespace-pre-line">
                          {faq.answer}
                        </div>
                        
                        {/* Helpful? Feedback */}
                        <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700 flex items-center justify-between">
                          <span className="text-sm text-surface-500">Was this helpful?</span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost">👍 Yes</Button>
                            <Button size="sm" variant="ghost">👎 No</Button>
                            <Link href="/dashboard/chat">
                              <Button size="sm" variant="secondary" icon={<Brain className="w-3 h-3" />}>
                                Ask AI
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            ))}
          </motion.div>
        )}
        
        {/* Contact Support Tab */}
        {activeTab === 'contact' && (
          <motion.div
            key="contact"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Smart Routing */}
            <Card>
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
                What do you need help with?
              </h3>
              <p className="text-surface-600 dark:text-surface-400 text-sm mb-4">
                Select a category and we'll route you to the best resource
              </p>
              
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {SUPPORT_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      if (category.route === 'ai') {
                        router.push('/dashboard/chat')
                      } else if (category.route === 'email') {
                        setSelectedCategory(category.id)
                        setShowContactModal(true)
                      } else {
                        setSelectedCategory(category.id)
                        setShowContactModal(true)
                      }
                    }}
                    className={`p-4 rounded-xl border text-left transition-all hover:shadow-md ${
                      selectedCategory === category.id 
                        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30' 
                        : 'border-surface-200 dark:border-surface-700 hover:border-cyan-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                        <category.icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-surface-900 dark:text-white">
                          {category.label}
                        </h4>
                        <p className="text-xs text-surface-500 mt-1">
                          {category.description}
                        </p>
                        {category.route === 'ai' && (
                          <Badge variant="primary" size="sm" className="mt-2">
                            <Brain className="w-3 h-3 mr-1" />
                            AI Powered
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
            
            {/* Quick AI Help */}
            <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-violet-200 dark:border-violet-800">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500 flex items-center justify-center flex-shrink-0">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-violet-900 dark:text-violet-100">
                    Try the AI Assistant First
                  </h3>
                  <p className="text-violet-700 dark:text-violet-300 text-sm mt-1">
                    Most questions can be answered instantly by our AI. It knows the app, your child's profile, and can guide you through any feature.
                  </p>
                  <div className="flex gap-3 mt-3">
                    <Link href="/dashboard/chat">
                      <Button icon={<MessageSquare className="w-4 h-4" />}>
                        Chat with AI
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
            
            {/* Contact Info */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-surface-900 dark:text-white">
                      Email Support
                    </h4>
                    <p className="text-sm text-surface-500 mt-1">
                      support@epcid.health
                    </p>
                    <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
                      Response within 24 hours
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-surface-900 dark:text-white">
                      Phone Support
                    </h4>
                    <p className="text-sm text-surface-500 mt-1">
                      1-800-EPCID-HELP
                    </p>
                    <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
                      Mon-Fri, 9am-5pm EST
                    </p>
                  </div>
                </div>
              </Card>
            </div>
            
            {/* Security & Privacy */}
            <Card>
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-cyan-500" />
                Security & Privacy
              </h3>
              <p className="text-surface-600 dark:text-surface-400 text-sm mb-4">
                Your child's health data is protected with industry-leading security measures.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { icon: Lock, label: 'End-to-End Encryption', desc: 'All data encrypted in transit and at rest' },
                  { icon: Shield, label: 'HIPAA-Aligned', desc: 'Following healthcare privacy standards' },
                  { icon: Activity, label: 'Audit Logging', desc: 'All access is tracked and logged' },
                  { icon: Users, label: 'Access Control', desc: 'You control who sees your data' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <h5 className="font-medium text-surface-900 dark:text-white text-sm">
                        {item.label}
                      </h5>
                      <p className="text-xs text-surface-500 dark:text-surface-400">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Contact Modal */}
      <AnimatePresence>
        {showContactModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowContactModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-surface-900 dark:text-white">
                    Contact Support
                  </h3>
                  <button onClick={() => setShowContactModal(false)} className="text-surface-400 hover:text-surface-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {messageSent ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h4 className="font-semibold text-surface-900 dark:text-white mb-2">Message Sent!</h4>
                    <p className="text-surface-500">We'll get back to you within 24 hours.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                          Category
                        </label>
                        <select
                          value={selectedCategory || ''}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full px-4 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700"
                        >
                          {SUPPORT_CATEGORIES.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                          Message
                        </label>
                        <textarea
                          value={contactMessage}
                          onChange={(e) => setContactMessage(e.target.value)}
                          rows={4}
                          placeholder="Describe your issue or question..."
                          className="w-full px-4 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 resize-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <Button 
                        fullWidth 
                        onClick={handleSendMessage}
                        disabled={!contactMessage}
                        icon={<Send className="w-4 h-4" />}
                      >
                        Send Message
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom CTA - Clean, No Dev Links */}
      <Card className="bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 border-cyan-200 dark:border-cyan-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-surface-900 dark:text-white">
              Still need help?
            </h3>
            <p className="text-surface-600 dark:text-surface-400 text-sm mt-1">
              Our AI assistant can answer most questions instantly
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/chat">
              <Button icon={<Brain className="w-4 h-4" />}>
                Ask AI Assistant
              </Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                setActiveTab('contact')
                setShowContactModal(true)
              }}
              icon={<Mail className="w-4 h-4" />}
            >
              Contact Support
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
