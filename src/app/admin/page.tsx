'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/admin/dashboard')
      else setChecking(false)
    })
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Identifiants incorrects.')
      setLoading(false)
    } else {
      router.replace('/admin/dashboard')
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-[#6b6b6b] text-sm">Vérification…</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <p className="text-xs tracking-[0.3em] text-[#8B5CF6] uppercase mb-3 text-center">Tonite</p>
        <h1 className="text-2xl font-bold text-[#f5f5f0] text-center mb-8">Accès admin</h1>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full bg-[#141414] border border-[#222] rounded-xl px-4 py-3.5 text-[#f5f5f0] placeholder-[#444] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            required
            className="w-full bg-[#141414] border border-[#222] rounded-xl px-4 py-3.5 text-[#f5f5f0] placeholder-[#444] text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors"
          />
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="py-4 rounded-2xl bg-[#8B5CF6] text-white font-semibold text-sm hover:bg-[#7C3AED] transition-colors disabled:opacity-50"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </main>
  )
}
