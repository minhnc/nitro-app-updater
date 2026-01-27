// Utility file for version comparison


/**
 * Compares two semantic version strings.
 * Handles numeric (1.2.3) and pre-release parts (1.0.0-beta.1).
 * Returns:
 * - 1 if v1 > v2
 * - -1 if v1 < v2
 * - 0 if v1 == v2
 */
export function compareVersions(v1: string, v2: string): number {
  // Split by dot or hyphen to handle 1.0.0-beta.1 -> ["1", "0", "0", "beta", "1"]
  // This is a simple strategy: stricter semver parsing might be needed for complex cases,
  // but this covers standard X.Y.Z and X.Y.Z-suffix patterns.
  const splitVersion = (v: string) => v.split(/[.-]/).filter(Boolean)
  
  const parts1 = splitVersion(v1)
  const parts2 = splitVersion(v2)
  const len = Math.max(parts1.length, parts2.length)

  for (let i = 0; i < len; i++) {
    const p1Raw = parts1[i]
    const p2Raw = parts2[i]

    // If one is shorter: "1.0" < "1.0.1" usually, but "1.0" > "1.0-beta" is tricky.
    // Commonly in semver: 1.0.0 > 1.0.0-beta. 
    // If we run out of parts, the longer one usually wins, UNLESS it's a pre-release (-) attached.
    // However, our split logic treats '-' as a separator. 
    // Let's stick to a simple alphanumeric comparison for segments.
    
    const p1Num = parseInt(p1Raw || '', 10)
    const p2Num = parseInt(p2Raw || '', 10)
    
    const p1IsNum = p1Raw !== undefined && !isNaN(p1Num) && String(p1Num) === p1Raw
    const p2IsNum = p2Raw !== undefined && !isNaN(p2Num) && String(p2Num) === p2Raw

    if (p1IsNum && p2IsNum) {
      if (p1Num > p2Num) return 1
      if (p1Num < p2Num) return -1
    } else {
      // String comparison for non-numeric parts (pre-release)
      // OR one version has run out of parts (undefined)
      
      if (p1Raw === undefined && p2Raw === undefined) return 0
      
      // If one is undefined, we need to determine if it's a release vs pre-release case
      if (p1Raw === undefined) {
        // v1 ended. If v2's next part is non-numeric, v1 is a release version and v2 is pre-release.
        // SemVer: Release > Pre-release (1.0.0 > 1.0.0-alpha)
        return p2IsNum ? -1 : 1
      }
      if (p2Raw === undefined) {
        // v2 ended. Reverse of above.
        return p1IsNum ? 1 : -1
      }

      // Both are defined, perform lexical comparison
      if (p1Raw > p2Raw) return 1
      if (p1Raw < p2Raw) return -1
    }
  }
  return 0
}

interface iTunesResult {
  version: string
  trackViewUrl: string
  releaseNotes?: string
}

export async function checkIOSUpdate(bundleId: string, country = 'us'): Promise<iTunesResult | null> {
  // Allow errors to bubble up to useUpdateManager for proper handling
  const url = `https://itunes.apple.com/lookup?bundleId=${bundleId}&country=${country}&t=${Date.now()}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`iTunes API failed with status ${response.status}`)
  }
  const data = await response.json()
  
  if (data.resultCount > 0) {
    const result = data.results[0]
    return {
      version: result.version,
      trackViewUrl: result.trackViewUrl,
      releaseNotes: result.releaseNotes
    }
  }
  
  return null
}
