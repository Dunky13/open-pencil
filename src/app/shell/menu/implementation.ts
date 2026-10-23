import { tryOnScopeDispose } from '@vueuse/core'
import { watch } from 'vue'

import type { EditorState } from '@open-pencil/core'

import {
  implementationSelection,
  type ImplementationSelectionStore
} from '@/app/integrations/storybook/selection'

type ImplementationMenuStore = ImplementationSelectionStore & {
  state: Pick<EditorState, 'sceneVersion'>
}

export async function setNativeImplementationMenuEnabled(enabled: boolean): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('set_native_menu_enabled', { id: 'selection.openImplementation', enabled })
}

/** Native menus do not consume the browser menu's computed disabled state. */
export function watchNativeImplementationMenu(
  store: ImplementationMenuStore,
  sync = setNativeImplementationMenuEnabled
): () => void {
  let pending = Promise.resolve()
  const update = (enabled: boolean) => {
    pending = pending
      .then(() => sync(enabled))
      .catch((error: unknown) => {
        console.warn('[Menu] Failed to update implementation story availability', error)
      })
  }
  const stop = watch(
    () => {
      void store.state.sceneVersion
      return !!implementationSelection(store)
    },
    update,
    { immediate: true }
  )
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    stop()
    update(false)
  }
  tryOnScopeDispose(dispose)
  return dispose
}
