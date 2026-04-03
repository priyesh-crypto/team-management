"use client"

import { useState, use, useEffect, useRef } from 'react'
import { acceptInvitation } from '@/app/actions/actions'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2 } from "lucide-react"

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter()
  const resolvedParams = use(params)
  const token = resolvedParams.token
  
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    }
  }, [])

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      await acceptInvitation(token, name, password)
      setSuccess(true)
      redirectTimerRef.current = setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while accepting the invitation.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center py-12 px-6 lg:px-8 font-sans items-center">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 shadow-2xl rounded-2xl p-8">
        <div className="space-y-1 mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-white text-center">Accept Invitation</h2>
          <p className="text-neutral-400 text-center text-sm">
            Set up your profile to join your team
          </p>
        </div>
        
        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg p-4 flex items-start space-x-3">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium">Success</h3>
              <p className="text-sm opacity-90 mt-1">
                Account created successfully. Redirecting to login...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium">Error</h3>
                  <p className="text-sm opacity-90 mt-1">{error}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-neutral-200 block">Full Name</label>
              <input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                required
                className="w-full h-12 px-4 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-neutral-200 block">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Create a strong password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
                className="w-full h-12 px-4 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <button 
              type="submit" 
              className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? "Creating Account..." : "Join Team"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
