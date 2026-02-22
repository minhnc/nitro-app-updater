import { compareVersions, checkIOSUpdate } from '../src/versionCheck';

describe('compareVersions', () => {
  it('compares standard versions correctly', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
  });

  it('handles different lengths', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0); // 1.0 is treated as 1.0.0
    expect(compareVersions('1.0.0', '1.0')).toBe(0);
    expect(compareVersions('1.1', '1.0.1')).toBe(1);
  });

  it('handles non-numeric segments gracefully', () => {
    expect(compareVersions('1.0.0-beta', '1.0.0-alpha')).toBe(1); // beta > alpha
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
  });
  
  it('treats numeric segments as numbers not strings', () => {
    expect(compareVersions('1.0.10', '1.0.2')).toBe(1); // 10 > 2
  });

  it('handles mixed numeric and string segments', () => {
     // Pre-release handling: 1.0.0-beta should compare correctly
     // SemVer: 1.0.0 > 1.0.0-beta
     expect(compareVersions('1.0.0', '1.0.0-beta')).toBe(1);
     expect(compareVersions('1.0.0-beta', '1.0.0')).toBe(-1);
  });
});

describe('checkIOSUpdate', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should handle successful iTunes API response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        resultCount: 1,
        results: [{ version: '1.2.0', trackViewUrl: 'url', releaseNotes: 'notes' }]
      })
    })

    const result = await checkIOSUpdate('bundle', 'us')
    expect(result).toEqual({
      version: '1.2.0',
      trackViewUrl: 'url',
      minimumOsVersion: '0',
      releaseNotes: 'notes'
    })
  })

  it('should return null if no results found', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ resultCount: 0, results: [] })
    })

    const result = await checkIOSUpdate('bundle', 'us')
    expect(result).toBeNull()
  })

  it('should throw error if fetch fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500
    })

    await expect(checkIOSUpdate('bundle', 'us')).rejects.toThrow('iTunes API failed with status 500')
  })

  it('should throw on timeout', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (...args: any[]) => new Promise((resolve, reject) => {
        const signal = args[1]?.signal as AbortSignal | undefined;
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      })
    );

    const checkPromise = checkIOSUpdate('bundle', 'us');
    jest.advanceTimersByTime(10500); // Exceed 10s timeout
    await expect(checkPromise).rejects.toThrow('iTunes API request timed out');
  })

  it('should throw on empty bundleId', async () => {
    await expect(checkIOSUpdate('', 'us')).rejects.toThrow('Bundle ID is empty or invalid')
  })

  it('should wrap network errors as iTunes API failed', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new TypeError('Network request failed'))
    await expect(checkIOSUpdate('bundle', 'us')).rejects.toThrow('Network request failed')
  })
})
