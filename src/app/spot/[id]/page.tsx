'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Spot } from '@/types'

function budgetLabel(b: number) { return '€'.repeat(b) }

type Period = { open: { day: number; time: string }; close?: { day: number; time: string } }

function openStatus(periods: Period[] | null): { label: string; open: boolean } | null {
  if (!periods || periods.length === 0) return null
  const now = new Date()
  const day = now.getDay()
  const time = now.getHours() * 100 + now.getMinutes()
  if (periods.length === 1 && !periods[0].close) return { label: 'Ouvert 24h/24', open: true }
  for (const p of periods) {
    if (!p.close) continue
    const openDay = p.open.day, closeDay = p.close.day
    const openTime = parseInt(p.open.time), closeTime = parseInt(p.close.time)
    let isOpen = false
    if (openDay === closeDay) {
      isOpen = day === openDay && time >= openTime && time < closeTime
    } else if (closeDay === (openDay + 1) % 7) {
      isOpen = (day === openDay && time >= openTime) || (day === closeDay && time < closeTime)
    }
    if (isOpen) {
      const h = Math.floor(closeTime / 100), m = closeTime % 100
      return { label: m === 0 ? `Ouvert · Ferme à ${h}h` : `Ouvert · Ferme à ${h}h${String(m).padStart(2,'0')}`, open: true }
    }
  }
  let nextPeriod: Period | null = null, minDiff = Infinity
  for (const p of periods) {
    const openDay = p.open.day, openTime = parseInt(p.open.time)
    let diff = (openDay - day + 7) % 7
    if (diff === 0 && openTime <= time) diff = 7
    const totalMin = diff * 1440 + Math.floor(openTime / 100) * 60 + (openTime % 100)
    if (totalMin < minDiff) { minDiff = totalMin; nextPeriod = p }
  }
  if (nextPeriod) {
    const openTime = parseInt(nextPeriod.open.time)
    const h = Math.floor(openTime / 100), m = openTime % 100
    const days = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
    const nextDay = nextPeriod.open.day
    const dayLabel = nextDay === (day + 1) % 7 ? 'demain' : days[nextDay]
    const timeLabel = m === 0 ? `${h}h` : `${h}h${String(m).padStart(2,'0')}`
    return { label: `Fermé · Ouvre ${dayLabel} à ${timeLabel}`, open: false }
  }
  return { label: 'Fermé', open: false }
}

function mapsUrl(spot: Spot) {
  if (spot.place_id_google)
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.nom)}&query_place_id=${spot.place_id_google}`
  if (spot.coordonnees_lat && spot.coordonnees_lng)
    return `https://www.google.com/maps/search/?api=1&query=${spot.coordonnees_lat},${spot.coordonnees_lng}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.nom + ' Paris')}`
}

async function shareSpot(spot: Spot) {
  const url = `${window.location.origin}/spot/${spot.id}`
  const text = `${spot.nom} — ${spot.vibe || spot.type}, ${spot.arrondissement}e arr.`
  if (navigator.share) {
    await navigator.share({ title: spot.nom, text, url })
  } else {
    await navigator.clipboard.writeText(url)
    alert('Lien copié !')
  }
}

export default function SpotPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [spot, setSpot] = useState<Spot | null>(null)
  const [loading, setLoading] = useState(true)
  const [shared, setShared] = useState(false)

  useEffect(() => {
    supabase.from('spots').select('*').eq('id', id).single().then(({ data }) => {
      setSpot(data as Spot)
      setLoading(false)
    })
  }, [id])

  async function handleShare() {
    if (!spot) return
    const url = `${window.location.origin}/spot/${spot.id}`
    const text = `${spot.nom} — ${spot.vibe || spot.type}, ${spot.arrondissement}e arr.`
    if (navigator.share) {
      await navigator.share({ title: spot.nom, text, url })
    } else {
      await navigator.clipboard.writeText(url)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <p className="text-muted text-sm font-body">Chargement…</p>
    </div>
  )

  if (!spot) return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-5">
      <p className="text-text font-display font-bold text-lg">Spot introuvable</p>
      <button onClick={() => router.push('/')} className="text-sm font-body underline" style={{ color: '#F195B8' }}>
        Retour à l&apos;accueil
      </button>
    </div>
  )

  const status = openStatus(spot.horaires as Period[] | null)

  return (
    <main className="min-h-screen bg-bg flex flex-col max-w-lg mx-auto">

      {/* Photo hero */}
      {spot.photo_url ? (
        <div className="relative w-full h-64 overflow-hidden bg-[#111]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={spot.photo_url} alt={spot.nom} className="w-full h-full object-cover" style={{ filter: 'brightness(0.8)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0.2) 0%, #0A0A0A 100%)' }} />
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 flex items-center gap-1.5 text-sm font-body text-white px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          >
            ← Retour
          </button>
        </div>
      ) : (
        <div className="px-5 pt-10 pb-2">
          <button onClick={() => router.back()} className="text-muted text-sm font-body">← Retour</button>
        </div>
      )}

      {/* Contenu */}
      <div className="px-5 pt-5 pb-10 flex flex-col gap-5 flex-1">

        {/* Logo */}
        <div className="flex justify-center mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Tonite" className="h-8 w-auto opacity-60" />
        </div>

        {/* Titre */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-2xl text-text leading-tight">{spot.nom}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-muted text-xs font-body">{spot.arrondissement}e arrondissement</span>
              <span className="text-[#333] text-xs">·</span>
              <span className="text-muted text-xs font-body">{budgetLabel(spot.budget)}</span>
            </div>
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium font-body text-white"
            style={{ background: 'linear-gradient(135deg,#F195B8,#D4649A)' }}>
            {spot.type}
          </span>
        </div>

        {/* Vibe */}
        {spot.vibe && (
          <p className="text-[#aaa] text-base italic font-body leading-relaxed">
            &ldquo;{spot.vibe}&rdquo;
          </p>
        )}

        {/* Adresse + horaires */}
        <div className="flex flex-col gap-2 py-4 border-y" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          {spot.adresse && (
            <p className="text-muted text-sm font-body flex items-center gap-2">
              <span>📍</span> {spot.adresse}
            </p>
          )}
          {status && (
            <p className="text-sm font-body font-medium" style={{ color: status.open ? '#6fcf8a' : '#888' }}>
              {status.label}
            </p>
          )}
        </div>

        {/* Tags */}
        {spot.tags && spot.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {spot.tags.map((tag) => (
              <span key={tag} className="px-3 py-1.5 rounded-full text-xs font-body"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Boutons */}
        <div className="flex gap-3 mt-2">
          <button
            onClick={handleShare}
            className="flex-1 py-3.5 rounded-full font-display font-medium text-sm transition-all flex items-center justify-center gap-2"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: shared ? '#6fcf8a' : '#f5f5f0' }}
          >
            {shared ? '✓ Lien copié' : 'Partager'}
          </button>
          <a
            href={mapsUrl(spot)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-[2] py-3.5 rounded-full flex items-center justify-center font-display font-semibold text-sm"
            style={{ background: 'linear-gradient(135deg,#F195B8,#D4649A)', color: '#0A0A0A' }}
          >
            Y aller →
          </a>
        </div>

        {/* CTA retour accueil */}
        <button
          onClick={() => router.push('/')}
          className="text-center text-muted text-xs font-body mt-2 underline underline-offset-2"
        >
          Trouver d&apos;autres spots ce soir
        </button>
      </div>
    </main>
  )
}
