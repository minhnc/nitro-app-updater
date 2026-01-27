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
  const [isDownloading, setIsDownloading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const emitEventRef = useRef(emitEvent)
  const onDownloadCompleteRef = useRef(onDownloadComplete)

  useEffect(() => {
    emitEventRef.current = emitEvent
    onDownloadCompleteRef.current = onDownloadComplete
  }, [emitEvent, onDownloadComplete])

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
        emitEventRef.current({ type: 'update_dismissed', payload: { error } })
      }
    }
  }, [])

  const startUpdate = useCallback(async () => {
    if (isDownloadComplete || isDownloading) return

    setIsDownloading(true)
    emitEventRef.current({ type: 'update_accepted', payload: {} })

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
          emitEventRef.current({ type: 'update_downloaded', payload: {} })
          setIsDownloadComplete(true)
          setIsDownloading(false)
          onDownloadCompleteRef.current?.()
        }
      }, 500)
      return
    }

    if (Platform.OS === 'android') {
      try {
        if (updateState.critical) {
          await AppUpdater.startInAppUpdate(true)
          setIsDownloading(false) // For immediate update, it finishes when this returns or app restarts
        } else {
          await AppUpdater.startFlexibleUpdate((bytesDownloaded, totalBytes) => {
            const percent = totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0
            setDownloadProgress({ bytesDownloaded, totalBytes, percent })
            if (percent === 100) {
              emitEventRef.current({ type: 'update_downloaded', payload: {} })
              setIsDownloadComplete(true)
              setIsDownloading(false)
              onDownloadCompleteRef.current?.()
            }
          })
        }
      } catch (e) {
        setIsDownloading(false)
        const error = AppUpdaterError.fromNative(e)
        emitEventRef.current({ type: 'update_dismissed', payload: { error } })
      }
    } else {
      setIsDownloading(false)
      const url = updateState.trackViewUrl || (iosStoreId ? `itms-apps://itunes.apple.com/app/id${iosStoreId}` : null)
      if (url) {
        Linking.openURL(url)
      } else {
        // Log error in dev - it's impossible to redirect to store without a numeric ID
        if (__DEV__) {
          console.error('[AppUpdater] Cannot redirect to App Store: No numeric "iosStoreId" provided and the automated update check failed to return a store URL. Please ensure iosStoreId is configured in your UpdatePrompt config.')
        }
      }
    }
  }, [updateState, debugMode, iosStoreId, isDownloadComplete, isDownloading])

  return {
    downloadProgress,
    isDownloadComplete,
    isDownloading,
    startUpdate,
    completeUpdate
  }
}
