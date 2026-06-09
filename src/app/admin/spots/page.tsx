'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminGuard from '@/components/AdminGuard'
import AdminNav from '@/components/AdminNav'
import type { Spot } from '@/types'

const TYPES = ['bar', 'club', 'rooftop', 'cave à cocktails', 'bar à vin', 'bar à bière', 'autre']

export default function SpotsPage() {
  const [spots, setSpots] = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ vibe: '', actif: '', arr: '' })
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Spot | null>(null)
  const [saving, setSaving] = useState(false)

  async function loadSpots() {
    setLoading(true)
    let q = supabase.from('spots').select('*').order('date_ajout', { ascending: false })
    if (filters.vibe === 'oui') q = q.eq('vibe_enrichie', true)
    if (filters.vibe === 'non') q = q.eq('vibe_enrichie', false)
    if (filters.actif === 'oui') q = q.eq('actif', true)
    if (filters.actif === 'non') q = q.eq('actif', false)
    if (filters.arr) q = q.eq('arrondissement', Number(filters.arr))
    const { data } = await q.limit(500)
    setSpots((data as Spot[]) || [])
    setLoading(false)
  }

  useEffect(() => { loadSpots() }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSpots = search.trim()
    ? spots.filter(s =>
        s.nom.toLowerCase().includes(search.toLowerCase()) ||
        (s.vibe || '').toLowerCase().includes(search.toLowerCase())
      )
    : spots

  async function deleteSpot(id: string) {
    if (!confirm('Supprimer ce spot définitivement ?')) return
    await supabase.from('spots').delete().eq('id', id)
    setEditing(null)
    loadSpots()
  }

  async function saveSpot() {
    if (!editing) return
    setSaving(true)
    await supabase.from('spots').update({
      nom: editing.nom,
      type: editing.type,
      vibe: editing.vibe,
      budget: editing.budget,
      energie: editing.energie,
      tags: editing.tags,
      photo_url: editing.photo_url,
      actif: editing.actif,
      vibe_enrichie: editing.vibe_enrichie,
    }).eq('id', editing.id)
    setSaving(false)
    setEditing(null)
    loadSpots()
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#0a0a0a]">
        <AdminNav />
        <div className="max-w-5xl mx-auto px-5 py-8">
          <h1 className="text-2xl font-bold text-[#f5f5f0] mb-6">Spots</h1>

          {/* Recherche */}
          <div className="mb-4">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou vibe…"
              className="bg-[#141414] border border-[#222] text-[#f5f5f0] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#8B5CF6] w-full max-w-sm"
            />
          </div>

          {/* Filtres */}
          <div className="flex flex-wrap gap-3 mb-6">
            <select
              value={filters.vibe}
              onChange={(e) => setFilters({ ...filters, vibe: e.target.value })}
              className="bg-[#141414] border border-[#222] text-[#f5f5f0] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#8B5CF6]"
            >
              <option value="">Vibe : tous</option>
              <option value="oui">Vibe enrichie</option>
              <option value="non">Sans vibe</option>
            </select>
            <select
              value={filters.actif}
              onChange={(e) => setFilters({ ...filters, actif: e.target.value })}
              className="bg-[#141414] border border-[#222] text-[#f5f5f0] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#8B5CF6]"
            >
              <option value="">Statut : tous</option>
              <option value="oui">Actif</option>
              <option value="non">Inactif</option>
            </select>
            <select
              value={filters.arr}
              onChange={(e) => setFilters({ ...filters, arr: e.target.value })}
              className="bg-[#141414] border border-[#222] text-[#f5f5f0] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#8B5CF6]"
            >
              <option value="">Arr. : tous</option>
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}e</option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-[#6b6b6b] text-sm">Chargement…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#444] border-b border-[#1e1e1e]">
                    <th className="text-left py-3 pr-4 font-medium">Nom</th>
                    <th className="text-left py-3 pr-4 font-medium">Type</th>
                    <th className="text-left py-3 pr-4 font-medium">Arr.</th>
                    <th className="text-left py-3 pr-4 font-medium">Photo</th>
                    <th className="text-left py-3 pr-4 font-medium">Vibe</th>
                    <th className="text-left py-3 pr-4 font-medium">Actif</th>
                    <th className="py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredSpots.map((spot) => (
                    <tr key={spot.id} className="border-b border-[#111] hover:bg-[#111] transition-colors">
                      <td className="py-3 pr-4 text-[#f5f5f0] font-medium max-w-[180px] truncate">{spot.nom}</td>
                      <td className="py-3 pr-4 text-[#888]">{spot.type}</td>
                      <td className="py-3 pr-4 text-[#888]">{spot.arrondissement}e</td>
                      <td className="py-3 pr-4">
                        {spot.photo_url
                          ? <img src={spot.photo_url} alt="" className="w-8 h-8 rounded object-cover" />
                          : <span className="text-[#333]">–</span>
                        }
                      </td>
                      <td className="py-3 pr-4">
                        <span className={spot.vibe_enrichie ? 'text-[#8B5CF6]' : 'text-[#444]'}>
                          {spot.vibe_enrichie ? '✓' : '–'}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={spot.actif ? 'text-green-500' : 'text-[#444]'}>
                          {spot.actif ? '✓' : '–'}
                        </span>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => setEditing(spot)}
                          className="text-[#8B5CF6] hover:text-[#a78bfa] text-xs"
                        >
                          Éditer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[#444] text-xs mt-4">{filteredSpots.length}{search ? ` résultat${filteredSpots.length > 1 ? 's' : ''}` : ' spots'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal édition */}
      {editing && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[#f5f5f0] font-bold text-lg">Éditer le spot</h2>
              <button onClick={() => setEditing(null)} className="text-[#444] hover:text-[#888] text-xl">×</button>
            </div>

            <Field label="Nom">
              <input
                value={editing.nom}
                onChange={(e) => setEditing({ ...editing, nom: e.target.value })}
                className="input-style"
              />
            </Field>

            <Field label="Type">
              <select
                value={editing.type}
                onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                className="input-style"
              >
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Vibe (1 phrase)">
              <textarea
                value={editing.vibe || ''}
                onChange={(e) => setEditing({ ...editing, vibe: e.target.value })}
                rows={2}
                className="input-style resize-none"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Budget (1-3)">
                <select
                  value={editing.budget}
                  onChange={(e) => setEditing({ ...editing, budget: Number(e.target.value) as 1 | 2 | 3 })}
                  className="input-style"
                >
                  <option value={1}>1 — €</option>
                  <option value={2}>2 — €€</option>
                  <option value={3}>3 — €€€</option>
                </select>
              </Field>
              <Field label="Énergie (1-3)">
                <select
                  value={editing.energie}
                  onChange={(e) => setEditing({ ...editing, energie: Number(e.target.value) as 1 | 2 | 3 })}
                  className="input-style"
                >
                  <option value={1}>1 — Calme</option>
                  <option value={2}>2 — Animé</option>
                  <option value={3}>3 — Festif</option>
                </select>
              </Field>
            </div>

            <Field label="Tags (séparés par des virgules)">
              <input
                value={(editing.tags || []).join(', ')}
                onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                className="input-style"
              />
            </Field>

            <Field label="URL photo">
              <div className="flex gap-2 items-start">
                <input
                  value={editing.photo_url || ''}
                  onChange={(e) => setEditing({ ...editing, photo_url: e.target.value || null })}
                  placeholder="https://…"
                  className="input-style flex-1"
                />
                {editing.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editing.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                )}
              </div>
            </Field>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.actif}
                  onChange={(e) => setEditing({ ...editing, actif: e.target.checked })}
                  className="accent-[#8B5CF6]"
                />
                <span className="text-[#f5f5f0] text-sm">Actif</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.vibe_enrichie}
                  onChange={(e) => setEditing({ ...editing, vibe_enrichie: e.target.checked })}
                  className="accent-[#8B5CF6]"
                />
                <span className="text-[#f5f5f0] text-sm">Vibe enrichie</span>
              </label>
            </div>

            <button
              onClick={saveSpot}
              disabled={saving}
              className="py-3 rounded-xl bg-[#8B5CF6] text-white font-semibold text-sm hover:bg-[#7C3AED] transition-colors disabled:opacity-50 mt-2"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              onClick={() => deleteSpot(editing.id)}
              className="py-2 rounded-xl text-xs text-red-500 hover:text-red-400 transition-colors"
            >
              Supprimer définitivement
            </button>
          </div>
        </div>
      )}
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
