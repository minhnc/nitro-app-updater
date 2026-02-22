import { AppUpdaterError, AppUpdaterErrorCode } from './AppUpdaterError'


/**
 * Compares two semantic version strings.
 * Handles numeric (1.2.3) and pre-release parts (1.0.0-beta.1).
 * Returns:
 * - 1 if v1 > v2
 * - -1 if v1 < v2
 * - 0 if v1 == v2
 */
export function compareVersions(v1: string, v2: string): number {
  // Split into [release, preRelease?]
  const [rel1 = '', pre1] = v1.split('-', 2)
  const [rel2 = '', pre2] = v2.split('-', 2)

  const parts1 = rel1.split('.').filter(Boolean)
  const parts2 = rel2.split('.').filter(Boolean)
  const len = Math.max(parts1.length, parts2.length)

  // Compare release parts numerically
  for (let i = 0; i < len; i++) {
    const p1Raw = parts1[i]
    const p2Raw = parts2[i]
    const n1 = parseInt(p1Raw || '0', 10)
    const n2 = parseInt(p2Raw || '0', 10)
    
    if (n1 > n2) return 1
    if (n1 < n2) return -1
  }

  // Release parts are equal -> compare pre-release
  // No pre-release > has pre-release (1.0.0 > 1.0.0-beta)
  if (!pre1 && pre2) return 1
  if (pre1 && !pre2) return -1
  if (!pre1 && !pre2) return 0

  // Both have pre-release — compare dot-separated identifiers
  const preParts1 = pre1!.split('.')
  const preParts2 = pre2!.split('.')
  const preLen = Math.max(preParts1.length, preParts2.length)

  for (let i = 0; i < preLen; i++) {
    const a = preParts1[i]
    const b = preParts2[i]
    
    // Shorter set of pre-release identifiers is lower priority? 
    // Spec says: "A larger set of pre-release fields has a higher precedence than a smaller set, if all of the preceding identifiers are equal."
    // e.g. 1.0.0-alpha.1 > 1.0.0-alpha
    if (a === undefined && b !== undefined) return -1
    if (a !== undefined && b === undefined) return 1
    
    const aNum = parseInt(a!, 10)
    const bNum = parseInt(b!, 10)
    const aIsNum = !isNaN(aNum) && String(aNum) === a
    const bIsNum = !isNaN(bNum) && String(bNum) === b
    
    if (aIsNum && bIsNum) {
      if (aNum > bNum) return 1
      if (aNum < bNum) return -1
    } else {
      // Numeric < alphabetic in semver (identifiers consisting of only digits are compared numerically)
      // Identifiers with letters or hyphens are compared lexically in ASCII sort order.
      // Numeric identifiers always have lower precedence than non-numeric identifiers.
      if (aIsNum && !bIsNum) return -1
      if (!aIsNum && bIsNum) return 1
      if (a! > b!) return 1
      if (a! < b!) return -1
    }
  }
  return 0
}

export interface ITunesLookupResult {
  version: string
  trackViewUrl: string
  minimumOsVersion: string
  releaseNotes?: string
}

export async function checkIOSUpdate(bundleId: string, country = 'us', timeout = 10000): Promise<ITunesLookupResult | null> {
  // Validate bundleId
  if (!bundleId || bundleId.trim() === '') {
    throw new AppUpdaterError(AppUpdaterErrorCode.STORE_ERROR, 'Bundle ID is empty or invalid')
  }

  // Allow errors to bubble up to useUpdateManager for proper handling
  // Fetch from iTunes API (timestamp removed to allow HTTP caching)
  const url = `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}&country=${encodeURIComponent(country)}`
  
  // Abort request after timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout) // Use configurable timeout
  
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new AppUpdaterError(
        AppUpdaterErrorCode.NETWORK_ERROR, 
        `iTunes API failed with status ${response.status}`
      )
    }
    const data = (await response.json()) as Record<string, unknown>
    
    if (!data || !Array.isArray(data.results) || data.results.length === 0) {
      // In versionCheck.ts, we don't have access to debugMode. Just return null.
      return null
    }

    const result = data.results[0] as { 
      version?: unknown; 
      trackViewUrl?: string; 
      releaseNotes?: string;
      minimumOsVersion?: string;
    }

    if (!result?.version || typeof result.version !== 'string') return null
    
    return {
      version: result.version,
      trackViewUrl: typeof result.trackViewUrl === 'string' ? result.trackViewUrl : '',
      minimumOsVersion: typeof result.minimumOsVersion === 'string' ? result.minimumOsVersion : '0',
      releaseNotes: typeof result.releaseNotes === 'string' ? result.releaseNotes : undefined
    }
  } catch (e: unknown) {
    if (e instanceof AppUpdaterError) throw e
    if (e instanceof Error && e.name === 'AbortError') {
      throw new AppUpdaterError(AppUpdaterErrorCode.NETWORK_ERROR, 'iTunes API request timed out')
    }
    throw new AppUpdaterError(
      AppUpdaterErrorCode.NETWORK_ERROR,
      e instanceof Error ? e.message : String(e)
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
