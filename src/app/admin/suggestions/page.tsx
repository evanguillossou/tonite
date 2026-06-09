'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminGuard from '@/components/AdminGuard'
import AdminNav from '@/components/AdminNav'
import type { SuggestionUser } from '@/types'

const TYPES = ['bar', 'club', 'rooftop', 'cave à cocktails', 'bar à vin', 'bar à bière']

type ConvertForm = {
  nom: string
  adresse: string
  arrondissement: string
  type: string
  budget: string
  energie: string
  vibe: string
  tags: string
  photo_url: string
  place_id_google: string
  note_google: string
  coordonnees_lat: string
  coordonnees_lng: string
  horaires: unknown
}

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<SuggestionUser[]>([])
  const [loading, setLoading] = useState(true)
  const [converting, setConverting] = useState<SuggestionUser | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('suggestions_users')
      .select('*')
      .order('date_soumission', { ascending: false })
    setSuggestions((data as SuggestionUser[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updateStatut(id: string, statut: 'validé' | 'rejeté') {
    await supabase.from('suggestions_users').update({ statut }).eq('id', id)
    load()
  }

  const enAttente = suggestions.filter((s) => s.statut === 'en attente')
  const traites   = suggestions.filter((s) => s.statut !== 'en attente')

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#0a0a0a]">
        <AdminNav />
        <div className="max-w-3xl mx-auto px-5 py-8">
          <h1 className="text-2xl font-bold text-[#f5f5f0] mb-6">Suggestions</h1>

          {loading ? (
            <p className="text-[#6b6b6b] text-sm">Chargement…</p>
          ) : (
            <>
              {enAttente.length > 0 && (
                <section className="mb-10">
                  <p className="text-xs tracking-[0.25em] text-[#FF6B35] uppercase mb-4">
                    En attente ({enAttente.length})
                  </p>
                  <div className="flex flex-col gap-3">
                    {enAttente.map((s) => (
                      <SuggestionCard
                        key={s.id}
                        suggestion={s}
                        onUpdate={updateStatut}
                        onConvert={() => setConverting(s)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {enAttente.length === 0 && (
                <p className="text-[#6b6b6b] text-sm mb-8">Aucune suggestion en attente.</p>
              )}

              {traites.length > 0 && (
                <section>
                  <p className="text-xs tracking-[0.25em] text-[#444] uppercase mb-4">
                    Traités ({traites.length})
                  </p>
                  <div className="flex flex-col gap-2">
                    {traites.map((s) => (
                      <SuggestionCard
                        key={s.id}
                        suggestion={s}
                        onUpdate={updateStatut}
                        onConvert={() => setConverting(s)}
                        compact
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de conversion */}
      {converting && (
        <ConvertModal
          suggestion={converting}
          onClose={() => setConverting(null)}
          onSuccess={() => {
            setConverting(null)
            load()
          }}
        />
      )}
    </AdminGuard>
  )
}

function SuggestionCard({
  suggestion: s,
  onUpdate,
  onConvert,
  compact,
}: {
  suggestion: SuggestionUser
  onUpdate: (id: string, statut: 'validé' | 'rejeté') => void
  onConvert: () => void
  compact?: boolean
}) {
  return (
    <div className={[
      'bg-[#141414] border rounded-xl p-4',
      s.statut === 'en attente' ? 'border-[#2a2a2a]' : 'border-[#1a1a1a]',
    ].join(' ')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[#f5f5f0] font-semibold text-sm">{s.nom_lieu}</p>
          {s.adresse && <p className="text-[#666] text-xs mt-0.5">{s.adresse}</p>}
          {!compact && s.commentaire && (
            <p className="text-[#888] text-xs mt-2 leading-relaxed">{s.commentaire}</p>
          )}
          <p className="text-[#333] text-[10px] mt-2">
            {new Date(s.date_soumission).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {s.statut === 'en attente' ? (
            <>
              <button
                onClick={onConvert}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: 'rgba(255,107,53,0.15)', color: '#FF6B35' }}
              >
                Convertir en spot →
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => onUpdate(s.id, 'validé')}
                  className="px-3 py-1.5 rounded-lg bg-[rgba(34,197,94,0.1)] text-green-500 text-xs font-medium hover:bg-[rgba(34,197,94,0.2)] transition-colors"
                >
                  Valider
                </button>
                <button
                  onClick={() => onUpdate(s.id, 'rejeté')}
                  className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] text-[#666] text-xs hover:text-[#888] transition-colors"
                >
                  Rejeter
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              {s.statut === 'validé' && (
                <button
                  onClick={onConvert}
                  className="px-2 py-1 rounded-lg text-[10px] transition-colors"
                  style={{ background: 'rgba(255,107,53,0.1)', color: '#FF6B35' }}
                >
                  Convertir
                </button>
              )}
              <span className={[
                'text-xs px-2 py-1 rounded-lg',
                s.statut === 'validé' ? 'text-green-500 bg-[rgba(34,197,94,0.1)]' : 'text-[#444] bg-[#1a1a1a]',
              ].join(' ')}>
                {s.statut}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ConvertModal({
  suggestion,
  onClose,
  onSuccess,
}: {
  suggestion: SuggestionUser
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState<ConvertForm>({
    nom: suggestion.nom_lieu || '',
    adresse: suggestion.adresse || '',
    arrondissement: '',
    type: 'bar',
    budget: '2',
    energie: '2',
    vibe: '',
    tags: '',
    photo_url: '',
    place_id_google: '',
    note_google: '',
    coordonnees_lat: '',
    coordonnees_lng: '',
    horaires: null,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapsUrl, setMapsUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  async function handleImport() {
    if (!mapsUrl.trim()) return
    setImporting(true)
    setImportError(null)
    try {
      const res = await fetch(`/api/places?url=${encodeURIComponent(mapsUrl.trim())}`)
      const data = await res.json()
      if (!res.ok) { setImportError(data.error || 'Erreur import'); return }
      setForm(f => ({
        ...f,
        nom:             data.nom            || f.nom,
        adresse:         data.adresse         || f.adresse,
        arrondissement:  data.arrondissement  ? String(data.arrondissement) : f.arrondissement,
        coordonnees_lat: data.coordonnees_lat != null ? String(data.coordonnees_lat) : f.coordonnees_lat,
        coordonnees_lng: data.coordonnees_lng != null ? String(data.coordonnees_lng) : f.coordonnees_lng,
        photo_url:       data.photo_url        || f.photo_url,
        place_id_google: data.place_id_google  || f.place_id_google,
        note_google:     data.note_google      != null ? String(data.note_google) : f.note_google,
        budget:          data.budget           != null ? String(data.budget) : f.budget,
        horaires:        data.horaires         ?? f.horaires,
      }))
      setMapsUrl('')
    } catch {
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

    const { error: insertError } = await supabase.from('spots').insert({
      nom:             form.nom.trim(),
      type:            form.type,
      vibe:            form.vibe.trim() || null,
      adresse:         form.adresse.trim(),
      arrondissement:  Number(form.arrondissement),
      budget:          Number(form.budget),
      energie:         Number(form.energie),
      tags:            form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      photo_url:       form.photo_url.trim() || null,
      place_id_google: form.place_id_google.trim() || null,
      note_google:     form.note_google ? Number(form.note_google) : null,
      coordonnees_lat: form.coordonnees_lat ? Number(form.coordonnees_lat) : null,
      coordonnees_lng: form.coordonnees_lng ? Number(form.coordonnees_lng) : null,
      horaires:        form.horaires || null,
      actif:           true,
      vibe_enrichie:   false,
      suggestions_count: 0,
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    // Marque la suggestion comme validée
    await supabase.from('suggestions_users').update({ statut: 'validé' }).eq('id', suggestion.id)

    setSaving(false)
    onSuccess()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg bg-[#141414] border border-[#2a2a2a] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[#f5f5f0] font-bold text-lg">Convertir en spot</h2>
          <button onClick={onClose} className="text-[#666] hover:text-[#f5f5f0] text-xl leading-none">✕</button>
        </div>

        {/* Info suggestion source */}
        <div className="bg-[#1a1a1a] rounded-xl px-4 py-3 mb-6 text-xs text-[#666]">
          Suggestion de : <span className="text-[#888]">{suggestion.nom_lieu}</span>
          {suggestion.commentaire && (
            <p className="mt-1 italic">&ldquo;{suggestion.commentaire}&rdquo;</p>
          )}
        </div>

        {/* Import Google Maps */}
        <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-3 mb-2">
          <p className="text-[#555] text-[10px] uppercase tracking-wider mb-2">Import depuis Google Maps</p>
          <div className="flex gap-2">
            <input
              value={mapsUrl}
              onChange={e => setMapsUrl(e.target.value)}
              placeholder="Colle l'URL Google Maps…"
              className="input-style flex-1 text-sm"
            />
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !mapsUrl.trim()}
              className="px-3 py-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-40 shrink-0"
              style={{ background: 'linear-gradient(135deg,#FF6B35,#E91E8C)', color: '#fff' }}
            >
              {importing ? '…' : 'Importer'}
            </button>
          </div>
          {importError && <p className="text-red-400 text-xs mt-1.5">{importError}</p>}
          {form.place_id_google && <p className="text-green-500 text-xs mt-1.5">✓ Lieu importé</p>}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Nom *">
            <input
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              required
              className="input-style"
            />
          </Field>

          <Field label="Adresse">
            <input
              value={form.adresse}
              onChange={(e) => setForm({ ...form, adresse: e.target.value })}
              className="input-style"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Arrondissement *">
              <select
                value={form.arrondissement}
                onChange={(e) => setForm({ ...form, arrondissement: e.target.value })}
                required
                className="input-style"
              >
                <option value="">--</option>
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}e</option>
                ))}
              </select>
            </Field>

            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="input-style"
              >
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Budget">
              <select value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="input-style">
                <option value="1">€  (–15€)</option>
                <option value="2">€€  (15–30€)</option>
                <option value="3">€€€  (30€+)</option>
              </select>
            </Field>
            <Field label="Énergie">
              <select value={form.energie} onChange={(e) => setForm({ ...form, energie: e.target.value })} className="input-style">
                <option value="1">Calme</option>
                <option value="2">Animé</option>
                <option value="3">Festif</option>
              </select>
            </Field>
          </div>

          <Field label="Vibe (1 phrase courte)">
            <input
              value={form.vibe}
              onChange={(e) => setForm({ ...form, vibe: e.target.value })}
              placeholder="ex : Lumières tamisées, cocktails créatifs, parfait pour une soirée tête-à-tête"
              className="input-style"
            />
          </Field>

          <Field label="Tags (séparés par des virgules)">
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="ex : terrasse, jazz, cocktails"
              className="input-style"
            />
          </Field>

          <Field label="URL photo">
            <input
              value={form.photo_url}
              onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
              placeholder="https://..."
              className="input-style"
            />
          </Field>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-[#1a1a1a] text-[#666] text-sm hover:text-[#888] transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !form.arrondissement}
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #FF6B35, #E91E8C)' }}
            >
              {saving ? 'Création…' : 'Créer le spot'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
