'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Taille max du plus grand côté et qualité JPG après compression (≈250 Ko par photo).
// 1200 px suffit même sur écran Retina, et ménage le quota gratuit Supabase (1 Go stockage, trafic mensuel).
const MAX_SIDE = 1200
const QUALITY = 0.8

// Liens « copier l'adresse de l'image » de Google Maps : temporaires, tous expirés.
export function isDeadGoogleLink(url: string | null | undefined) {
  return !!url && url.includes('googleusercontent.com/gps-cs-s/')
}

// Décode l'image puis la redimensionne / recompresse en JPG dans le navigateur.
async function compress(file: File): Promise<Blob> {
  let source: ImageBitmap | HTMLImageElement
  try {
    source = await createImageBitmap(file)
  } catch {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('illisible'))
      img.src = URL.createObjectURL(file)
    })
  }
  const sw = source instanceof HTMLImageElement ? source.naturalWidth : source.width
  const sh = source instanceof HTMLImageElement ? source.naturalHeight : source.height
  if (!sw || !sh) throw new Error('illisible')
  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh))
  const w = Math.round(sw * scale)
  const h = Math.round(sh * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('illisible')
  ctx.fillStyle = '#FBF4EC' // fond crème si l'image a de la transparence
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(source, 0, 0, w, h)
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('illisible'))), 'image/jpeg', QUALITY)
  )
}

export default function PhotoUploader({
  spotId,
  remaining,
  onUploaded,
}: {
  spotId: string
  remaining: number // places libres (4 photos max)
  onUploaded: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0 || busy) return
    const files = Array.from(list).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
    if (files.length === 0) { setMsg('Choisis des fichiers image.'); return }
    if (remaining <= 0) { setMsg('4 photos maximum : retires-en une avant d’en ajouter.'); return }

    const batch = files.slice(0, remaining)
    setBusy(true)
    setMsg(null)

    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      setBusy(false)
      setMsg('Session expirée : reconnecte-toi au back-office.')
      return
    }

    let ok = 0
    const errors: string[] = []
    for (let i = 0; i < batch.length; i++) {
      const file = batch[i]
      setMsg(`Envoi ${i + 1}/${batch.length}…`)
      try {
        const blob = await compress(file)
        const fd = new FormData()
        fd.append('file', blob, 'photo.jpg')
        fd.append('spotId', spotId)
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.url) throw new Error(json.error || 'Envoi impossible.')
        onUploaded(json.url)
        ok++
      } catch (e) {
        const reason = e instanceof Error ? e.message : 'erreur'
        errors.push(`${file.name} : ${reason === 'illisible' ? 'format non lu par ce navigateur (exporte-la en JPG)' : reason}`)
      }
    }

    setBusy(false)
    const skipped = files.length - batch.length
    setMsg([
      ok ? `✓ ${ok} photo${ok > 1 ? 's' : ''} ajoutée${ok > 1 ? 's' : ''} — pense à cliquer sur Enregistrer.` : '',
      ...errors,
      skipped ? `${skipped} photo${skipped > 1 ? 's' : ''} ignorée${skipped > 1 ? 's' : ''} (4 maximum).` : '',
    ].filter(Boolean).join('\n'))
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !busy) inputRef.current?.click() }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files) }}
        className="rounded-xl border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors"
        style={{
          borderColor: drag ? '#8B5CF6' : '#3a3a3a',
          background: drag ? 'rgba(139,92,246,0.08)' : 'transparent',
          opacity: busy ? 0.6 : 1,
        }}
      >
        <p className="text-[#f5f5f0] text-sm font-medium">
          {busy ? 'Envoi en cours…' : '📷 Ajouter des photos'}
        </p>
        <p className="text-[#6b6b6b] text-xs mt-1">
          Clique ou glisse tes images ici · compressées automatiquement · {remaining > 0 ? `${remaining} place${remaining > 1 ? 's' : ''} libre${remaining > 1 ? 's' : ''}` : 'complet (4 max)'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {msg && <p className="text-xs mt-2 whitespace-pre-line text-[#a3a3a3]">{msg}</p>}
    </div>
  )
}
