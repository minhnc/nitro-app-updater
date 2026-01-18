// Utility file for version comparison


/**
 * Compares two semantic version strings.
 * Returns:
 * - 1 if v1 > v2
 * - -1 if v1 < v2
 * - 0 if v1 == v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)
  const len = Math.max(parts1.length, parts2.length)

  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 > p2) return 1
    if (p1 < p2) return -1
  }
  return 0
}

interface iTunesResult {
  version: string
  trackViewUrl: string
  releaseNotes?: string
}

export async function checkIOSUpdate(bundleId: string, country = 'us'): Promise<iTunesResult | null> {
  try {
    const url = `https://itunes.apple.com/lookup?bundleId=${bundleId}&country=${country}&t=${Date.now()}`
    console.log('[AppUpdater] Checking iOS update via:', url)
    const response = await fetch(url)
    const data = await response.json()
    
    console.log(`[AppUpdater] iTunes results count: ${data.resultCount}`)
    
    if (data.resultCount > 0) {
      const result = data.results[0]
      return {
        version: result.version,
        trackViewUrl: result.trackViewUrl,
        releaseNotes: result.releaseNotes
      }
    }
  } catch (error) {
    console.warn('[AppUpdater] Failed to check iOS update:', error)
  }
  return null
}
