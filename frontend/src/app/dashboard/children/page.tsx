'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Edit2,
  Trash2,
  X,
  User,
  Calendar,
  Heart,
  AlertTriangle,
  Check,
  CheckCircle,
  Activity,
  Thermometer,
  Bell,
  BellOff,
  Scale,
  Clock,
  Users,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import useStore from '@/store/useStore'
import { isDemoMode } from '@/lib/api'
import { calculateAge, formatAge } from '@/lib/utils'

export default function ChildrenPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { 
    children, 
    addChild, 
    updateChild, 
    removeChild, 
    selectChild, 
    selectedChild,
    vitalReadings,
    symptomHistory,
    detectedEvents,
  } = useStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingChild, setEditingChild] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [hasOpenedFromQuery, setHasOpenedFromQuery] = useState(false)
  const [hasSyncedChild, setHasSyncedChild] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    date_of_birth: '',
    gender: '',
    weight_lbs: '',
    medical_conditions: '',
    allergies: '',
  })
  
  // Get live health status for a child
  const getChildHealthStatus = (childId: string) => {
    // Check for pending events (alerts)
    const pendingAlerts = detectedEvents.filter(
      e => e.child_id === childId && e.status === 'pending'
    )
    
    // Get recent vital readings
    const recentVitals = vitalReadings.filter(
      v => v.child_id === childId
    ).slice(0, 5)
    
    // Get recent symptoms
    const recentSymptoms = symptomHistory.filter(
      s => s.child_id === childId
    ).slice(0, 3)
    
    // Determine health status
    const hasHighTemp = recentVitals.some(v => v.type === 'temperature' && v.value > 100.4)
    const hasPendingAlerts = pendingAlerts.length > 0
    const hasRecentSymptoms = recentSymptoms.length > 0
    
    if (hasHighTemp || hasPendingAlerts) {
      return {
        status: 'alert',
        label: hasPendingAlerts ? `${pendingAlerts.length} Alert${pendingAlerts.length > 1 ? 's' : ''}` : 'Elevated Temp',
        color: 'text-red-500',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        icon: Bell,
      }
    }
    
    if (hasRecentSymptoms) {
      return {
        status: 'monitoring',
        label: 'Monitoring',
        color: 'text-amber-500',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        icon: Activity,
      }
    }
    
    return {
      status: 'stable',
      label: 'Stable',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      icon: CheckCircle,
    }
  }
  
  // Get most recent temperature for a child
  const getRecentTemp = (childId: string) => {
    const temp = vitalReadings.find(
      v => v.child_id === childId && v.type === 'temperature'
    )
    return temp ? `${temp.value}°F` : null
  }

  // Sync selectedChild with children array (fixes persistence issue) - only run once
  useEffect(() => {
    if (!hasSyncedChild && selectedChild) {
      const existsInChildren = children.some(c => c.id === selectedChild.id)
      if (!existsInChildren) {
        addChild(selectedChild)
      }
      setHasSyncedChild(true)
    }
  }, [selectedChild, children, addChild, hasSyncedChild])

  const openModal = (child?: any) => {
    if (child) {
      setEditingChild(child)
      setFormData({
        name: child.name,
        date_of_birth: child.date_of_birth.split('T')[0],
        gender: child.gender || '',
        weight_lbs: child.weight_lbs?.toString() || '',
        medical_conditions: child.medical_conditions?.join(', ') || '',
        allergies: child.allergies?.join(', ') || '',
      })
    } else {
      setEditingChild(null)
      setFormData({
        name: '',
        date_of_birth: '',
        gender: '',
        weight_lbs: '',
        medical_conditions: '',
        allergies: '',
      })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingChild(null)
    setFormData({
      name: '',
      date_of_birth: '',
      gender: '',
      weight_lbs: '',
      medical_conditions: '',
      allergies: '',
    })
    // Clear the edit query param when closing modal
    if (searchParams.get('edit')) {
      router.replace('/dashboard/children', { scroll: false })
    }
  }

  // Auto-open edit modal if coming from dashboard with edit param
  const editId = searchParams.get('edit')
  useEffect(() => {
    if (editId && !hasOpenedFromQuery) {
      // Try to find in children array first, then fall back to selectedChild
      const childFromArray = children.find(c => c.id === editId)
      const childToEdit = childFromArray || (selectedChild?.id === editId ? selectedChild : null)
      
      if (childToEdit) {
        // Directly set state instead of calling openModal to avoid dependency issues
        setEditingChild(childToEdit)
        setFormData({
          name: childToEdit.name,
          date_of_birth: childToEdit.date_of_birth.split('T')[0],
          gender: childToEdit.gender || '',
          weight_lbs: childToEdit.weight_lbs?.toString() || '',
          medical_conditions: childToEdit.medical_conditions?.join(', ') || '',
          allergies: childToEdit.allergies?.join(', ') || '',
        })
        setIsModalOpen(true)
        setHasOpenedFromQuery(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, hasOpenedFromQuery, children.length, selectedChild?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const data = {
      name: formData.name,
      date_of_birth: formData.date_of_birth,
      gender: formData.gender || undefined,
      weight_lbs: formData.weight_lbs ? parseFloat(formData.weight_lbs) : undefined,
      medical_conditions: formData.medical_conditions
        ? formData.medical_conditions.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      allergies: formData.allergies
        ? formData.allergies.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
    }

    // Create local child (works in demo mode and as fallback)
    const localChild = {
      id: editingChild?.id || `child-${Date.now()}`,
      name: data.name,
      date_of_birth: data.date_of_birth,
      gender: data.gender,
      weight_lbs: data.weight_lbs,
      medical_conditions: data.medical_conditions,
      allergies: data.allergies,
      created_at: new Date().toISOString(),
    }

    // In demo mode, just use local storage
    if (isDemoMode()) {
      if (editingChild) {
        updateChild(editingChild.id, localChild)
      } else {
        addChild(localChild)
        if (children.length === 0) {
          selectChild(localChild)
        }
      }
      closeModal()
      setLoading(false)
      return
    }

    // Try API if not in demo mode
    try {
      const { childrenApi } = await import('@/lib/api')
      if (editingChild) {
        const updated = await childrenApi.update(editingChild.id, data)
        updateChild(editingChild.id, updated)
      } else {
        const created = await childrenApi.create(data)
        addChild(created)
        if (children.length === 0) {
          selectChild(created)
        }
      }
    } catch (error) {
      // Use local child as fallback
      if (editingChild) {
        updateChild(editingChild.id, localChild)
      } else {
        addChild(localChild)
        if (children.length === 0) {
          selectChild(localChild)
        }
      }
    }
    
    closeModal()
    setLoading(false)
  }

  const handleDelete = async (childId: string) => {
    if (!confirm('Are you sure you want to remove this child profile?')) return

    // In demo mode, just remove locally
    if (!isDemoMode()) {
      try {
        const { childrenApi } = await import('@/lib/api')
        await childrenApi.delete(childId)
      } catch (error) {
        // API might fail, but still remove locally
      }
    }
    removeChild(childId)
  }

  // Dedupe children array to prevent duplicate key warnings
  const uniqueChildren = children.filter((child, index, self) => 
    index === self.findIndex(c => c.id === child.id)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Children</h1>
          <p className="text-surface-600 dark:text-surface-400">Manage your children&apos;s profiles</p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="w-4 h-4" />
          Add Child
        </Button>
      </div>

      {/* Children Grid */}
      {uniqueChildren.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {uniqueChildren.map((child, i) => {
            const healthStatus = getChildHealthStatus(child.id)
            const recentTemp = getRecentTemp(child.id)
            const StatusIcon = healthStatus.icon
            
            return (
              <motion.div
                key={child.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card
                  hover
                  className={`relative ${selectedChild?.id === child.id ? 'ring-2 ring-cyan-500' : ''}`}
                  onClick={() => selectChild(child)}
                >
                  {/* Selection indicator */}
                  {selectedChild?.id === child.id && (
                    <div className="absolute top-4 right-4">
                      <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}

                  {/* Live Health Status Badge */}
                  <div className={`absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full ${healthStatus.bgColor}`}>
                    <StatusIcon className={`w-3.5 h-3.5 ${healthStatus.color}`} />
                    <span className={`text-xs font-medium ${healthStatus.color}`}>
                      {healthStatus.label}
                    </span>
                  </div>

                  {/* Profile Header */}
                  <div className="flex items-center gap-4 mb-4 mt-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                      {child.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-surface-900 dark:text-white">{child.name}</h3>
                      <p className="text-surface-500 dark:text-surface-400">
                        {calculateAge(child.date_of_birth)} years old
                        {child.gender && ` • ${child.gender}`}
                      </p>
                    </div>
                  </div>

                  {/* Quick Stats Row */}
                  <div className="grid grid-cols-3 gap-2 mb-4 p-3 rounded-xl bg-surface-100 dark:bg-surface-800/50">
                    <div className="text-center">
                      <div className="text-xs text-surface-500 dark:text-surface-400 mb-0.5">Weight</div>
                      <div className="text-sm font-semibold text-surface-900 dark:text-white">
                        {child.weight_lbs ? `${child.weight_lbs} lbs` : '—'}
                      </div>
                    </div>
                    <div className="text-center border-x border-surface-200 dark:border-surface-700">
                      <div className="text-xs text-surface-500 dark:text-surface-400 mb-0.5">Temp</div>
                      <div className={`text-sm font-semibold ${
                        recentTemp && parseFloat(recentTemp) > 100.4 
                          ? 'text-red-500' 
                          : 'text-surface-900 dark:text-white'
                      }`}>
                        {recentTemp || '—'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-surface-500 dark:text-surface-400 mb-0.5">Age</div>
                      <div className="text-sm font-semibold text-surface-900 dark:text-white">
                        {calculateAge(child.date_of_birth)}y
                      </div>
                    </div>
                  </div>

                  {/* Medical History */}
                  <div className="space-y-3 mb-4">
                    {child.medical_conditions && child.medical_conditions.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Heart className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-xs text-surface-500 dark:text-surface-400 block mb-1">Chronic Conditions</span>
                          <div className="flex flex-wrap gap-1">
                            {child.medical_conditions.map((condition: string) => (
                              <span
                                key={condition}
                                className="px-2 py-0.5 text-xs rounded-full bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300"
                              >
                                {condition}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {child.allergies && child.allergies.length > 0 && (
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-xs text-surface-500 dark:text-surface-400 block mb-1">Allergies</span>
                          <div className="flex flex-wrap gap-1">
                            {child.allergies.map((allergy: string) => (
                              <span
                                key={allergy}
                                className="px-2 py-0.5 text-xs rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400"
                              >
                                {allergy}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <Link
                      href={`/dashboard/symptom-checker`}
                      onClick={(e) => {
                        e.stopPropagation()
                        selectChild(child)
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 text-sm font-medium hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors"
                    >
                      <Thermometer className="w-4 h-4" />
                      Log Vitals
                    </Link>
                    <Link
                      href={`/dashboard/symptom-checker`}
                      onClick={(e) => {
                        e.stopPropagation()
                        selectChild(child)
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 text-sm font-medium hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
                    >
                      <Activity className="w-4 h-4" />
                      Add Symptom
                    </Link>
                  </div>

                  {/* Edit/Remove Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-surface-200 dark:border-surface-800">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openModal(child)
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(child.id)
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      ) : (
        <Card className="py-16">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
              <User className="w-10 h-10 text-surface-500" />
            </div>
            <h3 className="text-xl font-bold text-surface-900 dark:text-white mb-2">No Children Added</h3>
            <p className="text-surface-600 dark:text-surface-400 mb-6 max-w-md mx-auto">
              Add your child&apos;s profile to start monitoring their health and receive AI-powered assessments.
            </p>
            <Button onClick={() => openModal()}>
              <Plus className="w-4 h-4" />
              Add Your First Child
            </Button>
          </div>
        </Card>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg"
            >
              <Card className="max-h-[90vh] overflow-y-auto">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>
                      {editingChild ? 'Edit Child Profile' : 'Add New Child'}
                    </CardTitle>
                    <button
                      onClick={closeModal}
                      className="p-2 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all active:scale-90 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-800"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      label="Child's Name"
                      type="text"
                      placeholder="Enter name"
                      icon={<User className="w-4 h-4" />}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />

                    <Input
                      label="Date of Birth"
                      type="date"
                      icon={<Calendar className="w-4 h-4" />}
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      required
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                          Gender (Optional)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {['Male', 'Female', 'Other'].map((gender) => (
                            <button
                              key={gender}
                              type="button"
                              onClick={() => setFormData({ ...formData, gender })}
                              className={`
                                p-2.5 rounded-xl border transition-all active:scale-95 transform text-sm
                                ${formData.gender === gender
                                  ? 'border-cyan-500 bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                                  : 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:border-surface-300 dark:hover:border-surface-600'
                                }
                              `}
                            >
                              {gender}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                          Weight (lbs) <span className="text-amber-500">*Important</span>
                        </label>
                        <Input
                          type="number"
                          placeholder="e.g., 45"
                          icon={<Scale className="w-4 h-4" />}
                          value={formData.weight_lbs}
                          onChange={(e) => setFormData({ ...formData, weight_lbs: e.target.value })}
                          min="1"
                          max="300"
                          step="0.5"
                        />
                        <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                          Required for accurate medication dosing
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-surface-600 dark:text-surface-300 mb-2">
                        Medical Conditions (Optional)
                      </label>
                      <Input
                        placeholder="e.g., Asthma, Eczema (comma separated)"
                        icon={<Heart className="w-4 h-4" />}
                        value={formData.medical_conditions}
                        onChange={(e) => setFormData({ ...formData, medical_conditions: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-surface-600 dark:text-surface-300 mb-2">
                        Allergies (Optional)
                      </label>
                      <Input
                        placeholder="e.g., Peanuts, Penicillin (comma separated)"
                        icon={<AlertTriangle className="w-4 h-4" />}
                        value={formData.allergies}
                        onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        type="button"
                        variant="secondary"
                        className="flex-1"
                        onClick={closeModal}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" loading={loading} className="flex-1">
                        {editingChild ? 'Save Changes' : 'Add Child'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
