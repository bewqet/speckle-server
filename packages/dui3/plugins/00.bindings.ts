import { GenericBridge } from '~/lib/bridge/generic'
import { IRawBridge } from '~/lib/bridge/definitions'

import { IBaseBinding } from '~/lib/bindings/definitions/baseBindings'
import { SketchupBridge } from '~/lib/bridge/sketchup'
import { ITestBinding } from '~/lib/bindings/definitions/testBindings'

// Makes TS happy
declare let globalThis: Record<string, unknown> & {
  CefSharp?: { BindObjectAsync: (name: string) => Promise<void> }
  chrome?: { webview: { hostObjects: Record<string, IRawBridge> } }
  sketchup?: Record<string, unknown>
}

/**
 * Here we are loading any bindings that we expect to have from all
 * connectors. If some are not present, that's okay - we're going to
 * strip or customize functionality from the ui itself.
 */
export default defineNuxtPlugin(async () => {
  const testBindings = await tryHoistBinding<ITestBinding>('testBindings')
  const nonExistantBindings = await tryHoistBinding<IBaseBinding>('nonExistantBindings')

  const baseBinding = await tryHoistBinding<IBaseBinding>('baseBinding')

  return {
    provide: {
      testBindings,
      nonExistantBindings,
      baseBinding
    }
  }
})

/**
 * Checks possible browser window targets for a given binding, and, if it finds it,
 * creates a bridge for it and registers it in the global scope.
 * @param name binding name
 * @returns null if the binding was not found, or the binding.
 */
const tryHoistBinding = async <T>(name: string) => {
  let bridge: GenericBridge | SketchupBridge | null = null
  let tempBridge: GenericBridge | SketchupBridge | null = null

  if (globalThis.CefSharp) {
    await globalThis.CefSharp.BindObjectAsync(name)
    tempBridge = new GenericBridge(globalThis[name] as unknown as IRawBridge)
  }

  if (globalThis.chrome && globalThis.chrome.webview && !tempBridge) {
    tempBridge = new GenericBridge(globalThis.chrome.webview.hostObjects[name])
  }

  if (globalThis.sketchup && !tempBridge) {
    tempBridge = new SketchupBridge(name)
  }

  const res = await tempBridge?.create()
  if (res) bridge = tempBridge

  if (!bridge) console.warn(`Failed to bind ${name} binding.`)

  globalThis[name] = bridge
  return bridge as unknown as T
}
