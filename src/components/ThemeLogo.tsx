/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'

// Logo adapté au thème : rose/vert en clair, noir/rose en sombre.
// Les deux versions sont dans la page ; le CSS (only-light / only-dark) affiche la bonne.
// Avec `href`, le logo devient un lien (retour à l'accueil, comme dans les applis mobiles).
export default function ThemeLogo({
  variant = 'wordmark',
  className = '',
  style,
  href,
}: {
  variant?: 'full' | 'wordmark' // full = logo carré (accueil) ; wordmark = version recadrée (en-têtes)
  className?: string
  style?: React.CSSProperties
  href?: string
}) {
  const light = variant === 'full' ? '/logo_rose.png' : '/logo_wordmark.png'
  const dark = variant === 'full' ? '/logo_noir.png' : '/logo_wordmark_noir.png'
  const logo = (
    <>
      <img src={light} alt="Tonite" className={`only-light ${className}`} style={style} />
      <img src={dark} alt="Tonite" className={`only-dark ${className}`} style={style} />
    </>
  )
  if (!href) return logo
  return (
    // Zone de tap d'au moins 40 px de haut, léger retour visuel à l'appui
    <Link href={href} aria-label="Tonite, retour à l'accueil"
      className="inline-flex items-center justify-center min-h-10 px-2 rounded-lg transition-opacity active:opacity-60"
      style={{ WebkitTapHighlightColor: 'transparent' }}>
      {logo}
    </Link>
  )
}
