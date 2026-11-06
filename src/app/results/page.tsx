'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import type { Spot } from '@/types'
import ThemeToggle from '@/components/ThemeToggle'
import ThemeLogo from '@/components/ThemeLogo'
import { isClub, programmationUrl } from '@/lib/clubs'

// ── Palette DA ────────────────────────────────────────────────
// Couleurs par rôle (palette de l'accueil) : suivent le thème clair / sombre (globals.css)
const INK = 'var(--c-ink)'             // textes, contours, boutons pleins
const CANVAS = 'var(--c-canvas)'       // fond de page
const SURFACE = 'var(--c-surface)'     // cartes, champs
const ACCENT = 'var(--c-accent)'       // « ouvert », état actif
const ON_ACCENT = 'var(--c-on-accent)' // texte sur l'accent
const ON_INK = 'var(--c-on-ink)'       // texte sur bouton plein
const LINE = `1.5px solid ${INK}`      // contour signature
const SOFT = 'var(--c-soft)'           // séparateurs discrets
const MUTED = 'var(--c-muted)'         // texte secondaire

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted text-sm font-body">Chargement de la carte…</p>
    </div>
  ),
})

// ── Favoris (localStorage) ────────────────────────────────────
const FAV_KEY = 'tonite_favs'

function loadFavs(): Spot[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') } catch { return [] }
}

function saveFavs(favs: Spot[]) {
  localStorage.setItem(FAV_KEY, JSON.stringify(favs))
}

function useFavorites() {
  const [favs, setFavs] = useState<Spot[]>([])
  useEffect(() => { setFavs(loadFavs()) }, [])

  function toggle(spot: Spot) {
    setFavs(prev => {
      const exists = prev.some(f => f.id === spot.id)
      const next = exists ? prev.filter(f => f.id !== spot.id) : [...prev, spot]
      saveFavs(next)
      return next
    })
  }

  function remove(id: string) {
    setFavs(prev => { const next = prev.filter(f => f.id !== id); saveFavs(next); return next })
  }

  function isFav(id: string) { return favs.some(f => f.id === id) }

  return { favs, toggle, remove, isFav }
}

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
    // « ce soir » pour une ouverture après minuit vue depuis la journée (clubs), rien si c'est plus tard aujourd'hui
    const tomorrow = nextDay === (day + 1) % 7
    const dayLabel = nextDay === day && openTime > time ? ''
      : tomorrow && openTime < 600 && time >= 600 ? 'ce soir '
      : tomorrow ? 'demain '
      : `${days[nextDay]} `
    const timeLabel = h === 0 && m === 0 ? 'minuit' : m === 0 ? `${h}h` : `${h}h${String(m).padStart(2,'0')}`
    return { label: `Fermé · Ouvre ${dayLabel}à ${timeLabel}`, open: false }
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
  const text = `${spot.nom} · ${spot.vibe || spot.type} · ${spot.arrondissement}e arr.`
  if (navigator.share) {
    await navigator.share({ title: spot.nom, text, url })
  } else {
    await navigator.clipboard.writeText(url)
  }
}

// Badge « type » réutilisable (rose plein, encre)
function typeBadgeStyle(): React.CSSProperties {
  return { background: CANVAS, color: INK, border: LINE }
}

// Statut d'ouverture : pastille jaune si ouvert, vert atténué sinon
function statusStyle(open: boolean): React.CSSProperties {
  return open
    ? { background: ACCENT, color: ON_ACCENT, border: LINE, borderRadius: 999, padding: '2px 10px', display: 'inline-block', alignSelf: 'flex-start' }
    : { color: MUTED }
}

// Lien vers la programmation d'un club (s'ouvre dans un nouvel onglet)
function ProgrammationButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="w-full py-3.5 rounded-full flex items-center justify-center gap-2 font-display font-semibold text-sm transition-all"
      style={{ background: 'transparent', color: INK, border: LINE }}
    >
      Voir la programmation ↗
    </a>
  )
}

// ── Bottom Sheet ──────────────────────────────────────────────
function SpotSheet({ spot, onClose }: { spot: SpotWithDist; onClose: () => void }) {
  const distance = spot._distance != null
    ? spot._distance < 1 ? `${Math.round(spot._distance * 1000)}m` : `${spot._distance.toFixed(1)}km`
    : null
  const status = openStatus(spot.horaires as Period[] | null)
  const [photoIdx, setPhotoIdx] = useState(0)
  // Photos qui ne chargent pas (liens expirés) : retirées du carrousel
  const [badPhotos, setBadPhotos] = useState<string[]>([])
  const sheetPhotos = (spot.photos && spot.photos.length > 0 ? spot.photos : spot.photo_url ? [spot.photo_url] : [])
    .filter((p) => !badPhotos.includes(p))

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        style={{ background: 'var(--c-scrim)', backdropFilter: 'blur(2px)', animation: 'fadeIn 200ms ease both' }}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto rounded-t-3xl overflow-hidden"
        style={{
          background: SURFACE,
          border: LINE,
          borderBottom: 'none',
          animation: 'slideUp 280ms cubic-bezier(0.32,0.72,0,1) both',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* Photo / Carousel */}
        {(() => {
          const photos = sheetPhotos
          if (photos.length === 0) return (
            <div className="relative h-16 flex items-end justify-end px-4 pb-3" style={{ background: CANVAS, borderBottom: LINE }}>
              <button onClick={onClose} className="text-sm font-body" style={{ color: INK }}>✕ Fermer</button>
            </div>
          )
          return (
            <div className="relative w-full h-52 overflow-hidden" style={{ background: CANVAS, borderBottom: LINE }}>
              <div
                className="flex h-full transition-transform duration-300 ease-out"
                style={{ width: `${photos.length * 100}%`, transform: `translateX(-${(photoIdx % photos.length) * (100 / photos.length)}%)` }}
              >
                {photos.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt="" className="h-full object-cover flex-shrink-0"
                    style={{ width: `${100 / photos.length}%` }}
                    onError={() => setBadPhotos((b) => b.includes(src) ? b : [...b, src])} />
                ))}
              </div>
              <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm"
                style={{ background: 'var(--c-chip-bg)', color: 'var(--c-chip-fg)' }}>✕</button>
              {photos.length > 1 && (
                <>
                  <button onClick={() => setPhotoIdx(i => (i - 1 + photos.length) % photos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-xs"
                    style={{ background: 'var(--c-chip-bg)', color: 'var(--c-chip-fg)' }}>‹</button>
                  <button onClick={() => setPhotoIdx(i => (i + 1) % photos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-xs"
                    style={{ background: 'var(--c-chip-bg)', color: 'var(--c-chip-fg)' }}>›</button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                    {photos.map((_, i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full transition-all"
                        style={{ background: i === photoIdx % photos.length ? '#fff' : 'rgba(255,255,255,0.5)' }} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        })()}

        {/* Contenu */}
        <div className="px-5 pt-4 flex flex-col gap-4">
          {/* Titre + badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold text-xl text-text leading-tight">{spot.nom}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-muted text-xs font-body">{spot.arrondissement}e arr.</span>
                {!isClub(spot) && (
                  <>
                    <span className="text-xs" style={{ color: SOFT }}>·</span>
                    <span className="text-muted text-xs font-body">{budgetLabel(spot.budget)}</span>
                  </>
                )}
                {distance && (
                  <>
                    <span className="text-xs" style={{ color: SOFT }}>·</span>
                    <span className="text-xs font-medium font-body" style={{ color: INK }}>{distance}</span>
                  </>
                )}
              </div>
            </div>
            <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium font-body" style={typeBadgeStyle()}>
              {spot.type}
            </span>
          </div>

          {/* Vibe */}
          {spot.vibe_enrichie && spot.vibe && (
            <p className="text-sm italic font-body leading-relaxed" style={{ color: MUTED }}>
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
              <p className="text-xs font-body font-medium" style={statusStyle(status.open)}>
                {status.label}
              </p>
            )}
          </div>

          {/* Tags */}
          {spot.tags && spot.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {spot.tags.map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-full text-[11px] font-body"
                  style={{ background: 'transparent', border: LINE, color: INK }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Programmation (clubs) */}
          {programmationUrl(spot) && (
            <ProgrammationButton href={programmationUrl(spot) as string} />
          )}

          {/* Boutons */}
          <div className="flex gap-3 mt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3.5 rounded-full font-display font-medium text-sm text-text whitespace-nowrap transition-all"
              style={{ background: SURFACE, border: LINE }}
            >
              Pas pour moi
            </button>
            <button
              onClick={() => shareSpot(spot)}
              className="py-3.5 px-4 rounded-full font-display font-medium text-sm text-text transition-all"
              style={{ background: SURFACE, border: LINE }}
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

// ── Panneau Favoris ───────────────────────────────────────────
function FavsPanel({ favs, onRemove, onClose }: { favs: Spot[]; onRemove: (id: string) => void; onClose: () => void }) {
  const [active, setActive] = useState(0)
  const [badPhotos, setBadPhotos] = useState<string[]>([])
  const spot = favs[active]
  const status = spot ? openStatus(spot.horaires as Period[] | null) : null

  // Si on retire le spot actif, recale l'index
  useEffect(() => {
    if (active >= favs.length) setActive(Math.max(0, favs.length - 1))
  }, [favs.length, active])

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} style={{ background: 'var(--c-scrim)', backdropFilter: 'blur(2px)' }} />
      <div
        className="fixed inset-0 z-50 flex flex-col max-w-lg mx-auto"
        style={{ background: CANVAS, animation: 'slideUp 280ms cubic-bezier(0.32,0.72,0,1) both' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-safe pb-3">
          <h2 className="font-display font-bold text-lg text-text">Mes spots</h2>
          <button onClick={onClose} className="h-10 px-4 text-sm font-body font-medium rounded-full" style={{ border: LINE, color: INK }}>
            Fermer
          </button>
        </div>

        {/* Onglets scrollables */}
        <div className="overflow-x-auto pb-1 px-5" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-2 w-max">
            {favs.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActive(i)}
                className="px-3 py-1.5 rounded-full text-xs font-body font-medium whitespace-nowrap transition-all shrink-0"
                style={i === active ? {
                  background: INK,
                  color: ON_INK,
                } : {
                  background: 'transparent',
                  border: LINE,
                  color: INK,
                }}
              >
                {s.nom.length > 18 ? s.nom.slice(0, 16) + '…' : s.nom}
              </button>
            ))}
          </div>
        </div>

        {/* Fiche du spot actif */}
        {spot && (
          <div className="flex-1 overflow-y-auto">
            {/* Photo */}
            {spot.photo_url && !badPhotos.includes(spot.photo_url) ? (
              <div className="relative w-full h-52 overflow-hidden mt-3" style={{ background: CANVAS, borderTop: LINE, borderBottom: LINE }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={spot.photo_url} alt="" className="w-full h-full object-cover"
                  onError={() => setBadPhotos((b) => [...b, spot.photo_url as string])} />
              </div>
            ) : (
              <div className="h-4" />
            )}

            <div className="px-5 pt-4 pb-10 flex flex-col gap-4">
              {/* Titre */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-xl text-text leading-tight">{spot.nom}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-muted text-xs font-body">{spot.arrondissement}e arr.</span>
                    {!isClub(spot) && (
                      <>
                        <span className="text-xs" style={{ color: SOFT }}>·</span>
                        <span className="text-muted text-xs font-body">{budgetLabel(spot.budget)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onRemove(spot.id)}
                    className="text-base leading-none transition-colors"
                    style={{ color: INK }}
                    title="Retirer des favoris"
                  >
                    ♥
                  </button>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium font-body" style={typeBadgeStyle()}>
                    {spot.type}
                  </span>
                </div>
              </div>

              {/* Vibe */}
              {spot.vibe && (
                <p className="text-sm italic font-body leading-relaxed" style={{ color: MUTED }}>&ldquo;{spot.vibe}&rdquo;</p>
              )}

              {/* Adresse + horaires */}
              <div className="flex flex-col gap-1.5 py-3 border-y" style={{ borderColor: INK }}>
                {spot.adresse && (
                  <p className="text-muted text-xs font-body flex items-center gap-1.5">
                    <span>📍</span> {spot.adresse}
                  </p>
                )}
                {status && (
                  <p className="text-xs font-body font-medium" style={statusStyle(status.open)}>
                    {status.label}
                  </p>
                )}
              </div>

              {/* Tags */}
              {spot.tags && spot.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {spot.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-full text-[11px] font-body"
                      style={{ background: 'transparent', border: LINE, color: INK }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Programmation (clubs) */}
              {programmationUrl(spot) && (
                <ProgrammationButton href={programmationUrl(spot) as string} />
              )}

              {/* CTA */}
              <a
                href={mapsUrl(spot)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-cta w-full py-4 rounded-full text-center font-display font-semibold text-sm mt-2"
              >
                Y aller →
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Carte (cliquable) ─────────────────────────────────────────
function SpotCard({ spot, index, onTap, isFav, onFavToggle }: {
  spot: SpotWithDist; index: number; onTap: () => void
  isFav: boolean; onFavToggle: (e: React.MouseEvent) => void
}) {
  const distance = spot._distance != null
    ? spot._distance < 1 ? `${Math.round(spot._distance * 1000)}m` : `${spot._distance.toFixed(1)}km`
    : null
  const vibeText = spot.vibe_enrichie && spot.vibe ? spot.vibe : null
  const status = openStatus(spot.horaires as Period[] | null)
  // Photo qui ne charge pas (lien expiré) → on retire le cadre, carte compacte
  const [photoOk, setPhotoOk] = useState(true)
  const showPhoto = !!spot.photo_url && photoOk

  return (
    <article
      onClick={onTap}
      className="glass p-5 flex flex-col gap-3 fade-up cursor-pointer active:scale-[0.98]"
      style={{ animationDelay: `${index * 80}ms`, transition: 'transform 150ms ease, box-shadow 200ms ease' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
    >
      {/* Photo miniature si disponible */}
      {showPhoto && (
        <div className="relative w-full h-32 rounded-xl overflow-hidden" style={{ background: CANVAS, border: LINE }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={spot.photo_url as string} alt="" className="w-full h-full object-cover"
            onError={() => setPhotoOk(false)} />
          <button
            onClick={onFavToggle}
            className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-base transition-all"
            style={{ background: INK, color: isFav ? ON_INK : SURFACE }}
          >
            {isFav ? '♥' : '♡'}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-lg text-text leading-tight truncate">{spot.nom}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-muted text-xs font-body">{spot.arrondissement}e arr.</span>
            {!isClub(spot) && (
              <>
                <span className="text-xs" style={{ color: SOFT }}>·</span>
                <span className="text-muted text-xs font-body">{budgetLabel(spot.budget)}</span>
              </>
            )}
            {distance && (
              <>
                <span className="text-xs" style={{ color: SOFT }}>·</span>
                <span className="text-xs font-medium font-body" style={{ color: INK }}>{distance}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!showPhoto && (
            <button
              onClick={onFavToggle}
              className="text-lg leading-none transition-colors"
              style={{ color: isFav ? INK : SOFT }}
            >
              {isFav ? '♥' : '♡'}
            </button>
          )}
          <span className="px-2.5 py-1 rounded-full text-xs font-medium font-body whitespace-nowrap" style={typeBadgeStyle()}>
            {spot.type}
          </span>
        </div>
      </div>

      {/* Vibe */}
      {vibeText && (
        <p className="text-sm italic font-body leading-relaxed line-clamp-2" style={{ color: MUTED }}>
          &ldquo;{vibeText}&rdquo;
        </p>
      )}

      {/* Tags */}
      {spot.tags && spot.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {spot.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="px-2.5 py-1 rounded-full text-[11px] font-body"
              style={{ background: 'transparent', border: LINE, color: INK }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Horaires + hint */}
      <div className="flex items-center justify-between mt-1">
        {status ? (
          <span className="text-[11px] font-body" style={statusStyle(status.open)}>
            {status.label}
          </span>
        ) : <span />}
        <p className="text-[11px] font-body" style={{ color: MUTED }}>Appuie pour + infos</p>
      </div>
    </article>
  )
}

function ToniteWordmark({ href }: { href: string }) {
  return <ThemeLogo variant="wordmark" href={href} style={{ height: 30, width: 'auto' }} />
}


// ── Page principale ───────────────────────────────────────────
function ResultsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const categorie = searchParams.get('categorie') || 'bar'
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const arr = searchParams.get('arr')
  const budget = searchParams.get('budget')
  const openAt = searchParams.get('openAt')
  const openAtDay = searchParams.get('openAtDay')
  const openAtHour = openAt ? Math.floor(parseInt(openAt) / 100) : null
  // Danser : « ouvert ce soir » au lieu d'une heure précise
  const soir = searchParams.get('soir') === 'true'

  const [spots, setSpots]           = useState<SpotWithDist[]>([])
  const [loading, setLoading]       = useState(true)
  const [excludeIds, setExcludeIds] = useState<string[]>([])
  const [error, setError]           = useState<string | null>(null)
  const [activeSpot, setActiveSpot] = useState<SpotWithDist | null>(null)
  // « ouvert » actif par défaut si un créneau a été choisi sur l'accueil
  const [openNow, setOpenNow]       = useState(searchParams.get('openNow') === 'true' || !!openAt || soir)
  const [showFavs, setShowFavs]     = useState(false)
  const [view, setView]             = useState<'list' | 'map'>('list')
  const [mapSpots, setMapSpots]     = useState<SpotWithDist[] | null>(null)
  const [mapLoading, setMapLoading] = useState(false)
  const { favs, toggle, remove, isFav } = useFavorites()

  const fetchMapSpots = useCallback(async (withOpenNow?: boolean) => {
    setMapLoading(true)
    try {
      const params = new URLSearchParams({ categorie, all: 'true' })
      if (lat && lng) { params.set('lat', lat); params.set('lng', lng) }
      if (arr) params.set('arr', arr)
      if (budget) params.set('budget', budget)
      if (withOpenNow) {
        if (soir) params.set('soir', 'true')
        else if (openAt && openAtDay != null) { params.set('openAt', openAt); params.set('openAtDay', openAtDay) }
        else params.set('openNow', 'true')
      }
      const res = await fetch(`/api/spots?${params}`)
      if (!res.ok) throw new Error()
      setMapSpots(await res.json())
    } catch {
      setMapSpots([])
    } finally {
      setMapLoading(false)
    }
  }, [categorie, lat, lng, arr, budget, openAt, openAtDay, soir])

  function switchView(v: 'list' | 'map') {
    setView(v)
    if (v === 'map' && mapSpots === null) fetchMapSpots(openNow)
  }

  const fetchSpots = useCallback(async (exclude: string[], withOpenNow?: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ categorie, exclude: exclude.join(',') })
      if (lat && lng) { params.set('lat', lat); params.set('lng', lng) }
      if (arr) params.set('arr', arr)
      if (budget) params.set('budget', budget)
      if (withOpenNow) {
        if (soir) params.set('soir', 'true')
        else if (openAt && openAtDay != null) { params.set('openAt', openAt); params.set('openAtDay', openAtDay) }
        else params.set('openNow', 'true')
      }
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
  }, [categorie, lat, lng, arr, budget, openAt, openAtDay, soir])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSpots([], openNow) }, [fetchSpots])

  const homeUrl = categorie === 'clubbing' ? '/?c=danser' : '/'

  const categorieLabel: Record<string, string> = {
    bar: 'Bar d\'ambiance',
    terrasse: 'En terrasse',
    bouffe: 'Bonne bouffe',
    clubbing: 'Clubbing',
  }

  return (
    <main className="min-h-screen bg-bg flex flex-col px-5 pt-safe pb-safe max-w-lg mx-auto">

      {/* Nav : vrai bouton (40 px) sous la zone de sécurité */}
      <div className="grid grid-cols-3 items-center mb-8 fade-in">
        <button onClick={() => router.push(homeUrl)}
          className="justify-self-start flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-body font-medium"
          style={{ border: LINE, color: INK }}>
          ← Retour
        </button>
        <div className="justify-self-center"><ToniteWordmark href={homeUrl} /></div>
        <div className="justify-self-end"><ThemeToggle /></div>
      </div>

      {/* Titre */}
      <header className="mb-5 fade-up">
        <p className="text-[10px] tracking-[0.2em] uppercase mb-2 font-body font-medium" style={{ color: INK, opacity: 0.6 }}>Notre sélection</p>
        <h1 className="font-display font-bold text-2xl text-text">
          {categorieLabel[categorie] || categorie}
        </h1>
        <p className="text-muted text-xs mt-1 font-body">
          {arr ? `${arr}e arrondissement` : (lat && lng ? 'Près de toi' : 'Paris')}
          {budget && categorie !== 'clubbing' && ` · ${budget.split(',').map((b) => '€'.repeat(Number(b))).join(' / ')}`}
        </p>
      </header>

      {/* Toggles : ouvert maintenant + Liste/Carte */}
      <div className="mb-5 fade-up flex items-center justify-between gap-3">
        <button
          onClick={() => {
            const next = !openNow
            setOpenNow(next)
            setExcludeIds([])
            fetchSpots([], next)
            setMapSpots(null)
            if (view === 'map') fetchMapSpots(next)
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-body font-medium transition-all"
          style={openNow ? {
            background: ACCENT,
            border: LINE,
            color: ON_ACCENT,
          } : {
            background: 'transparent',
            border: LINE,
            color: INK,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: openNow ? ON_ACCENT : 'transparent', border: `1.5px solid ${openNow ? ON_ACCENT : INK}`, display: 'inline-block', flexShrink: 0 }} />
          {soir ? 'Ouvert ce soir' : openAtHour != null ? `Ouvert vers ${openAtHour}h` : 'Ouvert maintenant'}
        </button>

        {/* Segmented control Liste / Carte */}
        <div className="flex rounded-full p-0.5 shrink-0" style={{ background: 'transparent', border: LINE }}>
          {(['list', 'map'] as const).map((v) => (
            <button
              key={v}
              onClick={() => switchView(v)}
              className="px-3.5 py-1.5 rounded-full text-xs font-body font-medium transition-all"
              style={view === v ? {
                background: INK,
                color: ON_INK,
              } : {
                background: 'transparent',
                color: INK,
              }}
            >
              {v === 'list' ? '☰ Liste' : '◍ Carte'}
            </button>
          ))}
        </div>
      </div>

      {/* ───────── Vue LISTE ───────── */}
      {view === 'list' && (
      <>
      {/* Skeletons */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[1,2,3].map((i) => (
            <div key={i} className="h-44 rounded-2xl animate-pulse"
              style={{ background: SURFACE, border: LINE, opacity: 0.6 }} />
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
          <button onClick={() => router.push(homeUrl)} className="text-sm font-body underline underline-offset-2 font-medium" style={{ color: INK }}>
            Changer les critères
          </button>
        </div>
      )}

      {!loading && !error && spots.length > 0 && (
        <div className="flex flex-col gap-4">
          {spots.map((spot, i) => (
            <SpotCard
              key={spot.id} spot={spot} index={i}
              onTap={() => setActiveSpot(spot)}
              isFav={isFav(spot.id)}
              onFavToggle={(e) => { e.stopPropagation(); toggle(spot) }}
            />
          ))}
          {openNow && spots.length === 0 && !loading && (
            <div className="text-center py-8">
              <p className="text-muted text-sm font-body">
                {soir ? 'Aucun spot ouvert ce soir.' : openAtHour != null ? `Aucun spot ouvert vers ${openAtHour}h.` : 'Aucun spot ouvert en ce moment.'}
              </p>
              <button onClick={() => { setOpenNow(false); fetchSpots([]) }} className="text-xs font-body underline mt-2 font-medium" style={{ color: INK }}>
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
            onClick={() => fetchSpots(excludeIds, openNow)}
            className="w-full py-3.5 rounded-full font-display font-medium text-sm text-text transition-all"
            style={{ background: SURFACE, border: LINE }}
          >
            Autre sélection ↻
          </button>
        </div>
      )}

      <p className="text-center text-muted text-xs mt-8 mb-2 font-body">
        Un spot qui manque ?{' '}
        <a href="/suggerer" className="underline underline-offset-2 hover:text-text transition-colors">Suggère-le</a>
      </p>
      </>
      )}

      {/* ───────── Vue CARTE ───────── */}
      {view === 'map' && (
        <div className="rounded-2xl overflow-hidden relative"
          style={{ height: 'calc(100vh - 230px)', minHeight: 360, border: LINE }}>
          {mapLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: SURFACE }}>
              <p className="text-muted text-sm font-body">Chargement des spots…</p>
            </div>
          )}
          {!mapLoading && mapSpots && mapSpots.length === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center text-center px-8" style={{ background: SURFACE }}>
              <p className="text-muted text-sm font-body">Aucun spot géolocalisé dans cette catégorie pour l&apos;instant.</p>
            </div>
          )}
          {mapSpots && mapSpots.length > 0 && (
            <MapView
              spots={mapSpots}
              selectedId={activeSpot?.id ?? null}
              onSelect={(s) => setActiveSpot(s)}
            />
          )}
        </div>
      )}

      {/* Bottom sheet */}
      {activeSpot && <SpotSheet spot={activeSpot} onClose={() => setActiveSpot(null)} />}

      {/* Bouton flottant favoris */}
      {favs.length > 0 && !activeSpot && !showFavs && (
        <button
          onClick={() => setShowFavs(true)}
          className="fixed bottom-safe left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-full font-display font-semibold text-sm z-30 transition-all"
          style={{
            background: INK,
            color: ON_INK,
          }}
        >
          ♥ Mes spots ({favs.length})
        </button>
      )}

      {/* Panneau favoris */}
      {showFavs && <FavsPanel favs={favs} onRemove={remove} onClose={() => setShowFavs(false)} />}

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
