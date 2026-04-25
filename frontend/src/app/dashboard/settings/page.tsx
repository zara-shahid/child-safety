'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings,
  User,
  Bell,
  Shield,
  Moon,
  Globe,
  Smartphone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Save,
  Check,
  AlertTriangle,
  Trash2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import useStore from '@/store/useStore'

export default function SettingsPage() {
  const { user, logout } = useStore()
  const [activeTab, setActiveTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  const [profile, setProfile] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
  })
  
  const [notifications, setNotifications] = useState({
    email_alerts: true,
    push_notifications: true,
    symptom_reminders: true,
    medication_reminders: true,
    weekly_summary: false,
    critical_alerts: true,
  })
  
  const [privacy, setPrivacy] = useState({
    share_with_doctor: true,
    anonymous_data: false,
    location_services: true,
  })

  const handleSave = async () => {
    setSaving(true)
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'account', label: 'Account', icon: Lock },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Settings</h1>
        <p className="text-surface-600 dark:text-surface-400">Manage your account and preferences</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Tabs */}
        <Card className="lg:col-span-1 h-fit">
          <CardContent className="p-2">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                    ${activeTab === tab.id
                      ? 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                    }
                  `}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>

        {/* Content */}
        <div className="lg:col-span-3">
          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-cyan-500" />
                    Profile Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-teal-600 flex items-center justify-center text-white text-3xl font-bold">
                      {profile.full_name.charAt(0) || 'U'}
                    </div>
                    <div>
                      <Button variant="secondary" size="sm">
                        Change Photo
                      </Button>
                      <p className="text-xs text-surface-500 mt-2">JPG, PNG or GIF. Max 2MB</p>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input
                      label="Full Name"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      icon={<User className="w-4 h-4" />}
                    />
                    <Input
                      label="Email Address"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      icon={<Mail className="w-4 h-4" />}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleSave} loading={saving}>
                      {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                      {saved ? 'Saved!' : 'Save Changes'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-cyan-500" />
                    Notification Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { key: 'email_alerts', label: 'Email Alerts', desc: 'Receive important alerts via email' },
                    { key: 'push_notifications', label: 'Push Notifications', desc: 'Get notified on your device' },
                    { key: 'symptom_reminders', label: 'Symptom Check Reminders', desc: 'Daily reminders to log symptoms' },
                    { key: 'medication_reminders', label: 'Medication Reminders', desc: 'Never miss a dose' },
                    { key: 'weekly_summary', label: 'Weekly Health Summary', desc: 'Get a weekly health report' },
                    { key: 'critical_alerts', label: 'Critical Health Alerts', desc: 'Immediate alerts for urgent issues', important: true },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className={`flex items-center justify-between p-4 rounded-xl ${
                        item.important ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-surface-50 dark:bg-surface-800'
                      }`}
                    >
                      <div>
                        <div className={`font-medium ${item.important ? 'text-red-600 dark:text-red-400' : 'text-surface-900 dark:text-white'}`}>
                          {item.label}
                        </div>
                        <div className="text-sm text-surface-500 dark:text-surface-400">{item.desc}</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications[item.key as keyof typeof notifications]}
                          onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-surface-300 dark:bg-surface-600 peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                      </label>
                    </div>
                  ))}

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} loading={saving}>
                      {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                      {saved ? 'Saved!' : 'Save Preferences'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Privacy Settings */}
          {activeTab === 'privacy' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-cyan-500" />
                    Privacy & Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { key: 'share_with_doctor', label: 'Share with Healthcare Providers', desc: 'Allow doctors to access your health data' },
                    { key: 'anonymous_data', label: 'Contribute Anonymous Data', desc: 'Help improve EPCID with anonymized health data' },
                    { key: 'location_services', label: 'Location Services', desc: 'Enable for nearby care facilities and local health alerts' },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-4 rounded-xl bg-surface-50 dark:bg-surface-800"
                    >
                      <div>
                        <div className="font-medium text-surface-900 dark:text-white">{item.label}</div>
                        <div className="text-sm text-surface-500 dark:text-surface-400">{item.desc}</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={privacy[item.key as keyof typeof privacy]}
                          onChange={(e) => setPrivacy({ ...privacy, [item.key]: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-surface-300 dark:bg-surface-600 peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                      </label>
                    </div>
                  ))}

                  <div className="mt-6 p-4 rounded-xl bg-surface-100 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
                    <h4 className="font-medium text-surface-900 dark:text-white mb-2">Data Management</h4>
                    <p className="text-sm text-surface-600 dark:text-surface-400 mb-4">
                      Download or delete your personal data from EPCID.
                    </p>
                    <div className="flex gap-3">
                      <Button variant="secondary" size="sm">
                        Download My Data
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                        Request Data Deletion
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} loading={saving}>
                      {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                      {saved ? 'Saved!' : 'Save Settings'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Account Settings */}
          {activeTab === 'account' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-cyan-500" />
                    Change Password
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label="Current Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter current password"
                    icon={<Lock className="w-4 h-4" />}
                  />
                  <Input
                    label="New Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    icon={<Lock className="w-4 h-4" />}
                  />
                  <Input
                    label="Confirm New Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    icon={<Lock className="w-4 h-4" />}
                  />
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="rounded border-surface-300 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-surface-600 dark:text-surface-400">Show passwords</span>
                  </label>

                  <div className="flex justify-end">
                    <Button onClick={handleSave} loading={saving}>
                      Update Password
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-5 h-5" />
                    Danger Zone
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <h4 className="font-medium text-red-600 dark:text-red-400 mb-2">Delete Account</h4>
                    <p className="text-sm text-red-600/80 dark:text-red-400/80 mb-4">
                      Once you delete your account, there is no going back. All your data will be permanently removed.
                    </p>
                    <Button variant="danger" size="sm">
                      <Trash2 className="w-4 h-4" />
                      Delete Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
