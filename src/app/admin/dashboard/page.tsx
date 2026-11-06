'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminGuard from '@/components/AdminGuard'
import AdminNav from '@/components/AdminNav'

// Mêmes catégories que l'API /api/spots (ce que l'utilisateur choisit sur l'accueil)
const TYPES_BY_CAT: Record<Cat, string[]> = {
  bar:      ['bar', 'bar à cocktails', 'bar à vin', 'bar à bière', 'rooftop'],
  clubbing: ['club'],
  terrasse: ['terrasse'],
  bouffe:   ['bistrot', 'restaurant', 'grec', 'asiatique', 'italien', 'tapas', 'bonne bouffe'],
}

type Cat = 'bar' | 'clubbing' | 'terrasse' | 'bouffe'
const CATS: Cat[] = ['bar', 'clubbing', 'terrasse', 'bouffe']

const CAT_LABELS: Record<Cat, string> = {
  bar: '🍸 Bar d\'ambiance',
  clubbing: '🎧 Clubbing',
  terrasse: '☀️ Terrasse',
  bouffe: '🍽️ Bonne bouffe',
}

const BUDGETS = [1, 2, 3] as const

type SpotLite = { arrondissement: number | null; type: string; budget: number | null }

type Stats = {
  total: number
  actifs: number
  sansVibe: number
  suggestions: number
}

function catOf(type: string): Cat | null {
  for (const c of CATS) if (TYPES_BY_CAT[c].includes(type)) return c
  return null
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [spots, setSpots] = useState<SpotLite[]>([])
  // Filtre prix du tableau par arrondissement : même logique que l'accueil (vide = tous)
  const [budgets, setBudgets] = useState<number[]>([])

  useEffect(() => {
    async function load() {
      const [totalRes, actifsRes, sansVibeRes, suggestionsRes, spotsActifsRes] = await Promise.all([
        supabase.from('spots').select('id', { count: 'exact', head: true }),
        supabase.from('spots').select('id', { count: 'exact', head: true }).eq('actif', true),
        supabase.from('spots').select('id', { count: 'exact', head: true }).eq('actif', true).eq('vibe_enrichie', false),
        supabase.from('suggestions_users').select('id', { count: 'exact', head: true }).eq('statut', 'en attente'),
        supabase.from('spots').select('arrondissement, type, budget').eq('actif', true).limit(5000),
      ])

      setSpots((spotsActifsRes.data || []) as SpotLite[])
      setStats({
        total: totalRes.count || 0,
        actifs: actifsRes.count || 0,
        sansVibe: sansVibeRes.count || 0,
        suggestions: suggestionsRes.count || 0,
      })
    }
    load()
  }, [])

  // Tout Paris : catégorie × budget
  const parBudget = useMemo(() => {
    const m: Record<Cat, Record<number, number>> = {
      bar: { 1: 0, 2: 0, 3: 0 }, clubbing: { 1: 0, 2: 0, 3: 0 },
      terrasse: { 1: 0, 2: 0, 3: 0 }, bouffe: { 1: 0, 2: 0, 3: 0 },
    }
    for (const s of spots) {
      const c = catOf(s.type)
      if (c && s.budget && m[c][s.budget] != null) m[c][s.budget]++
    }
    return m
  }, [spots])

  // Spots actifs qui n'apparaissent dans aucune catégorie (type « autre »…)
  const horsCategorie = useMemo(() => spots.filter(s => !catOf(s.type)).length, [spots])

  // Par arrondissement, filtré par budget
  const parArr = useMemo(() => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ arr: i + 1, bar: 0, clubbing: 0, terrasse: 0, bouffe: 0 }))
    for (const s of spots) {
      const a = s.arrondissement
      if (!a || a < 1 || a > 20) continue
      if (budgets.length > 0 && !budgets.includes(s.budget ?? 0)) continue
      const c = catOf(s.type)
      if (c) rows[a - 1][c]++
    }
    return rows
  }, [spots, budgets])

  function toggleBudget(b: number) {
    setBudgets(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b].sort())
  }

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

              {/* Tout Paris : catégorie × budget */}
              <h2 className="text-lg font-bold text-[#f5f5f0] mb-1">Actifs par budget · tout Paris</h2>
              <p className="text-[#6b6b6b] text-xs mb-4 leading-relaxed">
                Si une case est à 0, l&apos;utilisateur qui choisit cette catégorie et ce prix tombe sur « Aucun spot trouvé »,
                quel que soit son quartier (l&apos;appli élargit déjà la recherche à tout Paris).
              </p>
              <div className="overflow-x-auto rounded-2xl border border-[#1e1e1e] mb-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#141414] border-b border-[#1e1e1e]">
                      <th className="text-left px-4 py-3 text-[#555] font-medium">Catégorie</th>
                      {BUDGETS.map(b => (
                        <th key={b} className="text-center px-4 py-3 text-[#555] font-medium">{'€'.repeat(b)}</th>
                      ))}
                      <th className="text-center px-4 py-3 text-[#555] font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CATS.map(c => {
                      const row = parBudget[c]
                      const total = row[1] + row[2] + row[3]
                      return (
                        <tr key={c} className="border-b border-[#111]">
                          <td className="px-4 py-3 text-[#f5f5f0] font-semibold whitespace-nowrap">{CAT_LABELS[c]}</td>
                          {BUDGETS.map(b => <ParisCell key={b} value={row[b]} />)}
                          <td className="px-4 py-3 text-center text-[#888] font-semibold">{total}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Legend items={[
                ['#ff6b6b', '0 : écran « Aucun spot »'],
                ['#F195B8', 'moins de 10 : l\'utilisateur revoit vite les mêmes adresses'],
                ['#6fcf8a', '10 et plus'],
              ]} />
              {horsCategorie > 0 && (
                <p className="text-[#F195B8] text-xs mt-3">
                  {horsCategorie} spot{horsCategorie > 1 ? 's' : ''} actif{horsCategorie > 1 ? 's' : ''} avec un type hors catégorie
                  (ex. « autre ») : {horsCategorie > 1 ? 'ils n\'apparaissent' : 'il n\'apparaît'} jamais dans l&apos;appli.
                </p>
              )}

              {/* Tableau par arrondissement, filtrable par budget */}
              <div className="flex flex-wrap items-end justify-between gap-3 mt-10 mb-4">
                <h2 className="text-lg font-bold text-[#f5f5f0]">Actifs par arrondissement</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[#6b6b6b] text-xs mr-1">Prix</span>
                  <FilterChip active={budgets.length === 0} onClick={() => setBudgets([])}>Tous</FilterChip>
                  {BUDGETS.map(b => (
                    <FilterChip key={b} active={budgets.includes(b)} onClick={() => toggleBudget(b)}>
                      {'€'.repeat(b)}
                    </FilterChip>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-[#1e1e1e] mb-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#141414] border-b border-[#1e1e1e]">
                      <th className="text-left px-4 py-3 text-[#555] font-medium">Arr.</th>
                      {CATS.map(c => (
                        <th key={c} className="text-center px-4 py-3 text-[#555] font-medium whitespace-nowrap">{CAT_LABELS[c]}</th>
                      ))}
                      <th className="text-center px-4 py-3 text-[#555] font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parArr.map((row) => {
                      const total = row.bar + row.clubbing + row.terrasse + row.bouffe
                      return (
                        <tr key={row.arr} className="border-b border-[#111] hover:bg-[#111] transition-colors">
                          <td className="px-4 py-3 text-[#f5f5f0] font-semibold">{row.arr}e</td>
                          <Cell value={row.bar} />
                          <Cell value={row.clubbing} />
                          <Cell value={row.terrasse} />
                          <Cell value={row.bouffe} />
                          <td className="px-4 py-3 text-center text-[#888] font-semibold">{total || '·'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Legend items={[
                ['#333', '0'],
                ['#F195B8', '1 ou 2 (moins d\'une sélection de 3)'],
                ['#6fcf8a', '3 et plus'],
              ]} />
              <p className="text-[#6b6b6b] text-xs mt-2 leading-relaxed">
                Un arrondissement à 0 n&apos;affiche pas d&apos;écran vide : l&apos;appli complète avec les arrondissements voisins,
                mais les adresses proposées seront plus loin.
              </p>
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
      {value || '·'}
    </td>
  )
}

function ParisCell({ value }: { value: number }) {
  const color = value === 0 ? '#ff6b6b' : value < 10 ? '#F195B8' : '#6fcf8a'
  return (
    <td className="px-4 py-3 text-center font-semibold" style={{ color, background: value === 0 ? 'rgba(255,107,107,0.08)' : undefined }}>
      {value}
    </td>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
        active ? 'bg-[#f5f5f0] text-[#0a0a0a] border-[#f5f5f0]' : 'bg-transparent text-[#888] border-[#333] hover:border-[#555]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map(([color, label]) => (
        <span key={label} className="flex items-center gap-1.5 text-[11px] text-[#6b6b6b]">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
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
