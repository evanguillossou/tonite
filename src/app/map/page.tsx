'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type MapSpot = {
  id: string
  nom: string
  type: string
  vibe: string | null
  budget: number
  arrondissement: number
  coordonnees_lat: number
  coordonnees_lng: number
  photo_url: string | null
}

export default function MapPage() {
  const router = useRouter()
  const [spots, setSpots] = useState<MapSpot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initMap = async () => {
      // Charger les spots
      const res = await fetch('/api/map-spots')
      const data = await res.json()
      setSpots(data)

      // Lazy-load Leaflet pour éviter SSR issues
      const L = await import('leaflet').then(mod => mod.default)

      // Créer la carte
      const m = L.map('map').setView([48.8566, 2.3522], 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(m)

      // Ajouter les marqueurs
      data.forEach((spot: MapSpot) => {
        const color = '#F195B8'
        const html = `
          <div style="
            width: 24px;
            height: 24px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            color: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">•</div>
        `
        const icon = L.divIcon({ html, className: '', iconSize: [24, 24] })

        const marker = L.marker([spot.coordonnees_lat, spot.coordonnees_lng], { icon }).addTo(m)

        const popupContent = `
          <div style="width: 220px; font-family: system-ui; font-size: 13px;">
            ${spot.photo_url ? `<img src="${spot.photo_url}" alt="${spot.nom}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; margin-bottom: 8px;" />` : ''}
            <p style="margin: 0; font-weight: 600; color: #f5f5f0; font-size: 14px;">${spot.nom}</p>
            <p style="margin: 4px 0 0 0; color: #888; font-size: 12px;">${spot.type} · ${'€'.repeat(spot.budget)}</p>
            ${spot.vibe ? `<p style="margin: 6px 0; color: #aaa; font-size: 12px; font-style: italic;">"${spot.vibe}"</p>` : ''}
            <a href="/spot/${spot.id}" style="display: inline-block; margin-top: 8px; padding: 6px 12px; background: linear-gradient(135deg,#F195B8,#D4649A); color: #0A0A0A; border-radius: 20px; text-decoration: none; font-weight: 600; font-size: 12px;">Voir le spot</a>
          </div>
        `
        marker.bindPopup(popupContent)
      })

      setLoading(false)
    }

    initMap()
  }, [])

  return (
    <div className="min-h-screen bg-bg flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-8 pb-4">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-sm font-body text-muted hover:text-text transition-colors"
        >
          ← Retour
        </button>
        <h1 className="font-display font-bold text-lg text-text">Carte</h1>
        <div className="w-12" />
      </div>

      {/* Carte */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
            <p className="text-muted text-sm font-body">Chargement de la carte…</p>
          </div>
        )}
        <div id="map" className="w-full h-full" style={{ background: '#0e0e0e' }} />
      </div>

      {/* Info */}
      <div className="px-5 py-4 text-center border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <p className="text-muted text-xs font-body">{spots.length} spots premium à proximité</p>
      </div>

      {/* CSS Leaflet */}
      <style>{`
        #map {
          position: relative;
        }
        .leaflet-control-attribution {
          background: rgba(0,0,0,0.6) !important;
          color: #888 !important;
          font-size: 11px !important;
        }
        .leaflet-popup-content-wrapper {
          background: #141414 !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
        }
        .leaflet-popup-tip {
          background: #141414 !important;
        }
        .leaflet-container a {
          color: #F195B8 !important;
        }
      `}</style>
    </div>
  )
}
