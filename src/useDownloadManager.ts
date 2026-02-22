import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type { MutableRefObject } from 'react'
import { Platform } from 'react-native'
import { AppUpdater } from './NativeAppUpdater'
import { AppUpdaterError } from './AppUpdaterError'
import { AppUpdaterEvent, UpdateState } from './types'

/**
 * Manages the download and installation lifecycle of app updates.
 * Handles Android flexible/immediate updates and iOS store redirects.
 *
 * @returns `startUpdate` — begin the update, `completeUpdate` — install a downloaded flexible update,
 *          `downloadProgress` — current progress, `isDownloading` / `isDownloadComplete` — status flags.
 */
export function useDownloadManager(
  updateState: UpdateState,
  onDownloadCompleteRef?: MutableRefObject<(() => void) | undefined>,
  emitEvent?: (event: AppUpdaterEvent) => void,
  iosStoreId?: string,
  debugMode: boolean = false
) {
  const [downloadProgress, setDownloadProgress] = useState({ bytesDownloaded: 0, totalBytes: 0, percent: 0 })
  const [isDownloading, _setIsDownloading] = useState(false)
  const [isReadyToInstall, _setIsReadyToInstall] = useState(false)

  // Guard refs kept in sync with state to enable stable useCallback identity
  const isDownloadingRef = useRef(false)
  const isReadyToInstallRef = useRef(false)
  const setIsDownloading = useCallback((v: boolean) => { isDownloadingRef.current = v; _setIsDownloading(v) }, [])
  const setIsReadyToInstall = useCallback((v: boolean) => { isReadyToInstallRef.current = v; _setIsReadyToInstall(v) }, [])

  const flexIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startFlexibleUpdate = useCallback(async () => {
    try {
      if (debugMode) {
        if (flexIntervalRef.current) clearInterval(flexIntervalRef.current)
        
        let mockPercent = 0
        flexIntervalRef.current = setInterval(() => {
          mockPercent += 10
          setDownloadProgress({ 
            bytesDownloaded: mockPercent * 1000, 
            totalBytes: 1000 * 1000, 
            percent: Math.min(mockPercent, 100) 
          })
          
          if (mockPercent >= 100) {
            if (flexIntervalRef.current) clearInterval(flexIntervalRef.current)
            emitEvent?.({ type: 'update_downloaded', payload: {} })
            setIsReadyToInstall(true)
            setIsDownloading(false)
            onDownloadCompleteRef?.current?.()
          }
        }, 500)
        return
      }

      let lastPercent = -1
      await AppUpdater.startFlexibleUpdate((bytesDownloaded, totalBytes) => {
        const percent = totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0
        
        if (percent !== lastPercent || percent === 100) {
          lastPercent = percent
          setDownloadProgress({ bytesDownloaded, totalBytes, percent })
          
          if (percent === 100) {
            emitEvent?.({ type: 'update_downloaded', payload: {} })
            setIsReadyToInstall(true)
            setIsDownloading(false)
            onDownloadCompleteRef?.current?.()
          }
        }
      })
    } catch (e: unknown) {
      emitEvent?.({
        type: 'update_failed',
        payload: { error: AppUpdaterError.fromNative(e) }
      })
      setIsDownloading(false)
    }
  }, [debugMode, emitEvent, onDownloadCompleteRef, setIsDownloading, setIsReadyToInstall])

  const completeUpdate = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        await AppUpdater.completeFlexibleUpdate()
      } catch (e) {
        emitEvent?.({
          type: 'update_failed',
          payload: { error: AppUpdaterError.fromNative(e) }
        })
      }
    }
  }, [emitEvent])

  const { available, critical, trackViewUrl } = updateState

  const startUpdate = useCallback(async () => {
    if (isDownloadingRef.current || isReadyToInstallRef.current) return

    try {
      emitEvent?.({ type: 'update_accepted', payload: {} })
      
      if (Platform.OS === 'ios') {
        if (trackViewUrl) {
          const match = trackViewUrl.match(/id(\d+)/)
          const storeId = match ? match[1] : iosStoreId
          if (storeId) {
            await AppUpdater.openStore(storeId)
          } else {
            throw new Error('No store ID available for iOS update')
          }
        } else if (iosStoreId) {
          await AppUpdater.openStore(iosStoreId)
        } else {
          throw new Error('No store info available for iOS update')
        }
      } else {
        // Android
        if (available) {
          if (critical) {
            setIsDownloading(true)
            await AppUpdater.startInAppUpdate()
            setIsDownloading(false)
          } else {
            setIsDownloading(true)
            await startFlexibleUpdate()
          }
        }
      }
    } catch (e: unknown) {
      emitEvent?.({
        type: 'update_failed',
        payload: { error: AppUpdaterError.fromNative(e) }
      })
      setIsDownloading(false)
    }
  }, [available, critical, trackViewUrl, iosStoreId, startFlexibleUpdate, emitEvent, setIsDownloading])

  useEffect(() => {
    return () => {
      if (flexIntervalRef.current) {
        clearInterval(flexIntervalRef.current)
      }
    }
  }, [])

  return useMemo(() => ({
    startUpdate,
    completeUpdate,
    downloadProgress,
    isDownloading,
    isDownloadComplete: isReadyToInstall
  }), [startUpdate, completeUpdate, downloadProgress, isDownloading, isReadyToInstall])
}
