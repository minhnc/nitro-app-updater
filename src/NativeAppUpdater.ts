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

/**
 * Accessor for the native AppUpdater module.
 * Preferred usage is via the useAppUpdater() hook.
 */
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
