import {
  resolveAutomationTarget,
  responseWithTarget,
  type AutomationTarget
} from '@/app/automation/bridge/target'
import { resolveBrowserFileURL } from '@/app/document/io/browser'
import { MAX_REMOTE_DOCUMENT_BYTES, readBodyWithLimit } from '@/app/shell/menu/files'
import { openFileFromPath } from '@/app/shell/menu/use'
import { closeTab, createTab, getActiveStore, getTabById, openFileInNewTab } from '@/app/tabs'
import { isTauri } from '@/app/tauri/env'

export async function handleSaveFile(target: AutomationTarget, args: unknown): Promise<unknown> {
  const store = target.store
  const path = (args as { path?: string }).path
  if (path) {
    store.setPlannedFilePath(path)
    await ensureTauriParentDirectory(path)
  }
  await store.saveFigFile()
  if (path) store.startWatchingCurrentFile()
  return { ok: true }
}

export async function ensureTauriParentDirectory(path: string): Promise<void> {
  if (!isTauri()) return
  const [{ dirname }, { mkdir }] = await Promise.all([
    import('@tauri-apps/api/path'),
    import('@tauri-apps/plugin-fs')
  ])
  const dir = await dirname(path)
  if (dir === path) return
  await mkdir(dir, { recursive: true })
}

export async function handleCloseFile(target: AutomationTarget, _args: unknown): Promise<unknown> {
  await closeTab(target.documentId)
  return { ok: true, result: { closed: getTabById(target.documentId) === undefined } }
}

export async function handleNewDocument(
  _target: AutomationTarget,
  args: unknown
): Promise<unknown> {
  const path = (args as { path?: string }).path
  const tab = createTab()
  if (path) {
    tab.store.setPlannedFilePath(path)
    await ensureTauriParentDirectory(path)
    await tab.store.saveFigFile()
    tab.store.startWatchingCurrentFile()
  }
  const target = resolveAutomationTarget(tab.store, { document_id: tab.id })
  return responseWithTarget({ ok: true, result: { created: true } }, target)
}

export async function handleOpenFile(_target: AutomationTarget, args: unknown): Promise<unknown> {
  const path = (args as { path?: string }).path
  if (!path) throw new Error('Missing "path" in args')
  if (isTauri()) {
    await openFileFromPath(path)
  } else {
    const resourceURL = resolveBrowserFileURL(path)
    // Same 64 MiB ceiling as every other fetched document: an automation client is not
    // more trusted than a link, and buffering an unbounded body exhausts the tab either way.
    const controller = new AbortController()
    const response = await fetch(resourceURL, { signal: controller.signal })
    if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`)
    const name = resourceURL.pathname.split('/').pop() ?? 'file.fig'
    const blob = await readBodyWithLimit(response, MAX_REMOTE_DOCUMENT_BYTES, () =>
      controller.abort()
    )
    const file = new File([blob], name)
    await openFileInNewTab(file, undefined, resourceURL.href)
  }
  const target = resolveAutomationTarget(getActiveStore(), undefined)
  return responseWithTarget({ ok: true, result: { opened: true } }, target)
}
