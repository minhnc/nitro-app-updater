import { NitroModules } from 'react-native-nitro-modules'
import { type AppUpdater as AppUpdaterSpec } from './AppUpdater.nitro'
import { AppUpdaterError, AppUpdaterErrorCode } from './AppUpdaterError'

// Lazy instantiation to avoid startup overhead
let _appUpdater: AppUpdaterSpec | undefined

export function getAppUpdater(): AppUpdaterSpec {
  if (!_appUpdater) {
    _appUpdater = NitroModules.createHybridObject<AppUpdaterSpec>('AppUpdater')
  }
  return _appUpdater
}

/**
 * Accessor for the native AppUpdater module.
 * Preferred usage is via the useAppUpdater() hook.
 */
export const AppUpdater = new Proxy({} as AppUpdaterSpec, {
  get: (_target, prop) => {
    try {
      const hybridObject = getAppUpdater()
      const value = Reflect.get(hybridObject, prop)
      if (typeof value === 'function') {
        return value.bind(hybridObject)
      }
      return value
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : String(e)
      throw new AppUpdaterError(
        AppUpdaterErrorCode.NOT_SUPPORTED,
        `Native module "AppUpdater" is not available. Did you run pod install / rebuild? (${detail})`
      )
    }
  }
})
