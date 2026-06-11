'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminGuard from '@/components/AdminGuard'
import AdminNav from '@/components/AdminNav'

const TYPES_BY_CAT = {
  bar:      ['bar', 'bar à cocktails', 'bar à vin', 'bar à bière', 'rooftop'],
  clubbing: ['club'],
  terrasse: ['terrasse'],
  bouffe:   ['bistrot', 'restaurant', 'grec', 'asiatique', 'italien', 'tapas', 'bonne bouffe'],
}

const CAT_LABELS: Record<string, string> = {
  bar: '🍸 Bar d\'ambiance',
  clubbing: '🎧 Clubbing',
  terrasse: '☀️ Terrasse',
  bouffe: '🍽️ Bonne bouffe',
}

type ArrStats = {
  arr: number
  bar: number
  clubbing: number
  terrasse: number
  bouffe: number
}

type Stats = {
  total: number
  actifs: number
  sansVibe: number
  suggestions: number
  parArr: ArrStats[]
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    async function load() {
      const [totalRes, actifsRes, sansVibeRes, suggestionsRes, spotsActifsRes] = await Promise.all([
        supabase.from('spots').select('id', { count: 'exact', head: true }),
        supabase.from('spots').select('id', { count: 'exact', head: true }).eq('actif', true),
        supabase.from('spots').select('id', { count: 'exact', head: true }).eq('actif', true).eq('vibe_enrichie', false),
        supabase.from('suggestions_users').select('id', { count: 'exact', head: true }).eq('statut', 'en attente'),
        supabase.from('spots').select('arrondissement, type').eq('actif', true),
      ])

      // Calcul par arrondissement et catégorie
      const spots = (spotsActifsRes.data || []) as { arrondissement: number; type: string }[]
      const arrMap: Record<number, ArrStats> = {}

      for (let i = 1; i <= 20; i++) {
        arrMap[i] = { arr: i, bar: 0, clubbing: 0, terrasse: 0, bouffe: 0 }
      }

      for (const spot of spots) {
        const a = spot.arrondissement
        if (!a || a < 1 || a > 20) continue
        for (const [cat, types] of Object.entries(TYPES_BY_CAT)) {
          if (types.includes(spot.type)) {
            (arrMap[a] as Record<string, number>)[cat]++
          }
        }
      }

      const parArr = Object.values(arrMap).sort((a, b) => a.arr - b.arr)

      setStats({
        total: totalRes.count || 0,
        actifs: actifsRes.count || 0,
        sansVibe: sansVibeRes.count || 0,
        suggestions: suggestionsRes.count || 0,
        parArr,
      })
    }
    load()
  }, [])

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#0a0a0a]">
        <AdminNav />
        <div className="max-w-4xl mx-auto px-5 py-8">
          <h1 className="text-2xl font-bold text-[#f5f5f0] mb-8">Dashboard</h1>

          {!stats ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-[#141414] border border-[#222] rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Chiffres globaux */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
                <StatCard label="Spots total" value={stats.total} />
                <StatCard label="Actifs" value={stats.actifs} />
                <StatCard label="Sans vibe (actifs)" value={stats.sansVibe} highlight={stats.sansVibe > 0} />
                <StatCard label="Suggestions en attente" value={stats.suggestions} highlight={stats.suggestions > 0} />
              </div>

              {/* Tableau par arrondissement */}
              <h2 className="text-lg font-bold text-[#f5f5f0] mb-4">Actifs par arrondissement</h2>
              <div className="overflow-x-auto rounded-2xl border border-[#1e1e1e]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#141414] border-b border-[#1e1e1e]">
                      <th className="text-left px-4 py-3 text-[#555] font-medium">Arr.</th>
                      {Object.entries(CAT_LABELS).map(([key, label]) => (
                        <th key={key} className="text-center px-4 py-3 text-[#555] font-medium whitespace-nowrap">{label}</th>
                      ))}
                      <th className="text-center px-4 py-3 text-[#555] font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.parArr.map((row) => {
                      const total = row.bar + row.clubbing + row.terrasse + row.bouffe
                      return (
                        <tr key={row.arr} className="border-b border-[#111] hover:bg-[#111] transition-colors">
                          <td className="px-4 py-3 text-[#f5f5f0] font-semibold">{row.arr}e</td>
                          <Cell value={row.bar} />
                          <Cell value={row.clubbing} />
                          <Cell value={row.terrasse} />
                          <Cell value={row.bouffe} />
                          <td className="px-4 py-3 text-center text-[#888] font-semibold">{total || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminGuard>
  )
}

function Cell({ value }: { value: number }) {
  const color = value === 0 ? '#333' : value < 3 ? '#F195B8' : '#6fcf8a'
  return (
    <td className="px-4 py-3 text-center font-semibold" style={{ color }}>
      {value || '—'}
    </td>
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
