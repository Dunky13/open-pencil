import { afterEach, expect, spyOn, test } from 'bun:test'

import { effectScope, markRaw, nextTick, reactive } from 'vue'

import { createDeferred } from '@/app/runtime/deferred'
import {
  setNativeImplementationMenuEnabled,
  watchNativeImplementationMenu
} from '@/app/shell/menu/implementation'

import { firstPageId, makeSceneGraph } from '#tests/helpers/scene'
import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(clearTauriMocks)

test('native availability follows selection, saved identities, instance targets and scope disposal', async () => {
  const graph = makeSceneGraph()
  const component = graph.createNode('COMPONENT', firstPageId(graph))
  component.source.id = '42:9'
  const unsaved = graph.createNode('COMPONENT', firstPageId(graph))
  const instance = graph.createNode('INSTANCE', firstPageId(graph), {
    componentId: component.id
  })
  const store = reactive({
    graph: markRaw(graph),
    state: { selectedIds: new Set<string>(), sceneVersion: 0 }
  })
  const enabled: boolean[] = []
  let applied = createDeferred<undefined>()
  const scope = effectScope()
  scope.run(() =>
    watchNativeImplementationMenu(store, async (value) => {
      enabled.push(value)
      applied.resolve(undefined)
    })
  )
  const update = async (change: () => void) => {
    applied = createDeferred<undefined>()
    change()
    await nextTick()
    await applied.promise
  }
  try {
    await applied.promise
    expect(enabled).toEqual([false])
    await update(() => store.state.selectedIds.add(component.id))
    expect(enabled).toEqual([false, true])
    await update(() => {
      component.source.id = null
      store.state.sceneVersion++
    })
    expect(enabled).toEqual([false, true, false])
    await update(() => {
      component.source.id = '42:9'
      store.state.selectedIds.clear()
      store.state.selectedIds.add(instance.id)
      store.state.sceneVersion++
    })
    expect(enabled).toEqual([false, true, false, true])
    await update(() => {
      graph.updateNode(instance.id, { componentId: unsaved.id })
      store.state.sceneVersion++
    })
    expect(enabled).toEqual([false, true, false, true, false])
    await update(() => {
      store.state.selectedIds.clear()
      store.state.selectedIds.add(component.id)
    })
    expect(enabled.at(-1)).toBe(true)
  } finally {
    await update(() => scope.stop())
  }
  expect(enabled.at(-1)).toBe(false)
  const calls = enabled.length
  store.state.selectedIds.clear()
  await nextTick()
  expect(enabled).toHaveLength(calls)
})

test('native enabled updates use the owning menu IPC with its explicit item ID', async () => {
  let calls = 0
  await mockTauriIPC((command, args) => {
    expect(command).toBe('set_native_menu_enabled')
    expect(args).toEqual({ id: 'selection.openImplementation', enabled: calls === 1 })
    calls++
    return undefined
  })
  await setNativeImplementationMenuEnabled(false)
  await setNativeImplementationMenuEnabled(true)
  expect(calls).toBe(2)
})

for (const ending of ['selection change', 'scope disposal']) {
  test(`native updates wait for an earlier enable before disabling on ${ending}`, async () => {
    const graph = makeSceneGraph()
    const component = graph.createNode('COMPONENT', firstPageId(graph))
    component.source.id = '42:9'
    const store = reactive({
      graph: markRaw(graph),
      state: { selectedIds: new Set<string>(), sceneVersion: 0 }
    })
    const started = createDeferred<undefined>()
    const release = createDeferred<undefined>()
    const disabled = createDeferred<undefined>()
    const calls: boolean[] = []
    let applied: boolean | undefined
    const scope = effectScope()
    scope.run(() =>
      watchNativeImplementationMenu(store, async (enabled) => {
        calls.push(enabled)
        if (enabled) {
          started.resolve(undefined)
          await release.promise
        }
        applied = enabled
        if (!enabled && calls.length > 1) disabled.resolve(undefined)
      })
    )
    try {
      store.state.selectedIds.add(component.id)
      await started.promise
      if (ending === 'scope disposal') scope.stop()
      else store.state.selectedIds.clear()
      await nextTick()
      expect(calls).toEqual([false, true])
      release.resolve(undefined)
      await disabled.promise
      expect(calls).toEqual([false, true, false])
      expect(applied).toBe(false)
    } finally {
      release.resolve(undefined)
      scope.stop()
      await disabled.promise
    }
  })
}

test('a failed native enable does not prevent a later disable from synchronizing', async () => {
  const graph = makeSceneGraph()
  const component = graph.createNode('COMPONENT', firstPageId(graph))
  component.source.id = '42:9'
  const store = reactive({
    graph: markRaw(graph),
    state: { selectedIds: new Set<string>(), sceneVersion: 0 }
  })
  const started = createDeferred<undefined>()
  const release = createDeferred<undefined>()
  const disabled = createDeferred<undefined>()
  const calls: boolean[] = []
  const failure = new Error('Native transport failed')
  const warning = spyOn(console, 'warn').mockImplementation(() => undefined)
  const scope = effectScope()
  scope.run(() =>
    watchNativeImplementationMenu(store, async (enabled) => {
      calls.push(enabled)
      if (enabled) {
        started.resolve(undefined)
        await release.promise
      } else if (calls.length > 1) disabled.resolve(undefined)
    })
  )
  try {
    store.state.selectedIds.add(component.id)
    await started.promise
    store.state.selectedIds.clear()
    await nextTick()
    expect(calls).toEqual([false, true])
    release.reject(failure)
    await disabled.promise
    expect(calls).toEqual([false, true, false])
    expect(warning).toHaveBeenCalledWith(expect.any(String), failure)
  } finally {
    release.resolve(undefined)
    scope.stop()
    await disabled.promise
    warning.mockRestore()
  }
})
