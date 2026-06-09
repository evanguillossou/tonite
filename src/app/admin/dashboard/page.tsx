'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminGuard from '@/components/AdminGuard'
import AdminNav from '@/components/AdminNav'

type Stats = {
  total: number
  sansVibe: number
  inactifs: number
  suggestions: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    async function load() {
      const [spotsRes, sansVibeRes, inactifsRes, suggestionsRes] = await Promise.all([
        supabase.from('spots').select('id', { count: 'exact', head: true }),
        supabase.from('spots').select('id', { count: 'exact', head: true }).eq('vibe_enrichie', false),
        supabase.from('spots').select('id', { count: 'exact', head: true }).eq('actif', false),
        supabase.from('suggestions_users').select('id', { count: 'exact', head: true }).eq('statut', 'en attente'),
      ])

      setStats({
        total: spotsRes.count || 0,
        sansVibe: sansVibeRes.count || 0,
        inactifs: inactifsRes.count || 0,
        suggestions: suggestionsRes.count || 0,
      })
    }
    load()
  }, [])

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#0a0a0a]">
        <AdminNav />
        <div className="max-w-3xl mx-auto px-5 py-8">
          <h1 className="text-2xl font-bold text-[#f5f5f0] mb-8">Dashboard</h1>

          {!stats ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-[#141414] border border-[#222] rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Spots total" value={stats.total} />
              <StatCard label="Sans vibe" value={stats.sansVibe} highlight={stats.sansVibe > 0} />
              <StatCard label="Inactifs" value={stats.inactifs} />
              <StatCard label="Suggestions en attente" value={stats.suggestions} highlight={stats.suggestions > 0} />
            </div>
          )}
        </div>
      </div>
    </AdminGuard>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={[
      'p-5 rounded-2xl border',
      highlight ? 'border-[#8B5CF6] bg-[rgba(139,92,246,0.08)]' : 'border-[#222] bg-[#141414]',
    ].join(' ')}>
      <p className="text-[#6b6b6b] text-xs mb-2">{label}</p>
      <p className={['text-4xl font-bold', highlight ? 'text-[#8B5CF6]' : 'text-[#f5f5f0]'].join(' ')}>
        {value}
      </p>
    </div>
  )
}
