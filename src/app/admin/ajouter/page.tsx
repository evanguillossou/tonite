'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AdminGuard from '@/components/AdminGuard'
import AdminNav from '@/components/AdminNav'

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

type JourHoraire = {
  ouvert: boolean
  ouverture: string
  fermeture: string
}

const defaultJours = (): JourHoraire[] =>
  JOURS.map(() => ({ ouvert: false, ouverture: '18:00', fermeture: '02:00' }))

function horaireToJson(jours: JourHoraire[]) {
  const periods: { open: { day: number; time: string }; close: { day: number; time: string } }[] = []
  jours.forEach((j, day) => {
    if (!j.ouvert) return
    const openTime = j.ouverture.replace(':', '')
    const closeTime = j.fermeture.replace(':', '')
    const closeDay = parseInt(closeTime) < parseInt(openTime) ? (day + 1) % 7 : day
    periods.push({ open: { day, time: openTime }, close: { day: closeDay, time: closeTime } })
  })
  return periods.length > 0 ? periods : null
}

function HorairesEditor({ value, onChange }: { value: JourHoraire[], onChange: (v: JourHoraire[]) => void }) {
  function update(i: number, patch: Partial<JourHoraire>) {
    const next = value.map((j, idx) => idx === i ? { ...j, ...patch } : j)
    onChange(next)
  }
  return (
    <div className="flex flex-col gap-2">
      {JOURS.map((jour, i) => (
        <div key={jour} className="flex items-center gap-3">
          <label className="flex items-center gap-2 w-28 cursor-pointer">
            <input
              type="checkbox"
              checked={value[i].ouvert}
              onChange={e => update(i, { ouvert: e.target.checked })}
              className="accent-[#FF6B35]"
            />
            <span className={`text-xs ${value[i].ouvert ? 'text-[#f5f5f0]' : 'text-[#444]'}`}>{jour}</span>
          </label>
          {value[i].ouvert ? (
            <>
              <input
                type="time"
                value={value[i].ouverture}
                onChange={e => update(i, { ouverture: e.target.value })}
                className="input-style text-xs w-24 py-1.5"
              />
              <span className="text-[#444] text-xs">→</span>
              <input
                type="time"
                value={value[i].fermeture}
                onChange={e => update(i, { fermeture: e.target.value })}
                className="input-style text-xs w-24 py-1.5"
              />
            </>
          ) : (
            <span className="text-[#333] text-xs">Fermé</span>
          )}
        </div>
      ))}
    </div>
  )
}

const TYPES = [
  // Bar d'ambiance
  'bar', 'bar à cocktails', 'bar à vin', 'bar à bière', 'rooftop',
  // Clubbing
  'club',
  // Terrasse
  'terrasse',
  // Bonne bouffe
  'bistrot', 'restaurant', 'grec', 'asiatique', 'italien', 'tapas', 'bonne bouffe',
  // Autre
  'autre',
]

type FormData = {
  nom: string
  type: string
  vibe: string
  adresse: string
  arrondissement: string
  budget: string
  energie: string
  tags: string
  photos: string[]
  place_id_google: string
  note_google: string
  coordonnees_lat: string
  coordonnees_lng: string
  horaires: unknown
  actif: boolean
  vibe_enrichie: boolean
}

const empty: FormData = {
  nom: '', type: 'bar', vibe: '', adresse: '', arrondissement: '',
  budget: '2', energie: '2', tags: '', photos: [''], place_id_google: '',
  note_google: '', coordonnees_lat: '', coordonnees_lng: '', horaires: null,
  actif: true, vibe_enrichie: false,
}

export default function AjouterPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapsUrl, setMapsUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [jours, setJours] = useState<JourHoraire[]>(defaultJours())

  function updatePhoto(index: number, value: string) {
    const next = [...form.photos]
    next[index] = value
    setForm({ ...form, photos: next })
  }

  function addPhoto() {
    if (form.photos.length >= 4) return
    setForm({ ...form, photos: [...form.photos, ''] })
  }

  function removePhoto(index: number) {
    const next = form.photos.filter((_, i) => i !== index)
    setForm({ ...form, photos: next.length > 0 ? next : [''] })
  }

  async function handleImport() {
    if (!mapsUrl.trim()) return
    setImporting(true)
    setImportError(null)
    try {
      const res = await fetch(`/api/places?url=${encodeURIComponent(mapsUrl.trim())}`)
      const data = await res.json()
      if (!res.ok) { setImportError(data.error || 'Erreur lors de l\'import'); return }
      if (!data.place_id_google) {
        setImportError('Lieu introuvable sur Google Places. Essaie l\'URL longue depuis la barre d\'adresse du navigateur.')
        return
      }
      setForm(f => ({
        ...f,
        nom:             data.nom            || f.nom,
        adresse:         data.adresse         || f.adresse,
        arrondissement:  data.arrondissement  ? String(data.arrondissement) : f.arrondissement,
        coordonnees_lat: data.coordonnees_lat != null ? String(data.coordonnees_lat) : f.coordonnees_lat,
        coordonnees_lng: data.coordonnees_lng != null ? String(data.coordonnees_lng) : f.coordonnees_lng,
        photos:          data.photo_url ? [data.photo_url] : f.photos,
        place_id_google: data.place_id_google || f.place_id_google,
        note_google:     data.note_google     != null ? String(data.note_google) : f.note_google,
        budget:          data.budget          != null ? String(data.budget) : f.budget,
        horaires:        data.horaires        ?? f.horaires,
      }))
      setMapsUrl('')
    } catch (err) {
      console.error('[Import] erreur:', err)
      setImportError('Impossible de contacter le serveur.')
    } finally {
      setImporting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom.trim() || !form.arrondissement) return
    setSaving(true)
    setError(null)

    const cleanPhotos = form.photos.map(p => p.trim()).filter(Boolean)

    const { error } = await supabase.from('spots').insert({
      nom:             form.nom.trim(),
      type:            form.type,
      vibe:            form.vibe.trim() || null,
      adresse:         form.adresse.trim(),
      arrondissement:  Number(form.arrondissement),
      budget:          Number(form.budget),
      energie:         Number(form.energie),
      tags:            form.tags.split(',').map(t => t.trim()).filter(Boolean),
      photo_url:       cleanPhotos[0] || null,
      photos:          cleanPhotos.length > 0 ? cleanPhotos : null,
      place_id_google: form.place_id_google.trim() || null,
      note_google:     form.note_google ? Number(form.note_google) : null,
      coordonnees_lat: form.coordonnees_lat ? Number(form.coordonnees_lat) : null,
      coordonnees_lng: form.coordonnees_lng ? Number(form.coordonnees_lng) : null,
      horaires:        form.horaires || horaireToJson(jours),
      actif:           form.actif,
      vibe_enrichie:   form.vibe_enrichie,
      suggestions_count: 0,
    })

    setSaving(false)
    if (error) setError(error.message)
    else router.push('/admin/spots')
  }

  const filledPhotos = form.photos.filter(p => p.trim())

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#0a0a0a]">
        <AdminNav />
        <div className="max-w-lg mx-auto px-5 py-8">
          <h1 className="text-2xl font-bold text-[#f5f5f0] mb-8">Ajouter un spot</h1>

          {/* Import Google Maps */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4 mb-8">
            <p className="text-xs text-[#666] mb-3 tracking-wide uppercase">Import depuis Google Maps</p>
            <div className="flex gap-2">
              <input
                value={mapsUrl}
                onChange={e => setMapsUrl(e.target.value)}
                placeholder="Colle l'URL Google Maps du bar…"
                className="input-style flex-1 text-sm"
              />
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || !mapsUrl.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 shrink-0"
                style={{ background: 'linear-gradient(135deg,#FF6B35,#E91E8C)', color: '#fff' }}
              >
                {importing ? '…' : 'Importer'}
              </button>
            </div>
            {importError && <p className="text-red-400 text-xs mt-2">{importError}</p>}
            {form.place_id_google && (
              <div className="mt-2 p-3 rounded-lg bg-[#0f1f0f] border border-green-900">
                <p className="text-green-400 text-xs font-medium mb-1">✓ Import réussi</p>
                <p className="text-[#888] text-[11px]">📍 {form.nom} — {form.arrondissement}e arr.</p>
                <p className="text-[#888] text-[11px]">{form.horaires ? `🕐 Horaires : ${(form.horaires as unknown[]).length} périodes` : '⚠️ Pas d\'horaires Google disponibles'}</p>
                {filledPhotos.length > 0 && <p className="text-[#888] text-[11px]">📸 {filledPhotos.length} photo{filledPhotos.length > 1 ? 's' : ''} récupérée{filledPhotos.length > 1 ? 's' : ''}</p>}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Field label="Nom *">
              <input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} required className="input-style" />
            </Field>

            <Field label="Type">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="input-style">
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Vibe (1 phrase)">
              <textarea value={form.vibe} onChange={e => setForm({ ...form, vibe: e.target.value })} rows={2} className="input-style resize-none" />
            </Field>

            <Field label="Adresse">
              <input value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} className="input-style" />
            </Field>

            <Field label="Arrondissement *">
              <select value={form.arrondissement} onChange={e => setForm({ ...form, arrondissement: e.target.value })} required className="input-style">
                <option value="">--</option>
                {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}e</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Budget">
                <select value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} className="input-style">
                  <option value="1">€ (–15€)</option>
                  <option value="2">€€ (15–30€)</option>
                  <option value="3">€€€ (30€+)</option>
                </select>
              </Field>
              <Field label="Énergie">
                <select value={form.energie} onChange={e => setForm({ ...form, energie: e.target.value })} className="input-style">
                  <option value="1">Calme</option>
                  <option value="2">Animé</option>
                  <option value="3">Festif</option>
                </select>
              </Field>
            </div>

            <Field label="Tags (séparés par des virgules)">
              <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="cocktails, terrasse, jazz" className="input-style" />
            </Field>

            {/* Photos 1 à 4 */}
            <div>
              <label className="text-[#6b6b6b] text-xs mb-1.5 block">Photos (1 à 4 URLs)</label>
              <div className="flex flex-col gap-2">
                {form.photos.map((url, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      value={url}
                      onChange={e => updatePhoto(i, e.target.value)}
                      placeholder={`URL photo ${i + 1}`}
                      className="input-style flex-1 text-sm"
                    />
                    {url.trim() && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url.trim()} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    )}
                    {form.photos.length > 1 && (
                      <button type="button" onClick={() => removePhoto(i)} className="text-[#555] hover:text-red-400 text-sm shrink-0">✕</button>
                    )}
                  </div>
                ))}
                {form.photos.length < 4 && (
                  <button
                    type="button"
                    onClick={addPhoto}
                    className="text-xs text-[#555] hover:text-[#888] text-left transition-colors py-1"
                  >
                    + Ajouter une photo
                  </button>
                )}
              </div>
            </div>

            {/* Horaires */}
            {form.horaires == null ? (
              <div>
                <label className="text-[#6b6b6b] text-xs mb-2 block">Horaires</label>
                <HorairesEditor value={jours} onChange={setJours} />
              </div>
            ) : (
              <div className="bg-[#0f1f0f] border border-green-900 rounded-xl p-3">
                <p className="text-green-400 text-xs">✓ Horaires importés depuis Google ({(form.horaires as unknown[]).length} périodes)</p>
              </div>
            )}

            {/* Champs techniques */}
            {form.place_id_google && (
              <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-3 flex flex-col gap-1.5">
                <p className="text-[#444] text-[10px] uppercase tracking-wider mb-1">Données Google (auto)</p>
                <p className="text-[#555] text-xs">place_id : {form.place_id_google}</p>
                {form.note_google && <p className="text-[#555] text-xs">Note : {form.note_google} / 5</p>}
                {form.coordonnees_lat && <p className="text-[#555] text-xs">Coords : {form.coordonnees_lat}, {form.coordonnees_lng}</p>}
              </div>
            )}

            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.actif} onChange={e => setForm({ ...form, actif: e.target.checked })} className="accent-[#FF6B35]" />
                <span className="text-[#f5f5f0] text-sm">Actif</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.vibe_enrichie} onChange={e => setForm({ ...form, vibe_enrichie: e.target.checked })} className="accent-[#FF6B35]" />
                <span className="text-[#f5f5f0] text-sm">Vibe enrichie</span>
              </label>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="py-4 rounded-2xl text-white font-semibold text-sm transition-colors disabled:opacity-50 mt-2"
              style={{ background: 'linear-gradient(135deg,#FF6B35,#E91E8C)' }}
            >
              {saving ? 'Enregistrement…' : 'Ajouter le spot'}
            </button>
          </form>
        </div>
      </div>
    </AdminGuard>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[#6b6b6b] text-xs mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}
