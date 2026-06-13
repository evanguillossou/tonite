'use client'

import { useEffect, useRef, useState } from 'react'
import type { Spot } from '@/types'

const MAPBOX_VERSION = 'v3.7.0'
const MAPBOX_CSS = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_VERSION}/mapbox-gl.css`
const MAPBOX_JS  = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_VERSION}/mapbox-gl.js`

// Centre de Paris
const PARIS: [number, number] = [2.3488, 48.8534]

// Charge le script Mapbox une seule fois (CDN, pas de dépendance npm)
function loadMapbox(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { mapboxgl?: unknown }
    if (w.mapboxgl) { resolve(w.mapboxgl); return }

    // CSS
    if (!document.querySelector(`link[href="${MAPBOX_CSS}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = MAPBOX_CSS
      document.head.appendChild(link)
    }

    // JS
    const existing = document.querySelector(`script[src="${MAPBOX_JS}"]`) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(w.mapboxgl))
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.src = MAPBOX_JS
    script.async = true
    script.onload = () => resolve(w.mapboxgl)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

type MapboxMap = {
  on: (ev: string, cb: () => void) => void
  remove: () => void
  fitBounds: (b: unknown, opts?: unknown) => void
}

export default function MapView({
  spots,
  selectedId,
  onSelect,
}: {
  spots: Spot[]
  selectedId: string | null
  onSelect: (spot: Spot) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const markersRef = useRef<{ id: string; el: HTMLElement; marker: { remove: () => void } }[]>([])

  // Clé Mapbox récupérée au runtime (et non au build) pour éviter le cache de build Vercel.
  // undefined = en cours de chargement ; null = absente ; string = OK
  const [token, setToken] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    fetch('/api/mapbox-token')
      .then(r => r.json())
      .then((d: { token?: string }) => { if (alive) setToken(d.token || null) })
      .catch(() => { if (alive) setToken(null) })
    return () => { alive = false }
  }, [])

  // onSelect peut changer à chaque render du parent : on le garde dans une ref
  // pour ne PAS ré-initialiser la carte à chaque fois.
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  // Init carte + markers
  useEffect(() => {
    if (!token || !containerRef.current) return
    let cancelled = false

    loadMapbox().then((mb) => {
      if (cancelled || !containerRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapboxgl = mb as any
      mapboxgl.accessToken = token

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: PARIS,
        zoom: 11.5,
        attributionControl: false,
      }) as MapboxMap
      mapRef.current = map

      map.on('load', () => {
        if (cancelled) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bounds = new (mapboxgl as any).LngLatBounds()
        let hasPoint = false

        for (const spot of spots) {
          const lng = Number(spot.coordonnees_lng)
          const lat = Number(spot.coordonnees_lat)
          if (!lat || !lng) continue

          // Conteneur positionné par Mapbox (taille fixe = ancrage stable).
          // On ne touche JAMAIS son transform → plus de saut en haut à gauche.
          const wrapper = document.createElement('div')
          wrapper.style.cssText = 'width:24px;height:24px;display:flex;align-items:center;justify-content:center'

          // Pin visible : c'est lui qu'on anime/agrandit (jamais le wrapper).
          const el = document.createElement('div')
          el.className = 'tonite-pin'
          el.style.cssText = [
            'width:16px', 'height:16px', 'border-radius:50%',
            'background:#F195B8', 'border:2px solid #0A0A0A',
            'box-shadow:0 0 0 1px rgba(241,149,184,0.5), 0 2px 6px rgba(0,0,0,0.5)',
            'cursor:pointer',
            'transition:transform 150ms ease, width 150ms ease, height 150ms ease',
          ].join(';')
          wrapper.appendChild(el)

          el.addEventListener('click', (e) => {
            e.stopPropagation()
            onSelectRef.current(spot)
          })
          el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.35)' })
          el.addEventListener('mouseleave', () => { el.style.transform = '' })

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const marker = new (mapboxgl as any).Marker({ element: wrapper })
            .setLngLat([lng, lat])
            .addTo(map)
          markersRef.current.push({ id: spot.id, el, marker })
          bounds.extend([lng, lat])
          hasPoint = true
        }

        if (hasPoint) {
          map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 })
        }
      })
    }).catch(() => { /* échec chargement Mapbox — la carte reste vide */ })

    return () => {
      cancelled = true
      markersRef.current.forEach(m => m.marker.remove())
      markersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [spots, token])

  // Met en évidence le pin sélectionné
  useEffect(() => {
    markersRef.current.forEach(({ id, el }) => {
      if (id === selectedId) {
        el.style.background = '#fff'
        el.style.width = '22px'
        el.style.height = '22px'
        el.style.boxShadow = '0 0 0 3px rgba(241,149,184,0.9), 0 2px 10px rgba(0,0,0,0.6)'
        el.style.zIndex = '10'
      } else {
        el.style.background = '#F195B8'
        el.style.width = '16px'
        el.style.height = '16px'
        el.style.boxShadow = '0 0 0 1px rgba(241,149,184,0.5), 0 2px 6px rgba(0,0,0,0.5)'
        el.style.zIndex = ''
      }
    })
  }, [selectedId])

  if (token === undefined) {
    return (
      <div className="flex items-center justify-center h-full text-center px-8">
        <p className="text-muted text-sm font-body">Chargement de la carte…</p>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center h-full text-center px-8">
        <p className="text-muted text-sm font-body">
          Carte indisponible — clé Mapbox manquante.
        </p>
      </div>
    )
  }

  return <div ref={containerRef} className="w-full h-full" />
}
