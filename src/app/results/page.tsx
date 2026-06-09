'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import type { Spot } from '@/types'

function budgetLabel(b: number) { return '€'.repeat(b) }

// Période Google Places : { open: { day, time }, close: { day, time } }
// day = 0 (dim) → 6 (sam), time = "HHMM"
type Period = { open: { day: number; time: string }; close?: { day: number; time: string } }

function openStatus(periods: Period[] | null): { label: string; open: boolean } | null {
  if (!periods || periods.length === 0) return null

  const now = new Date()
  const day = now.getDay() // 0=dim, 1=lun...
  const time = now.getHours() * 100 + now.getMinutes() // ex: 2130

  // Ouvert 24/7
  if (periods.length === 1 && !periods[0].close) {
    return { label: 'Ouvert 24h/24', open: true }
  }

  // Cherche si on est actuellement dans une période d'ouverture
  for (const p of periods) {
    if (!p.close) continue
    const openDay  = p.open.day
    const closeDay = p.close.day
    const openTime  = parseInt(p.open.time)
    const closeTime = parseInt(p.close.time)

    let isOpen = false
    if (openDay === closeDay) {
      isOpen = day === openDay && time >= openTime && time < closeTime
    } else if (closeDay === (openDay + 1) % 7) {
      // Ferme le lendemain (ex: ouvert lun 20h → mar 2h)
      isOpen = (day === openDay && time >= openTime) || (day === closeDay && time < closeTime)
    }

    if (isOpen) {
      const h = Math.floor(closeTime / 100)
      const m = closeTime % 100
      const label = m === 0 ? `Ouvert · Ferme à ${h}h` : `Ouvert · Ferme à ${h}h${String(m).padStart(2,'0')}`
      return { label, open: true }
    }
  }

  // Fermé — cherche la prochaine ouverture
  let nextPeriod: Period | null = null
  let minDiff = Infinity
  for (const p of periods) {
    const openDay  = p.open.day
    const openTime = parseInt(p.open.time)
    let diff = (openDay - day + 7) % 7
    if (diff === 0 && openTime <= time) diff = 7
    const totalMin = diff * 1440 + Math.floor(openTime / 100) * 60 + (openTime % 100)
    if (totalMin < minDiff) { minDiff = totalMin; nextPeriod = p }
  }

  if (nextPeriod) {
    const openTime = parseInt(nextPeriod.open.time)
    const h = Math.floor(openTime / 100)
    const m = openTime % 100
    const days = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
    const nextDay = nextPeriod.open.day
    const dayLabel = nextDay === (day + 1) % 7 ? 'demain' : days[nextDay]
    const timeLabel = m === 0 ? `${h}h` : `${h}h${String(m).padStart(2,'0')}`
    return { label: `Fermé · Ouvre ${dayLabel} à ${timeLabel}`, open: false }
  }

  return { label: 'Fermé', open: false }
}

function mapsUrl(spot: Spot) {
  // place_id → ouvre directement la fiche du lieu dans Maps (app native sur mobile)
  if (spot.place_id_google) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.nom)}&query_place_id=${spot.place_id_google}`
  }
  // fallback : coordonnées GPS
  if (spot.coordonnees_lat && spot.coordonnees_lng) {
    return `https://www.google.com/maps/search/?api=1&query=${spot.coordonnees_lat},${spot.coordonnees_lng}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.nom + ' Paris')}`
}

type SpotWithDist = Spot & { _distance?: number }

async function shareSpot(spot: Spot) {
  const url = `${window.location.origin}/spot/${spot.id}`
  const text = `${spot.nom} — ${spot.vibe || spot.type}, ${spot.arrondissement}e arr.`
  if (navigator.share) {
    await navigator.share({ title: spot.nom, text, url })
  } else {
    await navigator.clipboard.writeText(url)
  }
}

// ── Bottom Sheet ──────────────────────────────────────────────
function SpotSheet({ spot, onClose }: { spot: SpotWithDist; onClose: () => void }) {
  const distance = spot._distance != null
    ? spot._distance < 1 ? `${Math.round(spot._distance * 1000)}m` : `${spot._distance.toFixed(1)}km`
    : null
  const status = openStatus(spot.horaires as Period[] | null)

  // Ferme sur tap overlay
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: 'fadeIn 200ms ease both' }}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto rounded-t-3xl overflow-hidden"
        style={{
          background: '#141414',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          animation: 'slideUp 280ms cubic-bezier(0.32,0.72,0,1) both',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* Photo */}
        {spot.photo_url ? (
          <div className="relative w-full h-52 overflow-hidden bg-[#111]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={spot.photo_url}
              alt={spot.nom}
              className="w-full h-full object-cover"
              style={{ filter: 'brightness(0.85)' }}
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, #141414 100%)' }} />
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="relative h-16 flex items-end justify-end px-4 pb-3"
            style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.15), rgba(233,30,140,0.1))' }}>
            <button onClick={onClose} className="text-muted text-sm font-body">✕ Fermer</button>
          </div>
        )}

        {/* Contenu */}
        <div className="px-5 pt-4 flex flex-col gap-4">
          {/* Titre + badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold text-xl text-text leading-tight">{spot.nom}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-muted text-xs font-body">{spot.arrondissement}e arr.</span>
                <span className="text-[#333] text-xs">·</span>
                <span className="text-muted text-xs font-body">{budgetLabel(spot.budget)}</span>
                {distance && (
                  <>
                    <span className="text-[#333] text-xs">·</span>
                    <span className="text-xs font-medium font-body"
                      style={{ background: 'linear-gradient(90deg,#F195B8,#D4649A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                      {distance}
                    </span>
                  </>
                )}
              </div>
            </div>
            <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium font-body text-white"
              style={{ background: 'linear-gradient(135deg,#F195B8,#D4649A)' }}>
              {spot.type}
            </span>
          </div>

          {/* Vibe */}
          {spot.vibe_enrichie && spot.vibe && (
            <p className="text-[#aaa] text-sm italic font-body leading-relaxed">
              &ldquo;{spot.vibe}&rdquo;
            </p>
          )}

          {/* Adresse + horaires */}
          <div className="flex flex-col gap-1.5">
            {spot.adresse && (
              <p className="text-muted text-xs font-body flex items-center gap-1.5">
                <span>📍</span> {spot.adresse}
              </p>
            )}
            {status && (
              <p className="text-xs font-body font-medium" style={{ color: status.open ? '#6fcf8a' : '#888' }}>
                {status.label}
              </p>
            )}
          </div>

          {/* Tags */}
          {spot.tags && spot.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {spot.tags.map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-full text-[11px] font-body"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Boutons */}
          <div className="flex gap-3 mt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 rounded-full font-display font-medium text-sm text-text transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Pas pour moi
            </button>
            <button
              onClick={() => shareSpot(spot)}
              className="py-3.5 px-4 rounded-full font-display font-medium text-sm text-text transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              title="Partager"
            >
              ↗
            </button>
            <a
              href={mapsUrl(spot)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-cta flex-[2] py-3.5 rounded-full flex items-center justify-center font-display font-semibold text-sm"
            >
              Y aller →
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </>
  )
}

// ── Carte (cliquable) ─────────────────────────────────────────
function SpotCard({ spot, index, onTap }: { spot: SpotWithDist; index: number; onTap: () => void }) {
  const distance = spot._distance != null
    ? spot._distance < 1 ? `${Math.round(spot._distance * 1000)}m` : `${spot._distance.toFixed(1)}km`
    : null
  const vibeText = spot.vibe_enrichie && spot.vibe ? spot.vibe : null
  const status = openStatus(spot.horaires as Period[] | null)

  return (
    <article
      onClick={onTap}
      className="glass p-5 flex flex-col gap-3 fade-up cursor-pointer active:scale-[0.98]"
      style={{ animationDelay: `${index * 80}ms`, transition: 'transform 150ms ease, box-shadow 200ms ease' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.4)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
    >
      {/* Photo miniature si disponible */}
      {spot.photo_url && (
        <div className="w-full h-32 rounded-xl overflow-hidden -mx-0 bg-[#111]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={spot.photo_url} alt={spot.nom} className="w-full h-full object-cover"
            style={{ filter: 'brightness(0.8) saturate(1.2)' }} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-lg text-text leading-tight truncate">{spot.nom}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-muted text-xs font-body">{spot.arrondissement}e arr.</span>
            <span className="text-[#333] text-xs">·</span>
            <span className="text-muted text-xs font-body">{budgetLabel(spot.budget)}</span>
            {distance && (
              <>
                <span className="text-[#333] text-xs">·</span>
                <span className="text-xs font-medium font-body"
                  style={{ background: 'linear-gradient(90deg,#F195B8,#D4649A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  {distance}
                </span>
              </>
            )}
          </div>
        </div>
        <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium font-body text-white whitespace-nowrap"
          style={{ background: 'linear-gradient(135deg,#F195B8,#D4649A)' }}>
          {spot.type}
        </span>
      </div>

      {/* Vibe */}
      {vibeText && (
        <p className="text-[#999] text-sm italic font-body leading-relaxed line-clamp-2">
          &ldquo;{vibeText}&rdquo;
        </p>
      )}

      {/* Tags */}
      {spot.tags && spot.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {spot.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="px-2.5 py-1 rounded-full text-[11px] font-body"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Horaires + hint */}
      <div className="flex items-center justify-between mt-1">
        {status ? (
          <span className="text-[11px] font-body" style={{ color: status.open ? '#6fcf8a' : '#888' }}>
            {status.label}
          </span>
        ) : <span />}
        <p className="text-[#444] text-[11px] font-body">Appuie pour + infos</p>
      </div>
    </article>
  )
}

function ToniteWordmark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="Tonite" className="h-12 w-auto" />
  )
}

// ── Page principale ───────────────────────────────────────────
function ResultsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const energie   = Number(searchParams.get('energie')) as 1 | 2 | 3
  const budget    = Number(searchParams.get('budget'))  as 1 | 2 | 3
  const compagnie = searchParams.get('compagnie') || 'solo'
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const arr = searchParams.get('arr')

  const [spots, setSpots]           = useState<SpotWithDist[]>([])
  const [loading, setLoading]       = useState(true)
  const [excludeIds, setExcludeIds] = useState<string[]>([])
  const [error, setError]           = useState<string | null>(null)
  const [activeSpot, setActiveSpot] = useState<SpotWithDist | null>(null)
  const [openNow, setOpenNow]       = useState(false)

  const fetchSpots = useCallback(async (exclude: string[]) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ energie: String(energie), budget: String(budget), exclude: exclude.join(',') })
      if (lat && lng) { params.set('lat', lat); params.set('lng', lng) }
      if (arr) params.set('arr', arr)
      const res = await fetch(`/api/spots?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSpots(data)
      setExcludeIds((prev) => [...prev, ...data.map((s: Spot) => s.id)])
    } catch {
      setError("Impossible de charger les spots pour l'instant.")
    } finally {
      setLoading(false)
    }
  }, [energie, budget, lat, lng, arr])

  useEffect(() => { fetchSpots([]) }, [fetchSpots])

  const energieLabel = ['', 'Calme', 'Animé', 'Festif'][energie]

  return (
    <main className="min-h-screen bg-bg flex flex-col px-5 pt-8 pb-safe max-w-lg mx-auto">

      {/* Nav */}
      <div className="flex items-center justify-between mb-8 fade-in">
        <button onClick={() => router.push('/')}
          className="flex items-center gap-2 text-muted text-sm font-body hover:text-text transition-colors">
          ← Mood
        </button>
        <ToniteWordmark />
        <div className="w-16" />
      </div>

      {/* Titre */}
      <header className="mb-5 fade-up">
        <p className="text-[11px] tracking-[0.2em] text-muted uppercase mb-2 font-body">Ce soir pour toi</p>
        <h1 className="font-display font-bold text-2xl text-text">
          {energieLabel} · {budgetLabel(budget)} · {compagnie}
        </h1>
        {arr  && <p className="text-muted text-xs mt-1 font-body">{arr}e arrondissement</p>}
        {!arr && lat && lng && <p className="text-muted text-xs mt-1 font-body">Près de toi</p>}
      </header>

      {/* Toggle ouvert maintenant */}
      <div className="mb-5 fade-up">
        <button
          onClick={() => setOpenNow(o => !o)}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-body font-medium transition-all"
          style={openNow ? {
            background: 'rgba(111,207,138,0.15)',
            border: '1px solid #6fcf8a',
            color: '#6fcf8a',
          } : {
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#666',
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: openNow ? '#6fcf8a' : '#444', display: 'inline-block', flexShrink: 0 }} />
          Ouvert maintenant
        </button>
      </div>

      {/* Skeletons */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[1,2,3].map((i) => (
            <div key={i} className="h-44 rounded-2xl animate-pulse"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-16">
          <p className="text-muted text-sm font-body mb-6">{error}</p>
          <button onClick={() => fetchSpots([])} className="btn-cta px-8 py-3 text-sm font-display font-semibold">Réessayer</button>
        </div>
      )}

      {!loading && !error && spots.length === 0 && (
        <div className="text-center py-16">
          <p className="text-text font-display font-semibold text-lg mb-2">Aucun spot trouvé</p>
          <p className="text-muted text-sm font-body mb-8">On enrichit notre base chaque semaine.</p>
          <button onClick={() => router.push('/')} className="text-sm font-body underline underline-offset-2" style={{ color: '#F195B8' }}>
            Changer les critères
          </button>
        </div>
      )}

      {!loading && !error && spots.length > 0 && (
        <div className="flex flex-col gap-4">
          {spots
            .filter(s => !openNow || openStatus(s.horaires as Period[] | null)?.open)
            .map((spot, i) => (
              <SpotCard key={spot.id} spot={spot} index={i} onTap={() => setActiveSpot(spot)} />
            ))}
          {openNow && spots.filter(s => !openStatus(s.horaires as Period[] | null)?.open).length === spots.length && (
            <div className="text-center py-8">
              <p className="text-muted text-sm font-body">Aucun spot ouvert en ce moment dans cette sélection.</p>
              <button onClick={() => setOpenNow(false)} className="text-xs font-body underline mt-2" style={{ color: '#F195B8' }}>
                Voir tous les spots
              </button>
            </div>
          )}
        </div>
      )}

      {/* Autre sélection */}
      {!loading && spots.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => fetchSpots(excludeIds)}
            className="w-full py-3.5 rounded-full font-display font-medium text-sm text-text transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,107,53,0.4)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
          >
            Autre sélection ↻
          </button>
        </div>
      )}

      <p className="text-center text-muted text-xs mt-8 mb-2 font-body">
        Un spot qui manque ?{' '}
        <a href="/suggerer" className="underline underline-offset-2 hover:text-text transition-colors">Suggère-le</a>
      </p>

      {/* Bottom sheet */}
      {activeSpot && <SpotSheet spot={activeSpot} onClose={() => setActiveSpot(null)} />}
    </main>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-muted text-sm font-body">Chargement…</p>
      </div>
    }>
      <ResultsContent />
    </Suspense>
  )
}
