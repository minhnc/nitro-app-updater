import React, { createContext, useContext, type ReactNode } from 'react'
import { useAppUpdater } from './useAppUpdater'
import type { AppUpdaterConfig } from './types'

type AppUpdaterContextType = ReturnType<typeof useAppUpdater>

const AppUpdaterContext = createContext<AppUpdaterContextType | null>(null)

/**
 * Provider to manage the app updater and smart review state globally.
 * Use this at the root of your app to make the updater available via `useAppUpdaterContext`.
 */
export function AppUpdaterProvider({
  config,
  children,
}: {
  config: AppUpdaterConfig
  children: ReactNode
}) {
  const updater = useAppUpdater(config)

  return (
    <AppUpdaterContext.Provider value={updater}>
      {children}
    </AppUpdaterContext.Provider>
  )
}

/**
 * Hook to access the app updater context.
 * Provides functions like recordWin, checkUpdate, and completeUpdate.
 * Must be used within an AppUpdaterProvider.
 */
export function useAppUpdaterContext() {
  const context = useContext(AppUpdaterContext)
  if (!context) {
    throw new Error(
      'useAppUpdaterContext must be used within AppUpdaterProvider',
    )
  }
  return context
}
