'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const links = [
  { href: '/admin/dashboard',   label: 'Dashboard' },
  { href: '/admin/spots',       label: 'Spots' },
  { href: '/admin/suggestions', label: 'Suggestions' },
  { href: '/admin/ajouter',     label: '+ Ajouter' },
]

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/admin')
  }

  return (
    <nav className="bg-card border-b border-border px-4 py-3 flex items-center gap-1 overflow-x-auto">
      <span className="font-display font-bold text-sm mr-4 shrink-0"
        style={{ background: 'linear-gradient(90deg,#FF6B35,#E91E8C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
        tonite★
      </span>
      {links.map((l) => (
        <Link key={l.href} href={l.href}
          className={[
            'px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors font-body',
            pathname.startsWith(l.href)
              ? 'text-white'
              : 'text-muted hover:text-text',
          ].join(' ')}
          style={pathname.startsWith(l.href) ? { background: 'linear-gradient(135deg,#FF6B35,#E91E8C)' } : {}}
        >
          {l.label}
        </Link>
      ))}
      <button onClick={logout}
        className="ml-auto text-muted text-xs font-body hover:text-text transition-colors shrink-0">
        Déco
      </button>
    </nav>
  )
}
