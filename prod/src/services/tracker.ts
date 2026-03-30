// ─── Service de tracking des actions utilisateur ────────────────────
// Envoie les événements au backend via POST /api/auth/track
// Utilise un buffer + debounce pour les événements fréquents (navigation)

const TOKEN_KEY = 'magic_token'

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

interface TrackEvent {
  action: string
  resource?: string
  details?: Record<string, unknown>
}

// Buffer pour les événements rapides (navigation)
let buffer: TrackEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function flush() {
  if (buffer.length === 0) return
  const events = [...buffer]
  buffer = []
  flushTimer = null

  // Envoyer chaque événement (on pourrait batcher côté serveur plus tard)
  const token = getToken()
  if (!token) return

  for (const evt of events) {
    fetch('/api/auth/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(evt),
    }).catch(() => {})  // silencieux en cas d'erreur
  }
}

/**
 * Track une action utilisateur.
 * @param action  - Code de l'action (ex: PAGE_VIEW, SEARCH, EXPORT_START, etc.)
 * @param resource - Ressource concernée (ex: nom du module, terme de recherche)
 * @param details  - Détails supplémentaires (filtres, paramètres, etc.)
 * @param immediate - Si true, envoie immédiatement (pas de buffer)
 */
export function track(
  action: string,
  resource?: string,
  details?: Record<string, unknown>,
  immediate = false
) {
  const evt: TrackEvent = { action }
  if (resource) evt.resource = resource
  if (details && Object.keys(details).length > 0) evt.details = details

  if (immediate) {
    const token = getToken()
    if (!token) return
    fetch('/api/auth/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(evt),
    }).catch(() => {})
    return
  }

  buffer.push(evt)
  if (!flushTimer) {
    flushTimer = setTimeout(flush, 300)
  }
}

// ─── Raccourcis pratiques ────────────────────────────────────────────

/** Navigation vers une page / module */
export function trackPageView(module: string, details?: Record<string, unknown>) {
  track('PAGE_VIEW', module, details)
}

/** Recherche effectuée */
export function trackSearch(query: string, module: string, resultCount?: number) {
  track('SEARCH', module, { query, ...(resultCount !== undefined && { resultCount }) })
}

/** Filtre appliqué */
export function trackFilter(module: string, filters: Record<string, unknown>) {
  track('FILTER', module, filters)
}

/** Export de données */
export function trackExport(format: string, module: string, details?: Record<string, unknown>) {
  track('EXPORT', module, { format, ...details }, true)
}

/** Consultation d'une fiche client */
export function trackClientView(clientId: string, module: string) {
  track('CLIENT_VIEW', module, { clientId }, true)
}

/** Interaction avec un graphique / tableau (drill-down, tri, etc.) */
export function trackInteraction(action: string, module: string, details?: Record<string, unknown>) {
  track(action, module, details)
}

/** Changement de période */
export function trackPeriodChange(period: { type: string; value: string | number; label?: string }) {
  track('PERIOD_CHANGE', 'global', period as Record<string, unknown>)
}

/** Changement de paramètre / setting */
export function trackSettingChange(setting: string, value: unknown) {
  track('SETTING_CHANGE', setting, { value }, true)
}

// ─── Tracking automatique de la durée de session ─────────────────
let sessionStart = Date.now()

export function trackSessionDuration() {
  const duration = Math.round((Date.now() - sessionStart) / 1000)
  track('SESSION_DURATION', 'global', { durationSeconds: duration }, true)
}

// Au déchargement de la page, envoyer les events en attente + durée session
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flush()
    trackSessionDuration()
    // Utiliser sendBeacon pour les derniers événements
    const token = getToken()
    if (token && buffer.length > 0) {
      for (const evt of buffer) {
        navigator.sendBeacon('/api/auth/track', new Blob(
          [JSON.stringify(evt)],
          { type: 'application/json' }
        ))
      }
    }
  })
}
