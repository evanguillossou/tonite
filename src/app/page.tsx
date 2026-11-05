'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { arrondissementsByDistance } from '@/lib/geo'

// Créneaux horaires proposés (en plus de « Maintenant »).
const HEURES = [20, 21, 22, 23, 0, 1, 2]

// Résout un créneau (heure 0-23) en { jour, heure HHMM } pour la prochaine occurrence.
// Si l'heure est déjà passée aujourd'hui (ex. il est 23h et on choisit 1h), on bascule à demain.
function resolveHeure(hour: number): { day: number; time: number } {
  const now = new Date()
  const target = new Date()
  target.setHours(hour, 0, 0, 0)
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1)
  return { day: target.getDay(), time: hour * 100 }
}

const INK = 'var(--tn-ink)'
const PINK = 'var(--tn-pink)'
const CREAM = 'var(--tn-cream)'
const YELLOW = 'var(--tn-yellow)'

// Bandeau bêta : fermable, et ne revient plus une fois fermé (mémorisé dans le navigateur).
// Pour réafficher un nouveau message à tout le monde plus tard : changer la clé (v1 → v2).
const BANNER_KEY = 'tonite_banner_beta_v1'

function BetaBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(BANNER_KEY) !== '1') setShow(true)
    } catch {
      setShow(true) // stockage indisponible (navigation privée…) : on l'affiche quand même
    }
  }, [])

  function close() {
    setShow(false)
    try { localStorage.setItem(BANNER_KEY, '1') } catch { /* tant pis, il reviendra */ }
  }

  if (!show) return null

  return (
    <div
      role="status"
      className="fade-in mb-6 flex items-start gap-3 rounded-2xl pl-4 pr-2 py-3"
      style={{ background: CREAM, border: `1.5px solid ${INK}` }}
    >
      <span
        className="shrink-0 mt-px px-2 py-0.5 rounded-full text-[10px] font-body font-semibold tracking-[0.14em] uppercase"
        style={{ background: YELLOW, color: INK, border: `1.5px solid ${INK}` }}
      >
        Bêta
      </span>
      <p className="flex-1 text-xs font-body leading-relaxed" style={{ color: INK }}>
        De nouvelles adresses arrivent chaque semaine. Le meilleur est à venir&nbsp;!
      </p>
      <button
        onClick={close}
        aria-label="Fermer le message"
        className="shrink-0 -mt-1 w-8 h-8 rounded-full flex items-center justify-center text-xl leading-none"
        style={{ color: INK }}
      >
        ×
      </button>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()

  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'ok' | 'denied' | 'unavailable' | 'https_required'>('idle')
  const [geoError, setGeoError] = useState<string | null>(null)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [arrondissement, setArrondissement] = useState<string>('')

  // Quand : 'now' ou une heure (0-23)
  const [quand, setQuand] = useState<'now' | number>('now')
  // Budget : sous-ensemble de [1,2,3] ; vide = tous
  const [budgets, setBudgets] = useState<number[]>([])

  const [loading, setLoading] = useState(false)

  // Fond body rose sur l'accueil (restauré en quittant la page)
  useEffect(() => {
    const prev = document.body.style.background
    document.body.style.background = 'var(--tn-pink)'
    return () => { document.body.style.background = prev }
  }, [])

  const ready = !!arrondissement

  function toggleBudget(b: number) {
    setBudgets((prev) => prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b])
  }

  function requestGeo() {
    if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setGeoStatus('https_required')
      setGeoError('La géolocalisation nécessite HTTPS.')
      return
    }
    if (!navigator.geolocation) {
      setGeoStatus('unavailable')
      setGeoError('Géolocalisation non supportée. Choisis un arrondissement.')
      return
    }
    setGeoStatus('loading')
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const isParis = lat > 48.7 && lat < 49.0 && lng > 2.1 && lng < 2.6
        if (!isParis) {
          setGeoStatus('unavailable')
          setGeoError('Position hors de Paris. Choisis ton arrondissement.')
          return
        }
        setUserLat(lat)
        setUserLng(lng)
        const nearest = arrondissementsByDistance(lat, lng)[0]
        setArrondissement(String(nearest))
        setGeoStatus('ok')
        setGeoError(null)
      },
      (err) => {
        if (err.code === 1) {
          setGeoStatus('denied')
          setGeoError('Accès refusé. Choisis un arrondissement.')
        } else {
          setGeoStatus('unavailable')
          setGeoError('Position indisponible. Choisis un arrondissement.')
        }
      },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }

  function handleSubmit() {
    if (!ready) return
    setLoading(true)
    const params = new URLSearchParams({ categorie: 'bar' })
    if (geoStatus === 'ok' && userLat && userLng) {
      params.set('lat', String(userLat))
      params.set('lng', String(userLng))
    }
    if (arrondissement) params.set('arr', arrondissement)

    // Quand
    if (quand === 'now') {
      params.set('openNow', 'true')
    } else {
      const { day, time } = resolveHeure(quand)
      params.set('openAt', String(time))
      params.set('openAtDay', String(day))
    }

    // Budget
    if (budgets.length > 0) params.set('budget', [...budgets].sort().join(','))

    router.push(`/results?${params.toString()}`)
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden" style={{ background: PINK }}>
      <div className="relative z-10 flex flex-col min-h-screen px-5 pt-10 pb-safe max-w-lg mx-auto">

        <BetaBanner />

        {/* Hero */}
        <header className="fade-in mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_rose.png" alt="Tonite" className="mx-auto" style={{ width: 'min(58vw, 210px)', height: 'auto' }} />
          <h1 className="font-display font-bold" style={{ color: INK, fontSize: 'clamp(1.35rem, 5.2vw, 1.7rem)', lineHeight: 1.15, marginTop: '-0.4rem' }}>
            Les meilleurs spots autour de vous
          </h1>
          <p className="text-sm mt-2 font-body leading-relaxed" style={{ color: INK, opacity: 0.72 }}>
            Une sélection de bars où l&apos;on a envie de boire un verre — près de vous, ouverts quand vous voulez.
          </p>
        </header>

        <div className="flex flex-col gap-7 flex-1">

          {/* Quand */}
          <section className="fade-up delay-1">
            <Label>Quand tu veux boire un verre</Label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
              <Chip selected={quand === 'now'} onClick={() => setQuand('now')}>
                Maintenant
              </Chip>
              {HEURES.map((h) => (
                <Chip key={h} selected={quand === h} onClick={() => setQuand(h)}>
                  {h}h
                </Chip>
              ))}
            </div>
          </section>

          {/* Où */}
          <section className="fade-up delay-2">
            <Label>Où tu es</Label>
            <div className="flex flex-col gap-2">
              <button
                onClick={geoStatus === 'ok'
                  ? () => { setGeoStatus('idle'); setArrondissement(''); setUserLat(null); setUserLng(null) }
                  : requestGeo}
                disabled={geoStatus === 'loading'}
                className="flex items-center gap-3 w-full px-4 py-3 text-left rounded-xl transition-all"
                style={{
                  border: geoStatus === 'ok' ? `2px solid ${INK}` : `1.5px solid ${INK}`,
                  background: CREAM,
                }}
              >
                <span className="text-sm shrink-0" style={{ color: INK }}>
                  {geoStatus === 'loading' ? '…' : geoStatus === 'ok' ? '◉' : '↝'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium" style={{ color: INK }}>
                    {geoStatus === 'loading' && 'Localisation…'}
                    {geoStatus === 'ok' && `${arrondissement}e arrondissement`}
                    {geoStatus === 'idle' && 'Me géolocaliser'}
                    {(geoStatus === 'denied' || geoStatus === 'unavailable' || geoStatus === 'https_required') && 'Géolocalisation indisponible'}
                  </p>
                  {geoError && <p className="text-[11px] mt-0.5" style={{ color: '#A8325F' }}>{geoError}</p>}
                  {!geoError && geoStatus === 'ok' && <p className="text-[11px] mt-0.5" style={{ color: INK, opacity: 0.6 }}>Appuie pour modifier</p>}
                </div>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'rgba(26,44,42,0.22)' }} />
                <span className="text-xs font-body" style={{ color: INK, opacity: 0.55 }}>ou</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(26,44,42,0.22)' }} />
              </div>

              <div className="relative">
                <select
                  value={arrondissement}
                  onChange={(e) => {
                    setArrondissement(e.target.value)
                    if (e.target.value && geoStatus === 'ok') {
                      setGeoStatus('idle'); setUserLat(null); setUserLng(null)
                    }
                  }}
                  className="w-full font-body cursor-pointer rounded-xl"
                  style={{
                    background: CREAM,
                    color: INK,
                    border: arrondissement ? `2px solid ${INK}` : `1.5px solid ${INK}`,
                    padding: '12px 40px 12px 14px',
                    fontSize: 14,
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  }}
                >
                  <option value="">Choisir un arrondissement</option>
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}e arrondissement</option>
                  ))}
                </select>
                <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs" style={{ color: INK }}>▾</span>
              </div>
            </div>
          </section>

          {/* Budget */}
          <section className="fade-up delay-3">
            <Label>Budget <span style={{ opacity: 0.5, letterSpacing: 0 }}>· optionnel</span></Label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((b) => {
                const sel = budgets.includes(b)
                return (
                  <button
                    key={b}
                    onClick={() => toggleBudget(b)}
                    className="py-3 rounded-xl text-center transition-all font-display font-semibold"
                    style={{
                      border: `1.5px solid ${INK}`,
                      background: sel ? YELLOW : CREAM,
                      color: INK,
                    }}
                  >
                    {'€'.repeat(b)}
                  </button>
                )
              })}
            </div>
          </section>

        </div>

        {/* CTA */}
        <div className="mt-8 mb-2">
          <button
            onClick={handleSubmit}
            disabled={!ready || loading}
            className="w-full py-4 rounded-full text-base font-display font-semibold tracking-wide transition-all"
            style={ready && !loading ? {
              background: INK,
              color: PINK,
            } : {
              background: CREAM,
              color: 'rgba(26,44,42,0.4)',
              border: '1.5px solid rgba(26,44,42,0.2)',
              cursor: 'not-allowed',
            }}
          >
            {loading ? 'Recherche…' : 'Voir les spots →'}
          </button>
          <p className="text-center text-xs mt-4 font-body" style={{ color: INK, opacity: 0.72 }}>
            Pas de compte.{' '}
            <a href="/suggerer" className="underline underline-offset-2 font-medium" style={{ color: INK }}>
              Suggérer un lieu
            </a>
          </p>
        </div>

      </div>
    </main>
  )
}

function Chip({ children, selected, onClick }: { children: React.ReactNode; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 px-4 py-2.5 rounded-full text-sm font-body font-medium transition-all"
      style={{
        border: `1.5px solid ${INK}`,
        background: selected ? INK : 'transparent',
        color: selected ? PINK : INK,
      }}
    >
      {children}
    </button>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] tracking-[0.2em] uppercase mb-3 font-body font-medium" style={{ color: INK, opacity: 0.6 }}>
      {children}
    </p>
  )
}
