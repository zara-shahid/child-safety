'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  LayoutDashboard,
  Users,
  Stethoscope,
  MessageSquare,
  Activity,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Phone,
  MapPin,
  AlertTriangle,
  Heart,
  Calculator,
  BookOpen,
  HelpCircle,
  Clock,
  Pill,
  TrendingUp,
  Ruler,
  Syringe,
  FileText,
  UsersRound,
  Home,
  ChevronLeft,
  Moon,
  Video,
  ChevronRight,
  Zap,
  Brain,
  Sparkles,
} from 'lucide-react'
import { ThemeToggle, LogoCompact, AIStatusIndicator } from '@/components/ui'
import useStore from '@/store/useStore'
import { isDemoMode } from '@/lib/api'
import { calculateAge } from '@/lib/utils'
import {
  DEMO_CHILDREN,
  DEMO_VITAL_READINGS,
  DEMO_SYMPTOM_HISTORY,
  DEMO_MEDICATIONS,
  DEMO_DOSE_LOGS,
  DEMO_DETECTED_EVENTS,
  DEMO_RISK_TREND,
  DEMO_ASSESSMENT,
  DEMO_MOOD_HISTORY,
  DEMO_JOURNAL,
  DEMO_ANXIETY_ASSESSMENTS,
  DEMO_INSIGHTS,
} from '@/lib/demoData'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview', description: 'Health dashboard' },
  { href: '/dashboard/children', icon: Users, label: 'My Children', description: 'Manage profiles' },
  { href: '/dashboard/symptom-checker', icon: Stethoscope, label: 'Symptom Checker', description: 'Check symptoms' },
  { href: '/dashboard/medications', icon: Pill, label: 'Medications', description: 'Track doses' },
  { href: '/dashboard/trends', icon: TrendingUp, label: 'Health Trends', description: 'Temperature & symptoms' },
  { href: '/dashboard/night-vitals', icon: Moon, label: 'Night Mode', description: 'Simplified vitals view' },
  { href: '/dashboard/growth', icon: Ruler, label: 'Growth Charts', description: 'Height & weight' },
  { href: '/dashboard/vaccines', icon: Syringe, label: 'Vaccines', description: 'Immunization schedule' },
  { href: '/dashboard/find-care', icon: MapPin, label: 'Find Care', description: 'Nearby facilities' },
  { href: '/dashboard/reports', icon: FileText, label: 'Doctor Reports', description: 'Export summaries' },
  { href: '/dashboard/family', icon: UsersRound, label: 'Family Sharing', description: 'Caregivers access' },
  { href: '/dashboard/care-advice', icon: BookOpen, label: 'Care Guides', description: 'Home care tips' },
  { href: '/dashboard/dosage', icon: Calculator, label: 'Dosage Calculator', description: 'Medicine dosing' },
  { href: '/dashboard/assess', icon: Heart, label: 'Risk Assessment', description: 'AI health check' },
  { href: '/dashboard/mental-health', icon: Brain, label: 'Mental Wellness', description: 'Mood & coping tools' },
  { href: '/dashboard/chat', icon: MessageSquare, label: 'AI Assistant', description: 'Ask questions' },
  { href: '/dashboard/help', icon: HelpCircle, label: 'Help & Guide', description: 'App guide & FAQ' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const {
    user,
    token,
    setUser,
    logout,
    children: childrenList,
    setChildren,
    selectedChild,
    selectChild,
    sidebarOpen,
    setSidebarOpen,
    addVitalReading,
    addSymptomEntry,
    addMedication,
    addDoseLog,
    addDetectedEvent,
    setLatestAssessment,
    addMoodEntry,
    addJournalEntry,
    addAnxietyAssessment,
    symptomHistory,
    vitalReadings,
    detectedEvents,
    smartInsights,
    doseLogs,
    latestAssessment,
  } = useStore()

  const [childDropdownOpen, setChildDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set())

  const seedDemoData = () => {
    setChildren(DEMO_CHILDREN)
    selectChild(DEMO_CHILDREN[0])

    DEMO_VITAL_READINGS.forEach(v => addVitalReading(v))
    DEMO_SYMPTOM_HISTORY.forEach(s => addSymptomEntry(s))
    DEMO_MEDICATIONS.forEach(m => addMedication(m))
    DEMO_DOSE_LOGS.forEach(d => addDoseLog(d))
    DEMO_DETECTED_EVENTS.forEach(e => addDetectedEvent(e))
    setLatestAssessment(DEMO_ASSESSMENT)
    DEMO_MOOD_HISTORY.forEach(m => addMoodEntry(m))
    DEMO_JOURNAL.forEach(j => addJournalEntry(j))
    DEMO_ANXIETY_ASSESSMENTS.forEach(a => addAnxietyAssessment(a))

    useStore.setState({ riskTrend: DEMO_RISK_TREND, smartInsights: DEMO_INSIGHTS })
  }

  useEffect(() => {
    const initAuth = async () => {
      if (!token) {
        router.push('/login')
        return
      }

      // Seed demo data whenever in demo mode and store is empty
      if (isDemoMode() && childrenList.length === 0) {
        seedDemoData()
      }

      if (user) {
        // Auto-select first child if none selected
        if (!selectedChild && childrenList.length > 0) {
          selectChild(childrenList[0])
        }
        setLoading(false)
        return
      }

      if (isDemoMode()) {
        setUser({
          id: 'demo-user',
          email: 'demo@epcid.health',
          full_name: 'Demo User',
        })
        setLoading(false)
        return
      }

      try {
        const { authApi, childrenApi } = await import('@/lib/api')

        const profile = await authApi.getProfile()
        setUser(profile)

        const childrenData = await childrenApi.list()
        setChildren(childrenData)
        if (childrenData.length > 0 && !selectedChild) {
          selectChild(childrenData[0])
        }
      } catch (error) {
        setUser({
          id: 'demo-user',
          email: 'demo@epcid.health',
          full_name: 'Demo User',
        })
        if (childrenList.length === 0) {
          seedDemoData()
        }
      }

      setLoading(false)
    }

    initAuth()
  }, [token, user])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }


  const handleFindCare = () => {
    if (typeof window !== 'undefined') {
      window.open('https://www.google.com/maps/search/urgent+care+near+me', '_blank')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 border-primary-400 border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-surface-600 dark:text-surface-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">

      {/* AI Status Indicator */}
      <AIStatusIndicator />

      {/* Top Safety Bar - Glass Style */}
      <div className="bg-gradient-to-r from-surface-100 to-surface-50 dark:from-navy-950/95 dark:to-navy-925/95 backdrop-blur-xl border-b border-surface-200 dark:border-primary-400/10">
        <div className="max-w-full mx-auto px-4 py-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
                <div className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-400 animate-pulse" />
                <span className="font-medium">EPCID Safety Net</span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-surface-600 dark:text-surface-400">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs">24/7 Monitoring Active</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleFindCare}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-primary-500/20 hover:bg-primary-500/30 text-primary-600 dark:text-primary-400 font-medium rounded-lg transition-all text-xs border border-primary-500/30"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Find Care</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
          )}
        </AnimatePresence>

        {/* Sidebar - Glass morphism */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-50
            w-[280px] h-[calc(100vh-44px)]
            bg-white/80 dark:bg-navy-950/90
            backdrop-blur-xl
            border-r border-surface-200/50 dark:border-navy-800/50
            flex flex-col
            shadow-xl lg:shadow-none
            transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0
          `}
        >
          {/* Logo Section */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-surface-200 dark:border-navy-900/50">
            <Link href="/dashboard">
              <LogoCompact />
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 text-surface-400 hover:text-surface-600 dark:hover:text-white rounded-lg hover:bg-surface-100 dark:hover:bg-navy-900/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Child Selector - Stitch Style */}
          <div className="px-4 py-4 border-b border-surface-200 dark:border-navy-900/50">
            <button
              onClick={() => setChildDropdownOpen(!childDropdownOpen)}
              className="w-full p-3 bg-surface-50 dark:bg-navy-925 rounded-xl flex items-center justify-between hover:bg-surface-100 dark:hover:bg-navy-900 transition-all border border-surface-200 dark:border-navy-800"
            >
              <div className="flex items-center gap-3">
                {selectedChild ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold shadow-md ring-2 ring-primary-400/20">
                      {selectedChild.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-surface-900 dark:text-white">{selectedChild.name}</div>
                      <div className="text-xs text-surface-500 dark:text-surface-400">
                        {calculateAge(selectedChild.date_of_birth)} years old
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-surface-200 dark:bg-navy-800 flex items-center justify-center">
                      <Users className="w-5 h-5 text-surface-400" />
                    </div>
                    <span className="text-surface-500 dark:text-surface-400">Select a child</span>
                  </>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform ${childDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {childDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="mt-2 bg-white dark:bg-navy-925 rounded-xl overflow-hidden border border-surface-200 dark:border-navy-800 shadow-lg"
                >
                  {childrenList
                    .filter((child, index, self) => index === self.findIndex(c => c.id === child.id))
                    .map((child) => (
                      <button
                        key={child.id}
                        onClick={() => {
                          selectChild(child)
                          setChildDropdownOpen(false)
                        }}
                        className={`
                        w-full p-3 flex items-center gap-3 hover:bg-surface-50 dark:hover:bg-navy-900 transition-colors
                        ${selectedChild?.id === child.id ? 'bg-primary-50 dark:bg-primary-500/10' : ''}
                      `}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${selectedChild?.id === child.id
                          ? 'bg-gradient-to-br from-primary-400 to-primary-600'
                          : 'bg-surface-400 dark:bg-navy-700'
                          }`}>
                          {child.name.charAt(0)}
                        </div>
                        <span className={`${selectedChild?.id === child.id ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-surface-700 dark:text-surface-300'}`}>
                          {child.name}
                        </span>
                        {selectedChild?.id === child.id && (
                          <div className="ml-auto w-2 h-2 rounded-full bg-primary-500" />
                        )}
                      </button>
                    ))}
                  <Link
                    href="/dashboard/children"
                    onClick={() => setChildDropdownOpen(false)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-surface-50 dark:hover:bg-navy-900 transition-colors border-t border-surface-200 dark:border-navy-800"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center">
                      <span className="text-primary-600 dark:text-primary-400 text-lg">+</span>
                    </div>
                    <span className="text-primary-600 dark:text-primary-400 font-medium">Add child</span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation - Stitch Style */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto sidebar-scroll">
            <div className="mb-3 px-3">
              <span className="text-[10px] font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
                Navigation
              </span>
            </div>
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative
                    ${isActive
                      ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-navy-900/50 hover:text-surface-900 dark:hover:text-white'
                    }
                  `}
                >
                  <div className={`
                    w-9 h-9 rounded-lg flex items-center justify-center transition-all
                    ${isActive
                      ? 'bg-primary-100 dark:bg-primary-500/20'
                      : 'bg-surface-100 dark:bg-navy-900/50 group-hover:bg-surface-200 dark:group-hover:bg-navy-800'
                    }
                  `}>
                    <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-primary-600 dark:text-primary-400' : ''}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.label}</div>
                  </div>
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute right-2 w-1.5 h-6 bg-primary-500 rounded-full"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Bottom Section */}
          <div className="p-4 border-t border-surface-200 dark:border-navy-900/50 space-y-1">
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-navy-900/50 hover:text-surface-900 dark:hover:text-white transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-100 dark:bg-navy-900/50 flex items-center justify-center">
                <Settings className="w-[18px] h-[18px]" />
              </div>
              <span className="font-medium text-sm">Settings</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-surface-600 dark:text-surface-400 hover:bg-danger-50 dark:hover:bg-danger-500/10 hover:text-danger-600 dark:hover:text-danger-400 transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-100 dark:bg-navy-900/50 flex items-center justify-center">
                <LogOut className="w-[18px] h-[18px]" />
              </div>
              <span className="font-medium text-sm">Sign out</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header Bar - Glass Style */}
          <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-surface-200/50 dark:border-navy-800/50 bg-white/70 dark:bg-navy-950/80 backdrop-blur-xl sticky top-0 z-30">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-white rounded-lg hover:bg-surface-100 dark:hover:bg-navy-900/50"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Home button */}
              {pathname !== '/dashboard' && (
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10 hover:bg-primary-100 dark:hover:bg-primary-500/20 rounded-lg transition-colors border border-primary-200 dark:border-primary-500/20"
                >
                  <Home className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">Home</span>
                </Link>
              )}

              <div>
                <h1 className="text-lg font-semibold text-surface-900 dark:text-white">
                  {navItems.find(item => item.href === pathname)?.label || 'Dashboard'}
                </h1>
                <p className="text-xs text-surface-500 dark:text-surface-500 hidden sm:block">
                  {navItems.find(item => item.href === pathname)?.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Quick Actions */}
              <Link
                href="/dashboard/assess"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 text-white font-medium rounded-lg transition-all text-xs shadow-glow-accent"
              >
                <Heart className="w-3.5 h-3.5" />
                <span>Quick Assess</span>
              </Link>

              {/* Help button */}
              <Link
                href="/dashboard/help"
                className="p-2 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-white rounded-lg hover:bg-surface-100 dark:hover:bg-navy-900/50 transition-colors"
              >
                <HelpCircle className="w-5 h-5" />
              </Link>

              {/* Theme toggle */}
              <ThemeToggle />

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-white rounded-lg hover:bg-surface-100 dark:hover:bg-navy-900/50 transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {(() => {
                    const unreadCount = [
                      ...detectedEvents.filter(e => e.status === 'pending').map(e => e.id),
                      ...smartInsights.map(i => i.id),
                    ].filter(id => !readNotificationIds.has(id)).length
                    return unreadCount > 0 ? (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-danger-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white dark:ring-navy-950 px-1">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    ) : null
                  })()}
                </button>

                <AnimatePresence>
                  {notificationsOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-navy-925 rounded-xl border border-surface-200 dark:border-navy-800 shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-navy-800">
                          <h3 className="font-semibold text-surface-900 dark:text-white">Notifications</h3>
                          <button
                            onClick={() => {
                              const allIds = [
                                ...detectedEvents.map(e => e.id),
                                ...smartInsights.map(i => i.id),
                              ]
                              setReadNotificationIds(new Set(allIds))
                            }}
                            className="text-xs text-primary-500 hover:text-primary-600 font-medium"
                          >
                            Mark all read
                          </button>
                        </div>
                        <div className="max-h-80 overflow-y-auto divide-y divide-surface-100 dark:divide-navy-800">
                          {detectedEvents.filter(e => e.status === 'pending').map((event) => (
                            <div
                              key={event.id}
                              onClick={() => {
                                setReadNotificationIds(prev => new Set(Array.from(prev).concat(event.id)))
                                if (event.suggested_action?.action_href) {
                                  router.push(event.suggested_action.action_href)
                                }
                                setNotificationsOpen(false)
                              }}
                              className={`px-4 py-3 hover:bg-surface-50 dark:hover:bg-navy-900/50 cursor-pointer transition-colors ${readNotificationIds.has(event.id) ? 'opacity-60' : ''
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-danger-100 dark:bg-danger-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <AlertTriangle className="w-4 h-4 text-danger-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-surface-900 dark:text-white">
                                    {event.type === 'temperature' ? 'Temperature Alert' : event.type === 'heart_rate' ? 'Heart Rate Alert' : 'Vital Alert'}
                                  </p>
                                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                                    {event.value}{event.unit} detected • {event.suggested_action?.urgency || 'monitor'}
                                  </p>
                                  <p className="text-[10px] text-surface-400 mt-1">
                                    {new Date(event.timestamp).toLocaleString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                                  </p>
                                </div>
                                {!readNotificationIds.has(event.id) && (
                                  <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-2" />
                                )}
                              </div>
                            </div>
                          ))}
                          {smartInsights.map((insight) => (
                            <div
                              key={insight.id}
                              onClick={() => {
                                setReadNotificationIds(prev => new Set(Array.from(prev).concat(insight.id)))
                                if (insight.action_href) {
                                  router.push(insight.action_href)
                                }
                                setNotificationsOpen(false)
                              }}
                              className={`px-4 py-3 hover:bg-surface-50 dark:hover:bg-navy-900/50 cursor-pointer transition-colors ${readNotificationIds.has(insight.id) ? 'opacity-60' : ''
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${insight.priority === 'high' ? 'bg-amber-100 dark:bg-amber-900/50' :
                                  insight.priority === 'medium' ? 'bg-blue-100 dark:bg-blue-900/50' :
                                    'bg-surface-100 dark:bg-surface-800'
                                  }`}>
                                  <Sparkles className={`w-4 h-4 ${insight.priority === 'high' ? 'text-amber-500' :
                                    insight.priority === 'medium' ? 'text-blue-500' :
                                      'text-surface-500'
                                    }`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-surface-900 dark:text-white">
                                    {insight.title}
                                  </p>
                                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 line-clamp-2">
                                    {insight.description}
                                  </p>
                                  <p className="text-[10px] text-surface-400 mt-1">
                                    {new Date(insight.timestamp).toLocaleString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                                  </p>
                                </div>
                                {!readNotificationIds.has(insight.id) && (
                                  <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-2" />
                                )}
                              </div>
                            </div>
                          ))}
                          {detectedEvents.length === 0 && smartInsights.length === 0 && (
                            <div className="px-4 py-8 text-center">
                              <Bell className="w-8 h-8 text-surface-300 dark:text-surface-600 mx-auto mb-2" />
                              <p className="text-sm text-surface-500">No notifications</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* User avatar */}
              <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-surface-200 dark:border-navy-800">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold shadow-md ring-2 ring-primary-400/20">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-medium text-surface-900 dark:text-white">{user?.full_name}</div>
                  <div className="text-xs text-surface-500 dark:text-surface-400">{user?.email}</div>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
