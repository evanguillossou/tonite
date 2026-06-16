'use client'

import { useState } from 'react'
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
    <main className="relative min-h-screen bg-bg overflow-x-hidden">

      {/* Hero */}
      <div className="absolute inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=900&q=70&auto=format&fit=crop"
          alt=""
          className="w-full h-full object-cover object-center"
          style={{ opacity: 0.25, filter: 'brightness(0.5) saturate(0.8)' }}
        />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, rgba(10,10,10,0.4) 0%, rgba(10,10,10,0.75) 50%, #0A0A0A 85%)',
        }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen px-5 pt-10 pb-safe max-w-lg mx-auto">

        {/* Header éditorial */}
        <header className="fade-in mb-9">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Tonite" className="h-14 w-auto mb-6" />
          <h1 className="font-display font-bold leading-[1.1] text-text" style={{ fontSize: 'clamp(1.9rem, 7.5vw, 2.6rem)' }}>
            Les meilleurs spots{' '}
            <span style={{ color: '#F195B8' }}>autour de vous</span>
          </h1>
          <p className="text-muted text-sm mt-3 font-body leading-relaxed">
            Pas un annuaire. Une sélection de bars où l&apos;on a envie de boire un verre — près de vous, ouverts quand vous voulez.
          </p>
        </header>

        <div className="flex flex-col gap-8 flex-1">

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
                  border: geoStatus === 'ok' ? '1px solid #F5F5F5' : '1px solid #2A2A2A',
                  background: 'transparent',
                }}
              >
                <span className="text-sm shrink-0" style={{ color: '#555' }}>
                  {geoStatus === 'loading' ? '…' : geoStatus === 'ok' ? '↳' : '↝'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium" style={{ color: geoStatus === 'ok' ? '#F5F5F5' : '#888' }}>
                    {geoStatus === 'loading' && 'Localisation…'}
                    {geoStatus === 'ok' && `${arrondissement}e arrondissement`}
                    {geoStatus === 'idle' && 'Me géolocaliser'}
                    {(geoStatus === 'denied' || geoStatus === 'unavailable' || geoStatus === 'https_required') && 'Géolocalisation indisponible'}
                  </p>
                  {geoError && <p className="text-[11px] mt-0.5" style={{ color: '#F195B8' }}>{geoError}</p>}
                  {!geoError && geoStatus === 'ok' && <p className="text-[11px] mt-0.5 text-muted">Appuie pour modifier</p>}
                </div>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: '#1e1e1e' }} />
                <span className="text-muted text-xs font-body">ou</span>
                <div className="flex-1 h-px" style={{ background: '#1e1e1e' }} />
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
                  className="input-style pr-10 cursor-pointer"
                  style={arrondissement ? { borderColor: '#F5F5F5' } : {}}
                >
                  <option value="">Choisir un arrondissement</option>
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}e arrondissement</option>
                  ))}
                </select>
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none text-xs">▾</span>
              </div>
            </div>
          </section>

          {/* Budget */}
          <section className="fade-up delay-3">
            <Label>Budget <span style={{ color: '#444', letterSpacing: 0 }}>· optionnel</span></Label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((b) => {
                const sel = budgets.includes(b)
                return (
                  <button
                    key={b}
                    onClick={() => toggleBudget(b)}
                    className="py-3 rounded-xl text-center transition-all font-display font-semibold"
                    style={{
                      border: sel ? '1px solid #F195B8' : '1px solid #2A2A2A',
                      background: sel ? 'rgba(241,149,184,0.08)' : 'transparent',
                      color: sel ? '#F195B8' : '#888',
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
              background: '#F195B8',
              color: '#0A0A0A',
            } : {
              background: '#1a1a1a',
              color: '#444',
              cursor: 'not-allowed',
            }}
          >
            {loading ? 'Recherche…' : 'Voir les spots →'}
          </button>
          <p className="text-center text-muted text-xs mt-4 font-body">
            Pas de compte.{' '}
            <a href="/suggerer" className="underline underline-offset-2 hover:text-text transition-colors">
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
        border: selected ? '1px solid #F195B8' : '1px solid #2A2A2A',
        background: selected ? 'rgba(241,149,184,0.10)' : 'transparent',
        color: selected ? '#F195B8' : '#999',
      }}
    >
      {children}
    </button>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] tracking-[0.18em] uppercase mb-3 font-body font-medium" style={{ color: '#555' }}>
      {children}
    </p>
  )
}
