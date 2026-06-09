'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function ToniteWordmark() {
  return (
    <div className="flex items-center gap-1">
      <span className="font-display font-bold text-xl tracking-tight"
        style={{ background: 'linear-gradient(90deg,#FF6B35,#E91E8C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '-0.03em' }}>
        tonite
      </span>
      <span style={{ color: '#FF6B35', fontSize: '7px', marginTop: '-6px' }}>★</span>
    </div>
  )
}

export default function SuggererPage() {
  const router = useRouter()
  const [form, setForm] = useState({ nom_lieu: '', adresse: '', commentaire: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom_lieu.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setSuccess(true)
    } catch {
      setError("Une erreur s'est produite. Réessaie dans un instant.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-5 text-center max-w-lg mx-auto fade-in">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-6 font-display"
          style={{ background: 'linear-gradient(135deg,rgba(255,107,53,0.15),rgba(233,30,140,0.15))', border: '1px solid rgba(255,107,53,0.3)' }}>
          ✓
        </div>
        <h2 className="font-display font-bold text-2xl text-text mb-3">Merci !</h2>
        <p className="text-muted text-sm font-body leading-relaxed mb-8">
          Ta suggestion a bien été reçue. On la regarde dès que possible.
        </p>
        <button onClick={() => router.push('/')} className="btn-cta px-8 py-3.5 font-display font-semibold text-sm">
          Retour à l&apos;accueil
        </button>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-bg flex flex-col px-5 pt-10 pb-safe max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-10 fade-in">
        <button onClick={() => router.back()}
          className="text-muted text-sm font-body hover:text-text transition-colors">
          ← Retour
        </button>
        <ToniteWordmark />
        <div className="w-16" />
      </div>

      <header className="mb-8 fade-up">
        <p className="text-[11px] tracking-[0.2em] text-muted uppercase mb-3 font-body">Communauté</p>
        <h1 className="font-display font-bold text-3xl text-text">Suggérer un spot</h1>
        <p className="text-muted text-sm font-body mt-2">Tu connais un endroit qui mérite d&apos;être sur Tonite ?</p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 flex-1 fade-up delay-1">
        <div>
          <label className="text-[11px] tracking-[0.2em] text-muted uppercase block mb-2 font-body">Nom du lieu *</label>
          <input
            type="text"
            value={form.nom_lieu}
            onChange={(e) => setForm({ ...form, nom_lieu: e.target.value })}
            placeholder="Le Syndicat, Bar Fleuri…"
            required
            className="input-style"
          />
        </div>

        <div>
          <label className="text-[11px] tracking-[0.2em] text-muted uppercase block mb-2 font-body">Adresse</label>
          <input
            type="text"
            value={form.adresse}
            onChange={(e) => setForm({ ...form, adresse: e.target.value })}
            placeholder="51 rue du Faubourg Saint-Denis, 75010"
            className="input-style"
          />
        </div>

        <div>
          <label className="text-[11px] tracking-[0.2em] text-muted uppercase block mb-2 font-body">Pourquoi ce spot ?</label>
          <textarea
            value={form.commentaire}
            onChange={(e) => setForm({ ...form, commentaire: e.target.value })}
            placeholder="Ambiance, type de musique, ce qui le rend unique…"
            rows={4}
            className="input-style resize-none"
          />
        </div>

        {error && <p className="text-red-400 text-xs font-body">{error}</p>}

        <button
          type="submit"
          disabled={!form.nom_lieu.trim() || loading}
          className="btn-cta mt-auto py-4 font-display font-semibold text-base"
        >
          {loading ? 'Envoi…' : 'Envoyer la suggestion'}
        </button>
      </form>
    </main>
  )
}
