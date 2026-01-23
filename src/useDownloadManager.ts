import { useState, useCallback, useEffect, useRef } from 'react'
import { Platform, Linking } from 'react-native'
import { AppUpdater } from './NativeAppUpdater'
import { AppUpdaterError } from './AppUpdaterError'
import type { UpdateState, AppUpdaterEvent } from './types'

export function useDownloadManager(
  updateState: UpdateState,
  debugMode: boolean,
  iosStoreId: string,
  emitEvent: (event: AppUpdaterEvent) => void,
  onDownloadComplete?: () => void
) {
  const [downloadProgress, setDownloadProgress] = useState({ bytesDownloaded: 0, totalBytes: 0, percent: 0 })
  const [isDownloadComplete, setIsDownloadComplete] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const completeUpdate = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        await AppUpdater.completeFlexibleUpdate()
      } catch (e) {
        const error = AppUpdaterError.fromNative(e)
        emitEvent({ type: 'update_dismissed', payload: { error } })
      }
    }
  }, [emitEvent])

  const startUpdate = useCallback(async () => {
    if (isDownloadComplete) return

    emitEvent({ type: 'update_accepted', payload: {} })

    if (debugMode) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      
      let mockPercent = 0
      intervalRef.current = setInterval(() => {
        mockPercent += 10
        const bytesDownloaded = mockPercent * 1000
        const totalBytes = 1000 * 1000
        setDownloadProgress({ bytesDownloaded, totalBytes, percent: mockPercent })
        
        if (mockPercent >= 100) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          emitEvent({ type: 'update_downloaded', payload: {} })
          setIsDownloadComplete(true)
          onDownloadComplete?.()
        }
      }, 500)
      return
    }

    if (Platform.OS === 'android') {
      try {
        if (updateState.critical) {
          await AppUpdater.startInAppUpdate(true)
        } else {
          await AppUpdater.startFlexibleUpdate((bytesDownloaded, totalBytes) => {
            const percent = totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0
            setDownloadProgress({ bytesDownloaded, totalBytes, percent })
            if (percent === 100) {
              emitEvent({ type: 'update_downloaded', payload: {} })
              setIsDownloadComplete(true)
              onDownloadComplete?.()
            }
          })
        }
      } catch (e) {
        const error = AppUpdaterError.fromNative(e)
        emitEvent({ type: 'update_dismissed', payload: { error } })
      }
    } else {
      const url = updateState.trackViewUrl || (iosStoreId ? `itms-apps://itunes.apple.com/app/id${iosStoreId}` : null)
      if (url) {
        Linking.openURL(url)
      } else {
        const appId = AppUpdater.getBundleId()
        Linking.openURL(`itms-apps://itunes.apple.com/app/id${encodeURIComponent(appId)}`)
      }
    }
  }, [updateState, debugMode, iosStoreId, emitEvent, onDownloadComplete, isDownloadComplete])

  return {
    downloadProgress,
    isDownloadComplete,
    startUpdate,
    completeUpdate
  }
}
