import { NitroModules } from 'react-native-nitro-modules'
import { type AppUpdater as AppUpdaterSpec } from './AppUpdater.nitro'

// Lazy instantiation to avoid startup overhead
let _appUpdater: AppUpdaterSpec | undefined
export function getAppUpdater(): AppUpdaterSpec {
  if (!_appUpdater) {
    _appUpdater = NitroModules.createHybridObject<AppUpdaterSpec>('AppUpdater')
  }
  return _appUpdater
}

// Export a proxy for backward compatibility if needed, but preferred usage is via getAppUpdater()
export const AppUpdater = new Proxy({} as AppUpdaterSpec, {
  get: (_target, prop) => {
    const hybridObject = getAppUpdater()
    const value = Reflect.get(hybridObject, prop)
    if (typeof value === 'function') {
      return value.bind(hybridObject)
    }
    return value
  }
})
export { useAppUpdater, type AppUpdaterConfig, type AppUpdaterEvent, type UpdateState } from './useAppUpdater'
export { UpdatePrompt, type UpdatePromptProps } from './UpdatePrompt'
export type { AppUpdateStatus } from './AppUpdater.nitro'
