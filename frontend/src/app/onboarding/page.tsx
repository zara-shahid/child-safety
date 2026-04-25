'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Baby,
  Heart,
  Bell,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Calendar,
  User,
  Pill,
  Plus,
  X,
} from 'lucide-react'
import { Button, Card, Input, Badge, Logo } from '@/components/ui'
import useStore from '@/store/useStore'

const commonConditions = [
  'Asthma', 'Eczema', 'Food Allergies', 'Seasonal Allergies',
  'ADHD', 'Autism', 'Diabetes', 'Heart Condition', 'Seizures'
]

const commonAllergies = [
  'Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Wheat', 'Soy',
  'Fish', 'Shellfish', 'Penicillin', 'Sulfa Drugs'
]

interface ChildData {
  name: string
  dateOfBirth: string
  gender: string
  conditions: string[]
  allergies: string[]
  medications: string[]
}

export default function OnboardingPage() {
  const router = useRouter()
  const { setChildren, selectChild } = useStore()
  const [currentStep, setCurrentStep] = useState(0)
  const [childData, setChildData] = useState<ChildData>({
    name: '',
    dateOfBirth: '',
    gender: '',
    conditions: [],
    allergies: [],
    medications: [],
  })
  const [customCondition, setCustomCondition] = useState('')
  const [customAllergy, setCustomAllergy] = useState('')
  const [customMedication, setCustomMedication] = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const steps = [
    { id: 'welcome', title: 'Welcome', icon: Shield },
    { id: 'child', title: 'Child Info', icon: Baby },
    { id: 'health', title: 'Health History', icon: Heart },
    { id: 'notifications', title: 'Notifications', icon: Bell },
    { id: 'complete', title: 'All Set!', icon: Sparkles },
  ]

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleComplete = async () => {
    // Create the child profile
    const newChild = {
      id: Date.now().toString(),
      name: childData.name,
      date_of_birth: childData.dateOfBirth,
      gender: childData.gender,
      medical_conditions: childData.conditions,
      allergies: childData.allergies,
      current_medications: childData.medications,
      created_at: new Date().toISOString(),
    }

    // In real app, this would be an API call
    setChildren([newChild])
    selectChild(newChild)

    // Redirect to dashboard
    router.push('/dashboard')
  }

  const toggleCondition = (condition: string) => {
    setChildData(prev => ({
      ...prev,
      conditions: prev.conditions.includes(condition)
        ? prev.conditions.filter(c => c !== condition)
        : [...prev.conditions, condition]
    }))
  }

  const toggleAllergy = (allergy: string) => {
    setChildData(prev => ({
      ...prev,
      allergies: prev.allergies.includes(allergy)
        ? prev.allergies.filter(a => a !== allergy)
        : [...prev.allergies, allergy]
    }))
  }

  const addCustomCondition = () => {
    if (customCondition.trim() && !childData.conditions.includes(customCondition.trim())) {
      setChildData(prev => ({
        ...prev,
        conditions: [...prev.conditions, customCondition.trim()]
      }))
      setCustomCondition('')
    }
  }

  const addCustomAllergy = () => {
    if (customAllergy.trim() && !childData.allergies.includes(customAllergy.trim())) {
      setChildData(prev => ({
        ...prev,
        allergies: [...prev.allergies, customAllergy.trim()]
      }))
      setCustomAllergy('')
    }
  }

  const addMedication = () => {
    if (customMedication.trim() && !childData.medications.includes(customMedication.trim())) {
      setChildData(prev => ({
        ...prev,
        medications: [...prev.medications, customMedication.trim()]
      }))
      setCustomMedication('')
    }
  }

  const removeMedication = (med: string) => {
    setChildData(prev => ({
      ...prev,
      medications: prev.medications.filter(m => m !== med)
    }))
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: return true
      case 1: return childData.name && childData.dateOfBirth && childData.gender
      case 2: return true // Health history is optional
      case 3: return true
      case 4: return true
      default: return false
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-6">
        <Logo size="md" showPulse={true} animate={false} />
      </div>

      {/* Progress Bar */}
      <div className="px-6 mb-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all
                  ${index < currentStep 
                    ? 'bg-cyan-500 text-white' 
                    : index === currentStep
                      ? 'bg-white dark:bg-surface-800 text-cyan-600 dark:text-cyan-400 ring-2 ring-cyan-500 shadow-lg'
                      : 'bg-surface-200 dark:bg-surface-700 text-surface-400'
                  }
                `}>
                  {index < currentStep ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-12 sm:w-20 h-1 mx-1 rounded-full ${
                    index < currentStep ? 'bg-cyan-500' : 'bg-surface-200 dark:bg-surface-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <span className="text-sm text-surface-500">Step {currentStep + 1} of {steps.length}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pb-6">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Step 0: Welcome */}
              {currentStep === 0 && (
                <Card className="text-center py-12">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-xl">
                    <Shield className="w-12 h-12 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-4">
                    Welcome to EPCID
                  </h1>
                  <p className="text-lg text-surface-600 dark:text-surface-400 mb-8 max-w-md mx-auto">
                    Let's set up your child's health profile so we can provide personalized care guidance.
                  </p>
                  <div className="grid sm:grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
                    <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20">
                      <AlertCircle className="w-8 h-8 text-cyan-600 dark:text-cyan-400 mx-auto mb-2" />
                      <div className="text-sm font-medium text-surface-700 dark:text-surface-300">Symptom Tracking</div>
                    </div>
                    <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20">
                      <Heart className="w-8 h-8 text-cyan-600 dark:text-cyan-400 mx-auto mb-2" />
                      <div className="text-sm font-medium text-surface-700 dark:text-surface-300">AI Health Analysis</div>
                    </div>
                    <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20">
                      <Bell className="w-8 h-8 text-cyan-600 dark:text-cyan-400 mx-auto mb-2" />
                      <div className="text-sm font-medium text-surface-700 dark:text-surface-300">Smart Reminders</div>
                    </div>
                  </div>
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    This takes about 2 minutes. Your data is encrypted and HIPAA compliant.
                  </p>
                </Card>
              )}

              {/* Step 1: Child Info */}
              {currentStep === 1 && (
                <Card>
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
                      <Baby className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">
                      Tell us about your child
                    </h2>
                    <p className="text-surface-600 dark:text-surface-400">
                      We'll use this to provide age-appropriate guidance
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                        Child's Name
                      </label>
                      <input
                        type="text"
                        value={childData.name}
                        onChange={(e) => setChildData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter your child's name"
                        className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none text-surface-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={childData.dateOfBirth}
                        onChange={(e) => setChildData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none text-surface-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                        Gender
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {['Male', 'Female', 'Other'].map((gender) => (
                          <button
                            key={gender}
                            onClick={() => setChildData(prev => ({ ...prev, gender }))}
                            className={`
                              py-3 px-4 rounded-xl font-medium transition-all
                              ${childData.gender === gender
                                ? 'bg-cyan-500 text-white'
                                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                              }
                            `}
                          >
                            {gender}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Step 2: Health History */}
              {currentStep === 2 && (
                <Card>
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
                      <Heart className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">
                      Health History
                    </h2>
                    <p className="text-surface-600 dark:text-surface-400">
                      This helps us provide safer recommendations (optional)
                    </p>
                  </div>

                  <div className="space-y-6">
                    {/* Conditions */}
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">
                        Medical Conditions
                      </label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {commonConditions.map((condition) => (
                          <button
                            key={condition}
                            onClick={() => toggleCondition(condition)}
                            className={`
                              px-3 py-1.5 rounded-full text-sm font-medium transition-all
                              ${childData.conditions.includes(condition)
                                ? 'bg-cyan-500 text-white'
                                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                              }
                            `}
                          >
                            {condition}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customCondition}
                          onChange={(e) => setCustomCondition(e.target.value)}
                          placeholder="Add other condition..."
                          className="flex-1 px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none text-sm"
                          onKeyDown={(e) => e.key === 'Enter' && addCustomCondition()}
                        />
                        <Button size="sm" onClick={addCustomCondition} icon={<Plus className="w-4 h-4" />}>
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Allergies */}
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">
                        Allergies
                      </label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {commonAllergies.map((allergy) => (
                          <button
                            key={allergy}
                            onClick={() => toggleAllergy(allergy)}
                            className={`
                              px-3 py-1.5 rounded-full text-sm font-medium transition-all
                              ${childData.allergies.includes(allergy)
                                ? 'bg-red-500 text-white'
                                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                              }
                            `}
                          >
                            {allergy}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customAllergy}
                          onChange={(e) => setCustomAllergy(e.target.value)}
                          placeholder="Add other allergy..."
                          className="flex-1 px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none text-sm"
                          onKeyDown={(e) => e.key === 'Enter' && addCustomAllergy()}
                        />
                        <Button size="sm" onClick={addCustomAllergy} icon={<Plus className="w-4 h-4" />}>
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Current Medications */}
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">
                        Current Medications
                      </label>
                      {childData.medications.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {childData.medications.map((med) => (
                            <Badge key={med} variant="primary" className="flex items-center gap-1">
                              <Pill className="w-3 h-3" />
                              {med}
                              <button onClick={() => removeMedication(med)}>
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customMedication}
                          onChange={(e) => setCustomMedication(e.target.value)}
                          placeholder="Add medication..."
                          className="flex-1 px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 focus:border-cyan-500 outline-none text-sm"
                          onKeyDown={(e) => e.key === 'Enter' && addMedication()}
                        />
                        <Button size="sm" onClick={addMedication} icon={<Plus className="w-4 h-4" />}>
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Step 3: Notifications */}
              {currentStep === 3 && (
                <Card>
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
                      <Bell className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">
                      Stay Informed
                    </h2>
                    <p className="text-surface-600 dark:text-surface-400">
                      Get timely reminders and health alerts
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div 
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        notificationsEnabled 
                          ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20' 
                          : 'border-surface-200 dark:border-surface-700'
                      }`}
                      onClick={() => setNotificationsEnabled(true)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            notificationsEnabled ? 'bg-cyan-500 text-white' : 'bg-surface-200 dark:bg-surface-700 text-surface-400'
                          }`}>
                            <Bell className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-surface-900 dark:text-white">Enable Notifications</div>
                            <div className="text-sm text-surface-500">Recommended for best experience</div>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          notificationsEnabled ? 'border-cyan-500 bg-cyan-500' : 'border-surface-300'
                        }`}>
                          {notificationsEnabled && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800">
                      <h4 className="font-medium text-surface-900 dark:text-white mb-3">You'll receive alerts for:</h4>
                      <ul className="space-y-2">
                        {[
                          'Medication reminders',
                          'Symptom check-in prompts',
                          'Health trend changes',
                          'Doctor appointment reminders',
                          'Vaccine schedule notifications',
                        ].map((item, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                            <Check className="w-4 h-4 text-cyan-500" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div 
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        !notificationsEnabled 
                          ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20' 
                          : 'border-surface-200 dark:border-surface-700'
                      }`}
                      onClick={() => setNotificationsEnabled(false)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-surface-900 dark:text-white">Maybe Later</div>
                          <div className="text-sm text-surface-500">You can enable this in settings</div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          !notificationsEnabled ? 'border-cyan-500 bg-cyan-500' : 'border-surface-300'
                        }`}>
                          {!notificationsEnabled && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Step 4: Complete */}
              {currentStep === 4 && (
                <Card className="text-center py-12">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-xl"
                  >
                    <Check className="w-12 h-12 text-white" />
                  </motion.div>
                  <h2 className="text-3xl font-bold text-surface-900 dark:text-white mb-4">
                    You're All Set! 🎉
                  </h2>
                  <p className="text-lg text-surface-600 dark:text-surface-400 mb-8 max-w-md mx-auto">
                    {childData.name}'s profile is ready. Let's start monitoring their health!
                  </p>

                  <div className="bg-surface-50 dark:bg-surface-800 rounded-2xl p-6 max-w-sm mx-auto mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-400 to-teal-600 flex items-center justify-center text-white text-2xl font-bold">
                      {childData.name.charAt(0)}
                    </div>
                    <h3 className="text-xl font-bold text-surface-900 dark:text-white">{childData.name}</h3>
                    <p className="text-surface-500 mb-4">
                      {new Date().getFullYear() - new Date(childData.dateOfBirth).getFullYear()} years old • {childData.gender}
                    </p>
                    {(childData.conditions.length > 0 || childData.allergies.length > 0) && (
                      <div className="flex flex-wrap gap-1 justify-center">
                        {childData.conditions.slice(0, 2).map(c => (
                          <Badge key={c} variant="default" size="sm">{c}</Badge>
                        ))}
                        {childData.allergies.slice(0, 2).map(a => (
                          <Badge key={a} variant="danger" size="sm">{a}</Badge>
                        ))}
                        {(childData.conditions.length + childData.allergies.length > 4) && (
                          <Badge variant="default" size="sm">+{childData.conditions.length + childData.allergies.length - 4} more</Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4 max-w-lg mx-auto text-left">
                    <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20">
                      <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">1</div>
                      <div className="text-sm text-surface-600 dark:text-surface-400">Log symptoms anytime</div>
                    </div>
                    <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20">
                      <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">2</div>
                      <div className="text-sm text-surface-600 dark:text-surface-400">Track medications</div>
                    </div>
                    <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20">
                      <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">3</div>
                      <div className="text-sm text-surface-600 dark:text-surface-400">Get AI guidance</div>
                    </div>
                  </div>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            {currentStep > 0 && currentStep < 4 ? (
              <Button variant="secondary" onClick={handleBack} icon={<ChevronLeft className="w-4 h-4" />}>
                Back
              </Button>
            ) : (
              <div />
            )}
            
            {currentStep < 4 ? (
              <Button 
                onClick={handleNext} 
                disabled={!canProceed()}
                icon={<ChevronRight className="w-4 h-4" />}
                iconPosition="right"
                className="bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700"
              >
                {currentStep === 0 ? "Let's Start" : 'Continue'}
              </Button>
            ) : (
              <Button 
                onClick={handleComplete}
                icon={<Sparkles className="w-4 h-4" />}
                className="bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 w-full sm:w-auto"
              >
                Go to Dashboard
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
