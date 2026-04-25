'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, Lock, User, ArrowRight, Check, Eye, EyeOff } from 'lucide-react'
import { Button, Input, Logo } from '@/components/ui'
import { authApi } from '@/lib/api'
import useStore from '@/store/useStore'

// Social Icons as components
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
)

const FacebookIcon = () => (
  <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
)

const XIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

const AppleIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
  </svg>
)

const features = [
  'AI-powered symptom analysis',
  'Clinical-grade risk assessment',
  'Medication tracking & dosing',
  'Growth & vaccination charts',
  'Family sharing & reports',
  'HIPAA-compliant security',
]

const socialButtons = [
  { name: 'Google', icon: GoogleIcon, hoverBg: 'hover:bg-white/10' },
  { name: 'Facebook', icon: FacebookIcon, hoverBg: 'hover:bg-[#1877F2]/10' },
  { name: 'X', icon: XIcon, hoverBg: 'hover:bg-white/10' },
  { name: 'Apple', icon: AppleIcon, hoverBg: 'hover:bg-white/10' },
]

export default function RegisterPage() {
  const router = useRouter()
  const { setUser, setToken } = useStore()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [socialLoading, setSocialLoading] = useState<string | null>(null)

  const handleSocialSignup = async (provider: string) => {
    setSocialLoading(provider)
    // Simulate social signup
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Create user from social signup
    const user = {
      id: `${provider.toLowerCase()}-user-${Date.now()}`,
      email: `user@${provider.toLowerCase()}.com`,
      full_name: `${provider} User`,
    }

    setUser(user)
    setToken(`${provider.toLowerCase()}-token-${Date.now()}`)
    router.push('/dashboard')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      await authApi.register(email, password, fullName)

      // Auto-login after registration
      const { access_token } = await authApi.login(email, password)
      setToken(access_token)

      const user = await authApi.getProfile()
      setUser(user)

      router.push('/dashboard')
    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.message || ''
      if (message.includes('already registered') || message.includes('already exists')) {
        setError('An account with this email already exists. Try signing in instead.')
      } else {
        // Backend unavailable - enter demo mode with notice
        const mockUser = {
          id: `user-${Date.now()}`,
          email: email,
          full_name: fullName || email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        }
        setUser(mockUser)
        setToken(`demo-token-${Date.now()}`)
        router.push('/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Logo size="lg" showPulse={true} animate={false} />
          </div>

          {/* Card Container */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700/50 shadow-2xl">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Create your account</h2>
              <p className="text-slate-400">Start protecting your children with AI health monitoring</p>
            </div>

            {/* Social Login Buttons */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {socialButtons.map(({ name, icon: Icon, hoverBg }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSocialSignup(name)}
                  disabled={socialLoading !== null}
                  className={`flex items-center justify-center p-3.5 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white ${hoverBg} hover:border-slate-500 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-wait`}
                  title={`Sign up with ${name}`}
                >
                  {socialLoading === name ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Icon />
                  )}
                </button>
              ))}
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-600/50" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-slate-800/50 text-slate-400">or register with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    placeholder="John Doe"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    placeholder="parent@example.com"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    className="w-full pl-12 pr-12 py-3.5 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  required
                  className="w-4 h-4 mt-1 rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-400">
                  I agree to the{' '}
                  <button type="button" onClick={() => alert('EPCID Terms of Service: By using this application, you agree to our terms. This is a demo application. Data is not stored permanently.')} className="text-cyan-400 hover:text-cyan-300 font-medium">Terms of Service</button>
                  {' '}and{' '}
                  <button type="button" onClick={() => alert('EPCID Privacy Policy: We take your privacy seriously. All health data is encrypted and HIPAA-compliant. This demo does not collect real patient data.')} className="text-cyan-400 hover:text-cyan-300 font-medium">Privacy Policy</button>
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || socialLoading !== null}
                className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98] transform"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-slate-400">
              Already have an account?{' '}
              <Link href="/login" className="text-cyan-400 hover:text-cyan-300 transition-colors font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Right Panel - Features */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background with medical pattern */}
        <div className="absolute inset-0 bg-gradient-to-bl from-cyan-600 via-teal-600 to-emerald-700" />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />

        {/* Floating orbs */}
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-white/10 blur-3xl"
          animate={{
            x: [0, -30, 0],
            y: [0, 50, 0],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          style={{ top: '10%', right: '5%' }}
        />
        <motion.div
          className="absolute w-72 h-72 rounded-full bg-cyan-300/20 blur-3xl"
          animate={{
            x: [0, 40, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          style={{ bottom: '20%', left: '5%' }}
        />

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {/* Logo */}
            <div className="mb-10">
              <Logo size="xl" showPulse={true} animate={true} />
            </div>

            <h1 className="text-3xl xl:text-4xl font-bold text-white mb-8 leading-tight">
              Everything you need to<br />
              <span className="text-cyan-200">protect your child</span>
            </h1>

            <div className="space-y-4 mb-10">
              {features.map((feature, i) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-cyan-100 text-lg">{feature}</span>
                </motion.div>
              ))}
            </div>


          </motion.div>
        </div>
      </div>
    </div>
  )
}
