/* eslint-disable @next/next/no-img-element */

// Logo adapté au thème : rose/vert en clair, noir/rose en sombre.
// Les deux versions sont dans la page ; le CSS (only-light / only-dark) affiche la bonne.
export default function ThemeLogo({
  variant = 'wordmark',
  className = '',
  style,
}: {
  variant?: 'full' | 'wordmark' // full = logo carré (accueil) ; wordmark = version recadrée (en-têtes)
  className?: string
  style?: React.CSSProperties
}) {
  const light = variant === 'full' ? '/logo_rose.png' : '/logo_wordmark.png'
  const dark = variant === 'full' ? '/logo_noir.png' : '/logo_wordmark_noir.png'
  return (
    <>
      <img src={light} alt="Tonite" className={`only-light ${className}`} style={style} />
      <img src={dark} alt="Tonite" className={`only-dark ${className}`} style={style} />
    </>
  )
}
