import { useEffect, useState } from 'react'

/**
 * Observa uma media query e retorna se ela corresponde ao viewport atual.
 * Atualiza automaticamente ao redimensionar / girar o dispositivo.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** Verdadeiro em telas estreitas (< 640px — breakpoint `sm` do Tailwind). */
export function useIsNarrow(): boolean {
  return useMediaQuery('(max-width: 639px)')
}
