'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { arrondissementsByDistance } from '@/lib/geo'

type Energie = 1 | 2 | 3
type Budget = 1 | 2 | 3
type Compagnie = 'solo' | 'duo' | 'groupe'

const energieOptions = [
  { value: 1, label: 'Calme',  desc: 'Bonne conv.' },
  { value: 2, label: 'Animé',  desc: 'Musique, monde' },
  { value: 3, label: 'Festif', desc: 'Dancefloor' },
]

const budgetOptions = [
  { value: 1, label: '€',   desc: '–15€' },
  { value: 2, label: '€€',  desc: '15–30€' },
  { value: 3, label: '€€€', desc: '30€+' },
]

const compagnieOptions = [
  { value: 'solo',   label: 'Solo' },
  { value: 'duo',    label: 'Duo' },
  { value: 'groupe', label: 'Groupe' },
]

export default function HomePage() {
  const router = useRouter()
  const [energie, setEnergie] = useState<Energie | null>(null)
  const [budget, setBudget] = useState<Budget | null>(null)
  const [compagnie, setCompagnie] = useState<Compagnie | null>(null)

  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'ok' | 'denied' | 'unavailable' | 'https_required'>('idle')
  const [geoError, setGeoError] = useState<string | null>(null)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [arrondissement, setArrondissement] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const ready = energie && budget && compagnie && arrondissement

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
    const params = new URLSearchParams({
      energie: String(energie),
      budget: String(budget),
      compagnie: compagnie!,
    })
    if (geoStatus === 'ok' && userLat && userLng) {
      params.set('lat', String(userLat))
      params.set('lng', String(userLng))
    }
    if (arrondissement) params.set('arr', arrondissement)
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

        {/* Header */}
        <header className="fade-in mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Tonite" className="h-14 w-auto mb-6" />
          <h1 className="font-display font-bold leading-[1.1] text-text" style={{ fontSize: 'clamp(1.9rem, 7.5vw, 2.6rem)' }}>
            Trouve ton{' '}
            <span style={{ color: '#F195B8' }}>adresse parisienne</span>
            {' '}du soir
          </h1>
          <p className="text-muted text-sm mt-2 font-body">Des propositions en moins de 30 secondes</p>
        </header>

        <div className="flex flex-col gap-8 flex-1">

          {/* Localisation */}
          <section className="fade-up delay-1">
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

          {/* Énergie */}
          <section className="fade-up delay-2">
            <Label>Énergie</Label>
            <div className="grid grid-cols-3 gap-2">
              {energieOptions.map((opt) => {
                const sel = energie === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setEnergie(opt.value as Energie)}
                    className="flex flex-col items-center py-4 rounded-xl transition-all"
                    style={{
                      border: sel ? '1px solid #F195B8' : '1px solid #2A2A2A',
                      background: 'transparent',
                    }}
                  >
                    <span className="text-sm font-display font-semibold" style={{ color: sel ? '#F195B8' : '#555' }}>
                      {opt.label}
                    </span>
                    <span className="text-[11px] mt-1 font-body" style={{ color: sel ? '#999' : '#3a3a3a' }}>
                      {opt.desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Budget */}
          <section className="fade-up delay-3">
            <Label>Budget</Label>
            <div className="grid grid-cols-3 gap-2">
              {budgetOptions.map((opt) => {
                const sel = budget === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setBudget(opt.value as Budget)}
                    className="flex flex-col items-center py-4 rounded-xl transition-all"
                    style={{
                      border: sel ? '1px solid #F195B8' : '1px solid #2A2A2A',
                      background: 'transparent',
                    }}
                  >
                    <span className="font-display font-bold text-lg" style={{ color: sel ? '#F195B8' : '#555' }}>
                      {opt.label}
                    </span>
                    <span className="text-[11px] mt-1 font-body" style={{ color: sel ? '#999' : '#3a3a3a' }}>
                      {opt.desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Compagnie */}
          <section className="fade-up delay-4">
            <Label>Tu sors</Label>
            <div className="grid grid-cols-3 gap-2">
              {compagnieOptions.map((opt) => {
                const sel = compagnie === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setCompagnie(opt.value as Compagnie)}
                    className="flex flex-col items-center py-4 rounded-xl transition-all"
                    style={{
                      border: sel ? '1px solid #F195B8' : '1px solid #2A2A2A',
                      background: 'transparent',
                    }}
                  >
                    <span className="text-sm font-display font-semibold" style={{ color: sel ? '#F195B8' : '#555' }}>
                      {opt.label}
                    </span>
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
            {loading ? 'Recherche…' : 'Trouve mon spot →'}
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] tracking-[0.18em] uppercase mb-3 font-body font-medium" style={{ color: '#555' }}>
      {children}
    </p>
  )
}
