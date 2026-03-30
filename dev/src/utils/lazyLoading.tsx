import { Suspense, lazy } from 'react'
import type { LazyExoticComponent, ReactNode } from 'react'

/**
 * Wrapper pour lazy loading avec fallback loading state
 * Réduit les rechargements inutiles lors du dev
 */
export const lazyWithSuspense = (
  component: () => Promise<{ default: any }>,
  fallback: ReactNode = <div>Chargement...</div>
) => {
  const LazyComponent = lazy(component)
  return {
    Component: LazyComponent,
    WithSuspense: (props: any) => (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}

/**
 * Cache les composants pour éviter rechargements multiples
 */
const componentCache = new Map<string, LazyExoticComponent<any>>()

export const getCachedLazy = (
  key: string,
  loader: () => Promise<{ default: any }>
): LazyExoticComponent<any> => {
  if (!componentCache.has(key)) {
    componentCache.set(key, lazy(loader))
  }
  return componentCache.get(key)!
}
