'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Eye,
  Edit,
  Trash2,
  Check,
  X,
  Clock,
  Crown,
  Phone,
  Copy,
  Share2,
  AlertCircle,
  CheckCircle,
  Send,
  Link as LinkIcon,
  Stethoscope,
  Timer,
  Calendar,
  Bell,
  BellOff,
  GripVertical,
  Settings,
  Lock,
  Unlock,
  Activity,
  FileText,
  Pill,
  Thermometer,
  TrendingUp,
  Heart,
  Baby,
  AlertTriangle,
  Zap,
  History,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import useStore from '@/store/useStore'

interface PrivacyScope {
  id: string
  name: string
  icon: typeof Eye
  enabled: boolean
}

interface FamilyMember {
  id: string
  name: string
  email: string
  phone?: string
  role: 'owner' | 'caregiver' | 'viewer' | 'temporary'
  memberType: 'family' | 'provider'
  status: 'active' | 'pending' | 'expired'
  avatar?: string
  lastActive?: Date
  addedAt: Date
  // Temporal access fields
  isTemporary?: boolean
  expiresAt?: Date
  recurringSchedule?: {
    days: string[]
    startTime: string
    endTime: string
  }
  // Provider-specific fields
  specialty?: string
  clinic?: string
  // Privacy scopes
  privacyScopes?: PrivacyScope[]
  // Emergency priority
  emergencyPriority?: number
}

interface ActivityLog {
  id: string
  user: string
  action: string
  detail?: string
  time: Date
  type: 'view' | 'edit' | 'alert' | 'login' | 'export'
}

const roleConfig = {
  owner: {
    label: 'Owner',
    description: 'Full access to all features and settings',
    color: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
    icon: Crown,
  },
  caregiver: {
    label: 'Caregiver',
    description: 'Can log symptoms, medications, and view all data',
    color: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300',
    icon: Edit,
  },
  viewer: {
    label: 'Viewer',
    description: 'Can view health data but cannot make changes',
    color: 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400',
    icon: Eye,
  },
  temporary: {
    label: 'Temporary',
    description: 'Time-limited access for babysitters or short-term caregivers',
    color: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300',
    icon: Timer,
  },
}

const defaultPrivacyScopes: PrivacyScope[] = [
  { id: 'vitals', name: 'Vitals & Temperature', icon: Thermometer, enabled: true },
  { id: 'medications', name: 'Medications', icon: Pill, enabled: true },
  { id: 'symptoms', name: 'Symptoms & Assessments', icon: Activity, enabled: true },
  { id: 'growth', name: 'Growth Charts', icon: TrendingUp, enabled: true },
  { id: 'reports', name: 'Doctor Reports', icon: FileText, enabled: false },
  { id: 'notes', name: 'Personal Notes', icon: Edit, enabled: false },
]

const mockMembers: FamilyMember[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    email: 'sarah@example.com',
    phone: '(555) 123-4567',
    role: 'owner',
    memberType: 'family',
    status: 'active',
    lastActive: new Date(),
    addedAt: new Date('2024-01-01'),
    emergencyPriority: 1,
  },
  {
    id: '2',
    name: 'Mike Johnson',
    email: 'mike@example.com',
    role: 'caregiver',
    memberType: 'family',
    status: 'active',
    lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000),
    addedAt: new Date('2024-03-15'),
    emergencyPriority: 2,
    privacyScopes: defaultPrivacyScopes.map(s => ({ ...s, enabled: true })),
  },
  {
    id: '3',
    name: 'Grandma Rose',
    email: 'rose@example.com',
    role: 'viewer',
    memberType: 'family',
    status: 'active',
    lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000),
    addedAt: new Date('2024-06-01'),
    emergencyPriority: 3,
    privacyScopes: defaultPrivacyScopes.map(s => ({ ...s, enabled: s.id !== 'reports' && s.id !== 'notes' })),
  },
  {
    id: '5',
    name: 'Maria (Babysitter)',
    email: 'maria@example.com',
    role: 'temporary',
    memberType: 'family',
    status: 'active',
    lastActive: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    addedAt: new Date('2024-12-01'),
    isTemporary: true,
    recurringSchedule: {
      days: ['Friday', 'Saturday'],
      startTime: '18:00',
      endTime: '23:00',
    },
    privacyScopes: defaultPrivacyScopes.map(s => ({ ...s, enabled: s.id === 'vitals' || s.id === 'medications' })),
  },
]

const mockProviders: FamilyMember[] = [
  {
    id: '4',
    name: 'Dr. Smith',
    email: 'drsmith@clinic.com',
    role: 'viewer',
    memberType: 'provider',
    status: 'pending',
    addedAt: new Date(),
    specialty: 'Pediatrician',
    clinic: 'Children\'s Health Clinic',
  },
  {
    id: '6',
    name: 'Nurse Thompson',
    email: 'nthompson@school.edu',
    role: 'viewer',
    memberType: 'provider',
    status: 'active',
    lastActive: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    addedAt: new Date('2024-09-01'),
    specialty: 'School Nurse',
    clinic: 'Lincoln Elementary',
    privacyScopes: defaultPrivacyScopes.map(s => ({ ...s, enabled: s.id === 'vitals' || s.id === 'medications' })),
  },
]

const mockActivityLog: ActivityLog[] = [
  { id: '1', user: 'Mike Johnson', action: 'logged medication dose', detail: 'Tylenol 500mg', time: new Date(Date.now() - 2 * 60 * 60 * 1000), type: 'edit' },
  { id: '2', user: 'Sarah Johnson', action: 'viewed health report', time: new Date(Date.now() - 4 * 60 * 60 * 1000), type: 'view' },
  { id: '3', user: 'Grandma Rose', action: 'viewed temperature log', time: new Date(Date.now() - 24 * 60 * 60 * 1000), type: 'view' },
  { id: '4', user: 'Maria (Babysitter)', action: 'logged temperature', detail: '99.2°F', time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), type: 'edit' },
  { id: '5', user: 'Nurse Thompson', action: 'exported vaccination record', time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), type: 'export' },
  { id: '6', user: 'System', action: 'sent critical alert to Sarah Johnson', detail: 'Risk Score > 80', time: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), type: 'alert' },
]

export default function FamilyPage() {
  const { selectedChild } = useStore()
  const [members, setMembers] = useState<FamilyMember[]>(mockMembers)
  const [providers, setProviders] = useState<FamilyMember[]>(mockProviders)
  const [activityLog] = useState<ActivityLog[]>(mockActivityLog)
  const [showInvite, setShowInvite] = useState(false)
  const [showInviteProvider, setShowInviteProvider] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'caregiver' | 'viewer' | 'temporary'>('caregiver')
  const [inviteSent, setInviteSent] = useState(false)
  const [showShareLink, setShowShareLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showEmergencyCascade, setShowEmergencyCascade] = useState(false)
  const [showPrivacySettings, setShowPrivacySettings] = useState<string | null>(null)
  const [showAuditLog, setShowAuditLog] = useState(false)
  
  // Temporary access settings
  const [isTemporaryAccess, setIsTemporaryAccess] = useState(false)
  const [temporaryDuration, setTemporaryDuration] = useState<'24h' | '48h' | '1w' | 'recurring'>('24h')
  const [recurringDays, setRecurringDays] = useState<string[]>([])
  const [recurringStartTime, setRecurringStartTime] = useState('18:00')
  const [recurringEndTime, setRecurringEndTime] = useState('22:00')
  
  // Provider invite settings
  const [providerName, setProviderName] = useState('')
  const [providerSpecialty, setProviderSpecialty] = useState('')
  const [providerClinic, setProviderClinic] = useState('')
  
  // Privacy scope settings for new member
  const [selectedScopes, setSelectedScopes] = useState<PrivacyScope[]>(defaultPrivacyScopes)

  const formatLastActive = (date?: Date) => {
    if (!date) return 'Never'
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 5) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }
  
  const formatTimeRemaining = (expiresAt?: Date) => {
    if (!expiresAt) return null
    const now = new Date()
    const diff = expiresAt.getTime() - now.getTime()
    if (diff <= 0) return 'Expired'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days}d ${hours % 24}h remaining`
    return `${hours}h remaining`
  }

  const handleSendInvite = () => {
    if (!inviteEmail) return
    
    const newMember: FamilyMember = {
      id: Date.now().toString(),
      name: inviteEmail.split('@')[0],
      email: inviteEmail,
      role: isTemporaryAccess ? 'temporary' : inviteRole,
      memberType: 'family',
      status: 'pending',
      addedAt: new Date(),
      isTemporary: isTemporaryAccess,
      expiresAt: isTemporaryAccess && temporaryDuration !== 'recurring' 
        ? new Date(Date.now() + (temporaryDuration === '24h' ? 24 : temporaryDuration === '48h' ? 48 : 168) * 60 * 60 * 1000)
        : undefined,
      recurringSchedule: isTemporaryAccess && temporaryDuration === 'recurring' 
        ? { days: recurringDays, startTime: recurringStartTime, endTime: recurringEndTime }
        : undefined,
      privacyScopes: selectedScopes,
    }
    
    setMembers(prev => [...prev, newMember])
    setInviteSent(true)
    setTimeout(() => {
      setInviteSent(false)
      setShowInvite(false)
      setInviteEmail('')
      setIsTemporaryAccess(false)
      setSelectedScopes(defaultPrivacyScopes)
    }, 2000)
  }
  
  const handleSendProviderInvite = () => {
    if (!inviteEmail || !providerName) return
    
    const newProvider: FamilyMember = {
      id: Date.now().toString(),
      name: providerName,
      email: inviteEmail,
      role: 'viewer',
      memberType: 'provider',
      status: 'pending',
      addedAt: new Date(),
      specialty: providerSpecialty,
      clinic: providerClinic,
      privacyScopes: selectedScopes,
    }
    
    setProviders(prev => [...prev, newProvider])
    setInviteSent(true)
    setTimeout(() => {
      setInviteSent(false)
      setShowInviteProvider(false)
      setInviteEmail('')
      setProviderName('')
      setProviderSpecialty('')
      setProviderClinic('')
      setSelectedScopes(defaultPrivacyScopes)
    }, 2000)
  }

  const handleRemoveMember = (id: string, isProvider: boolean = false) => {
    if (isProvider) {
      setProviders(prev => prev.filter(m => m.id !== id))
    } else {
      setMembers(prev => prev.filter(m => m.id !== id))
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText('https://epcid.app/invite/abc123xyz')
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }
  
  const togglePrivacyScope = (scopeId: string) => {
    setSelectedScopes(prev => prev.map(s => 
      s.id === scopeId ? { ...s, enabled: !s.enabled } : s
    ))
  }

  const activeMembers = members.filter(m => m.status === 'active')
  const pendingMembers = members.filter(m => m.status === 'pending')
  const temporaryMembers = members.filter(m => m.isTemporary && m.status === 'active')
  const activeProviders = providers.filter(p => p.status === 'active')
  const pendingProviders = providers.filter(p => p.status === 'pending')
  
  // Sort members by emergency priority
  const sortedActiveMembers = useMemo(() => {
    return [...activeMembers].sort((a, b) => (a.emergencyPriority || 99) - (b.emergencyPriority || 99))
  }, [activeMembers])
  
  const getActivityIcon = (type: ActivityLog['type']) => {
    switch (type) {
      case 'view': return Eye
      case 'edit': return Edit
      case 'alert': return Bell
      case 'login': return Users
      case 'export': return FileText
      default: return Activity
    }
  }
  
  const getActivityColor = (type: ActivityLog['type']) => {
    switch (type) {
      case 'view': return 'text-cyan-500'
      case 'edit': return 'text-emerald-500'
      case 'alert': return 'text-red-500'
      case 'login': return 'text-violet-500'
      case 'export': return 'text-amber-500'
      default: return 'text-surface-500'
    }
  }

  if (!selectedChild) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Users className="w-16 h-16 text-surface-600 dark:text-surface-300 mb-4" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">No Child Selected</h2>
        <p className="text-surface-600 dark:text-surface-400">Select a child to manage family sharing</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Care Circle</h1>
          <p className="text-surface-600 dark:text-surface-400">Manage who can access {selectedChild.name}'s health information</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowAuditLog(true)} icon={<History className="w-4 h-4" />}>
            Audit Log
          </Button>
          <Button onClick={() => setShowInvite(true)} icon={<UserPlus className="w-4 h-4" />} className="bg-gradient-to-r from-cyan-500 to-teal-600">
            Invite Member
          </Button>
        </div>
      </div>
      
      {/* PROMINENT SECURITY AUDIT BANNER */}
      <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-violet-200 dark:border-violet-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
              <Shield className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-bold text-violet-900 dark:text-violet-100">Security Overview</h3>
              <p className="text-sm text-violet-700 dark:text-violet-300">
                Last access: <strong>{activityLog[0]?.user}</strong> {formatLastActive(activityLog[0]?.time)} • {activityLog[0]?.action}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => setShowEmergencyCascade(true)}
              icon={<Bell className="w-4 h-4" />}
            >
              Emergency Alerts
            </Button>
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => setShowAuditLog(true)}
              icon={<Eye className="w-4 h-4" />}
            >
              View All Activity
            </Button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="text-center">
            <div className="text-3xl font-bold text-surface-900 dark:text-white">{activeMembers.length}</div>
            <div className="text-sm text-surface-500">Family Members</div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <div className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{activeProviders.length}</div>
            <div className="text-sm text-surface-500">Providers</div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <div className="text-3xl font-bold text-violet-600 dark:text-violet-400">{temporaryMembers.length}</div>
            <div className="text-sm text-surface-500">Temporary Access</div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{pendingMembers.length + pendingProviders.length}</div>
            <div className="text-sm text-surface-500">Pending</div>
          </div>
        </Card>
      </div>

      {/* Access Levels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-500" />
            Access Levels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-4 gap-4">
            {Object.entries(roleConfig).map(([role, config]) => (
              <div key={role} className={`p-4 rounded-xl ${config.color}`}>
                <div className="flex items-center gap-2 mb-2">
                  <config.icon className="w-5 h-5" />
                  <span className="font-bold">{config.label}</span>
                </div>
                <p className="text-sm opacity-80">{config.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Family Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" />
              Family Members ({activeMembers.length})
            </CardTitle>
            <Button variant="secondary" size="sm" onClick={() => setShowShareLink(true)} icon={<LinkIcon className="w-4 h-4" />}>
              Share Link
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedActiveMembers.map((member, i) => {
              const config = roleConfig[member.role]
              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`p-4 rounded-xl ${
                    member.isTemporary 
                      ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800' 
                      : 'bg-surface-50 dark:bg-surface-800'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                        member.role === 'owner' 
                          ? 'bg-gradient-to-br from-amber-400 to-orange-600'
                          : member.isTemporary
                            ? 'bg-gradient-to-br from-violet-400 to-purple-600'
                            : 'bg-gradient-to-br from-cyan-400 to-teal-600'
                      }`}>
                        {member.name.charAt(0)}
                      </div>
                      {member.emergencyPriority && member.emergencyPriority <= 3 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white dark:border-surface-900">
                          {member.emergencyPriority}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-surface-900 dark:text-white">{member.name}</span>
                        {member.role === 'owner' && (
                          <Crown className="w-4 h-4 text-amber-500" />
                        )}
                        {member.isTemporary && (
                          <Badge variant="info" size="sm">
                            <Timer className="w-3 h-3 mr-1" />
                            Temporary
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-surface-500">{member.email}</div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-surface-600 dark:text-surface-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatLastActive(member.lastActive)}
                        </span>
                        <Badge variant={member.role === 'caregiver' ? 'primary' : member.role === 'temporary' ? 'info' : 'default'} size="sm">
                          {config.label}
                        </Badge>
                        {member.privacyScopes && (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <Lock className="w-3 h-3" />
                            {member.privacyScopes.filter(s => s.enabled).length} scopes
                          </span>
                        )}
                      </div>
                      {/* Temporary Access Info */}
                      {member.isTemporary && (
                        <div className="mt-2 p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-xs">
                          {member.recurringSchedule ? (
                            <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
                              <Calendar className="w-3 h-3" />
                              {member.recurringSchedule.days.join(', ')} • {member.recurringSchedule.startTime} - {member.recurringSchedule.endTime}
                            </div>
                          ) : member.expiresAt && (
                            <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
                              <Timer className="w-3 h-3" />
                              {formatTimeRemaining(member.expiresAt)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {member.role !== 'owner' && (
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-surface-400 hover:text-surface-600"
                          onClick={() => setShowPrivacySettings(member.id)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-surface-600 dark:text-surface-400 hover:text-red-500"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Healthcare Providers Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-cyan-500" />
              Healthcare Providers ({activeProviders.length + pendingProviders.length})
            </CardTitle>
            <Button variant="secondary" size="sm" onClick={() => setShowInviteProvider(true)} icon={<UserPlus className="w-4 h-4" />}>
              Add Provider
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeProviders.length === 0 && pendingProviders.length === 0 ? (
            <div className="text-center py-8">
              <Stethoscope className="w-12 h-12 text-surface-600 dark:text-surface-300 mx-auto mb-3" />
              <p className="text-surface-500">No healthcare providers added yet</p>
              <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">Add your pediatrician or specialists to share health data securely</p>
              <Button 
                variant="secondary" 
                className="mt-4"
                onClick={() => setShowInviteProvider(true)}
                icon={<UserPlus className="w-4 h-4" />}
              >
                Invite Provider
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {[...activeProviders, ...pendingProviders].map((provider, i) => (
                <motion.div
                  key={provider.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`p-4 rounded-xl ${
                    provider.status === 'pending'
                      ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                      : 'bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                      <Stethoscope className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-surface-900 dark:text-white">{provider.name}</span>
                        {provider.status === 'pending' && (
                          <Badge variant="warning" size="sm">Pending</Badge>
                        )}
                      </div>
                      {provider.specialty && (
                        <div className="text-sm text-cyan-600 dark:text-cyan-400 font-medium">{provider.specialty}</div>
                      )}
                      {provider.clinic && (
                        <div className="text-sm text-surface-500">{provider.clinic}</div>
                      )}
                      <div className="text-xs text-surface-600 dark:text-surface-400 mt-1">{provider.email}</div>
                      {provider.privacyScopes && provider.status === 'active' && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
                          <Lock className="w-3 h-3" />
                          Access: {provider.privacyScopes.filter(s => s.enabled).map(s => s.name).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {provider.status === 'pending' && (
                        <Button variant="secondary" size="sm" icon={<Send className="w-4 h-4" />}>
                          Resend
                        </Button>
                      )}
                      {provider.status === 'active' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-surface-400 hover:text-surface-600"
                          onClick={() => setShowPrivacySettings(provider.id)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-surface-600 dark:text-surface-400 hover:text-red-500"
                        onClick={() => handleRemoveMember(provider.id, true)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Family Invites */}
      {pendingMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Pending Family Invites ({pendingMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingMembers.map((member) => {
                const config = roleConfig[member.role]
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                  >
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                      <Mail className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-surface-900 dark:text-white">{member.email}</div>
                      <div className="flex items-center gap-2 text-sm text-surface-500 flex-wrap">
                        <Badge variant="warning" size="sm">Pending</Badge>
                        <span>•</span>
                        <span>Invited as {config.label}</span>
                        {member.isTemporary && (
                          <>
                            <span>•</span>
                            <Badge variant="info" size="sm">
                              <Timer className="w-3 h-3 mr-1" />
                              Temporary
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" icon={<Send className="w-4 h-4" />}>
                        Resend
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-surface-600 dark:text-surface-400 hover:text-red-500"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity - Compact Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-500" />
              Recent Activity
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowAuditLog(true)}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activityLog.slice(0, 4).map((activity) => {
              const IconComponent = getActivityIcon(activity.type)
              return (
                <div key={activity.id} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    activity.type === 'alert' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-surface-100 dark:bg-surface-800'
                  }`}>
                    <IconComponent className={`w-4 h-4 ${getActivityColor(activity.type)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-medium text-surface-900 dark:text-white">{activity.user}</span>
                      <span className="text-surface-600 dark:text-surface-400"> {activity.action}</span>
                      {activity.detail && (
                        <span className="text-surface-500"> • {activity.detail}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-surface-600 dark:text-surface-400">{formatLastActive(activity.time)}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Invite Family Member Modal - Enhanced with Nanny Mode */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => !inviteSent && setShowInvite(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Invite Family Member</CardTitle>
                    <button onClick={() => setShowInvite(false)} className="text-surface-400 hover:text-surface-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {inviteSent ? (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-center py-8"
                    >
                      <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                      </div>
                      <h3 className="text-lg font-bold text-surface-900 dark:text-white">Invite Sent!</h3>
                      <p className="text-surface-500">We've sent an invitation to {inviteEmail}</p>
                      {isTemporaryAccess && (
                        <p className="text-sm text-violet-600 mt-2">
                          <Timer className="w-4 h-4 inline mr-1" />
                          This is a temporary access invitation
                        </p>
                      )}
                    </motion.div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="Enter email address"
                          className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                        />
                      </div>

                      {/* Nanny Mode Toggle */}
                      <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                        <label className="flex items-center justify-between cursor-pointer">
                          <div className="flex items-center gap-3">
                            <Timer className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                            <div>
                              <div className="font-medium text-violet-900 dark:text-violet-100">Temporary Access (Nanny Mode)</div>
                              <div className="text-sm text-violet-700 dark:text-violet-300">For babysitters or short-term caregivers</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isTemporaryAccess}
                            onChange={(e) => setIsTemporaryAccess(e.target.checked)}
                            className="w-5 h-5 rounded text-violet-600"
                          />
                        </label>
                        
                        {isTemporaryAccess && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-4 space-y-3"
                          >
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { value: '24h', label: '24 Hours' },
                                { value: '48h', label: '48 Hours' },
                                { value: '1w', label: '1 Week' },
                                { value: 'recurring', label: 'Recurring' },
                              ].map((option) => (
                                <button
                                  key={option.value}
                                  onClick={() => setTemporaryDuration(option.value as typeof temporaryDuration)}
                                  className={`p-2 rounded-lg text-sm font-medium transition-all ${
                                    temporaryDuration === option.value
                                      ? 'bg-violet-500 text-white'
                                      : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                            
                            {temporaryDuration === 'recurring' && (
                              <div className="space-y-2 pt-2">
                                <label className="text-xs font-medium text-violet-700 dark:text-violet-300">Select Days</label>
                                <div className="flex gap-1">
                                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                                    <button
                                      key={day}
                                      onClick={() => setRecurringDays(prev => 
                                        prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                                      )}
                                      className={`w-10 h-10 rounded-lg text-xs font-medium ${
                                        recurringDays.includes(day)
                                          ? 'bg-violet-500 text-white'
                                          : 'bg-white dark:bg-surface-800 text-surface-600'
                                      }`}
                                    >
                                      {day}
                                    </button>
                                  ))}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-xs text-violet-700 dark:text-violet-300">Start Time</label>
                                    <input
                                      type="time"
                                      value={recurringStartTime}
                                      onChange={(e) => setRecurringStartTime(e.target.value)}
                                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-surface-800 border border-violet-200 dark:border-violet-700"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-violet-700 dark:text-violet-300">End Time</label>
                                    <input
                                      type="time"
                                      value={recurringEndTime}
                                      onChange={(e) => setRecurringEndTime(e.target.value)}
                                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-surface-800 border border-violet-200 dark:border-violet-700"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>

                      {!isTemporaryAccess && (
                        <div>
                          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Access Level
                          </label>
                          <div className="space-y-2">
                            {(['caregiver', 'viewer'] as const).map((role) => {
                              const config = roleConfig[role]
                              return (
                                <div
                                  key={role}
                                  onClick={() => setInviteRole(role)}
                                  className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${
                                    inviteRole === role
                                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                                      : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <config.icon className={`w-5 h-5 ${inviteRole === role ? 'text-cyan-500' : 'text-surface-600 dark:text-surface-400'}`} />
                                    <div className="flex-1">
                                      <div className="font-medium text-surface-900 dark:text-white">{config.label}</div>
                                      <div className="text-sm text-surface-500">{config.description}</div>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                      inviteRole === role ? 'border-cyan-500 bg-cyan-500' : 'border-surface-300'
                                    }`}>
                                      {inviteRole === role && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Privacy Scopes */}
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                          Data Access Permissions
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {selectedScopes.map((scope) => (
                            <div
                              key={scope.id}
                              onClick={() => togglePrivacyScope(scope.id)}
                              className={`p-3 rounded-lg cursor-pointer border transition-all flex items-center gap-2 ${
                                scope.enabled
                                  ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                                  : 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800'
                              }`}
                            >
                              <scope.icon className={`w-4 h-4 ${scope.enabled ? 'text-emerald-600' : 'text-surface-600 dark:text-surface-400'}`} />
                              <span className={`text-sm ${scope.enabled ? 'text-emerald-800 dark:text-emerald-200' : 'text-surface-500'}`}>
                                {scope.name}
                              </span>
                              {scope.enabled && <Check className="w-3 h-3 text-emerald-500 ml-auto" />}
                            </div>
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={handleSendInvite}
                        disabled={!inviteEmail}
                        fullWidth
                        icon={<Send className="w-4 h-4" />}
                        className="bg-gradient-to-r from-cyan-500 to-teal-600"
                      >
                        Send Invitation
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Invite Healthcare Provider Modal */}
      <AnimatePresence>
        {showInviteProvider && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => !inviteSent && setShowInviteProvider(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Stethoscope className="w-5 h-5 text-cyan-500" />
                      Add Healthcare Provider
                    </CardTitle>
                    <button onClick={() => setShowInviteProvider(false)} className="text-surface-400 hover:text-surface-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {inviteSent ? (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-center py-8"
                    >
                      <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                      </div>
                      <h3 className="text-lg font-bold text-surface-900 dark:text-white">Provider Invited!</h3>
                      <p className="text-surface-500">We've sent an invitation to {providerName}</p>
                    </motion.div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Provider Name
                          </label>
                          <input
                            type="text"
                            value={providerName}
                            onChange={(e) => setProviderName(e.target.value)}
                            placeholder="Dr. Smith"
                            className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Specialty
                          </label>
                          <select
                            value={providerSpecialty}
                            onChange={(e) => setProviderSpecialty(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                          >
                            <option value="">Select...</option>
                            <option value="Pediatrician">Pediatrician</option>
                            <option value="School Nurse">School Nurse</option>
                            <option value="Specialist">Specialist</option>
                            <option value="Urgent Care">Urgent Care</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Clinic/School
                          </label>
                          <input
                            type="text"
                            value={providerClinic}
                            onChange={(e) => setProviderClinic(e.target.value)}
                            placeholder="Children's Health Clinic"
                            className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Email Address
                          </label>
                          <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="doctor@clinic.com"
                            className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none"
                          />
                        </div>
                      </div>
                      
                      {/* Privacy Scopes for Provider */}
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                          Data Access Permissions
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {selectedScopes.map((scope) => (
                            <div
                              key={scope.id}
                              onClick={() => togglePrivacyScope(scope.id)}
                              className={`p-3 rounded-lg cursor-pointer border transition-all flex items-center gap-2 ${
                                scope.enabled
                                  ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                                  : 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800'
                              }`}
                            >
                              <scope.icon className={`w-4 h-4 ${scope.enabled ? 'text-emerald-600' : 'text-surface-600 dark:text-surface-400'}`} />
                              <span className={`text-sm ${scope.enabled ? 'text-emerald-800 dark:text-emerald-200' : 'text-surface-500'}`}>
                                {scope.name}
                              </span>
                              {scope.enabled && <Check className="w-3 h-3 text-emerald-500 ml-auto" />}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                        <p className="text-sm text-cyan-700 dark:text-cyan-300 flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Providers have read-only access to selected data categories only.
                        </p>
                      </div>

                      <Button
                        onClick={handleSendProviderInvite}
                        disabled={!inviteEmail || !providerName}
                        fullWidth
                        icon={<Send className="w-4 h-4" />}
                        className="bg-gradient-to-r from-cyan-500 to-teal-600"
                      >
                        Send Provider Invitation
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Link Modal */}
      <AnimatePresence>
        {showShareLink && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowShareLink(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Share Invite Link</CardTitle>
                    <button onClick={() => setShowShareLink(false)} className="text-surface-400 hover:text-surface-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-surface-600 dark:text-surface-400">
                    Share this link with family members to give them viewer access to {selectedChild.name}'s health data.
                  </p>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value="https://epcid.app/invite/abc123xyz"
                      className="flex-1 px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm"
                    />
                    <Button
                      onClick={handleCopyLink}
                      icon={linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      className={linkCopied ? 'bg-emerald-500' : 'bg-gradient-to-r from-cyan-500 to-teal-600'}
                    >
                      {linkCopied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <div className="text-sm text-amber-700 dark:text-amber-300">
                        Anyone with this link can view your child's health information. Only share with trusted family members.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Emergency Cascade Protocol Modal */}
      <AnimatePresence>
        {showEmergencyCascade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowEmergencyCascade(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg"
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="w-5 h-5 text-red-500" />
                      Emergency Alert Cascade
                    </CardTitle>
                    <button onClick={() => setShowEmergencyCascade(false)} className="text-surface-400 hover:text-surface-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <span className="font-bold text-red-800 dark:text-red-200">Critical Alert Protocol</span>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      When Risk Score exceeds 80 (Critical), alerts will be sent in this order. If no response within 5 minutes, the next person is notified.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-surface-700 dark:text-surface-300">
                      Drag to reorder notification priority:
                    </p>
                    {sortedActiveMembers.filter(m => m.role !== 'temporary').map((member, index) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 cursor-move"
                      >
                        <GripVertical className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                        <div className="w-8 h-8 rounded-full bg-red-500 text-white text-sm font-bold flex items-center justify-center">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-surface-900 dark:text-white">{member.name}</div>
                          <div className="text-xs text-surface-500">{member.email}</div>
                        </div>
                        {member.role === 'owner' && (
                          <Badge variant="warning" size="sm">Primary</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-3 rounded-lg bg-surface-100 dark:bg-surface-800">
                    <div className="text-sm text-surface-600 dark:text-surface-400">
                      <strong>Example:</strong> If Risk Score hits 85, Sarah will be alerted first. If she doesn't respond within 5 minutes, Mike will be notified, then Grandma Rose.
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => setShowEmergencyCascade(false)}
                    fullWidth
                    className="bg-gradient-to-r from-cyan-500 to-teal-600"
                  >
                    Save Alert Order
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Full Audit Log Modal */}
      <AnimatePresence>
        {showAuditLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAuditLog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <History className="w-5 h-5 text-violet-500" />
                      Security Audit Log
                    </CardTitle>
                    <button onClick={() => setShowAuditLog(false)} className="text-surface-400 hover:text-surface-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                    <p className="text-sm text-violet-700 dark:text-violet-300 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Complete record of who accessed {selectedChild.name}'s health data
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {activityLog.map((activity) => {
                      const IconComponent = getActivityIcon(activity.type)
                      return (
                        <div 
                          key={activity.id} 
                          className={`flex items-start gap-3 p-3 rounded-lg ${
                            activity.type === 'alert' 
                              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
                              : 'bg-surface-50 dark:bg-surface-800'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            activity.type === 'alert' ? 'bg-red-100 dark:bg-red-900/30' :
                            activity.type === 'edit' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                            activity.type === 'export' ? 'bg-amber-100 dark:bg-amber-900/30' :
                            'bg-surface-100 dark:bg-surface-700'
                          }`}>
                            <IconComponent className={`w-5 h-5 ${getActivityColor(activity.type)}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm">
                              <span className="font-medium text-surface-900 dark:text-white">{activity.user}</span>
                              <span className="text-surface-600 dark:text-surface-400"> {activity.action}</span>
                            </div>
                            {activity.detail && (
                              <div className="text-xs text-surface-500 mt-1">{activity.detail}</div>
                            )}
                            <div className="text-xs text-surface-600 dark:text-surface-400 mt-1">
                              {activity.time.toLocaleString()}
                            </div>
                          </div>
                          <Badge 
                            variant={
                              activity.type === 'alert' ? 'danger' :
                              activity.type === 'edit' ? 'success' :
                              activity.type === 'export' ? 'warning' :
                              'default'
                            } 
                            size="sm"
                          >
                            {activity.type}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
                    <Button variant="secondary" fullWidth icon={<FileText className="w-4 h-4" />}>
                      Export Full Audit Log (PDF)
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
