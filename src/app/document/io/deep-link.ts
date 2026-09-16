// openpencil://open?file=<relative>&node=<name>. The file is resolved against the
// paths of the open tabs by whole trailing segments, so a one-segment file takes
// the first open tab whose path ends with it. Otherwise the user picks it once
// per link and the pick must end with the same relative path. The opened file
// lands in the recent-files list like any other file opened from the app. No fs
// scope is widened here: the dialog plugin scopes what it returns, and nothing
// else is ever read from disk.
import { notificationMessages } from '@/app/i18n/notifications'
import { chooseTauriOpenPaths, openFileFromPath } from '@/app/shell/menu/files'

export interface DeepLinkTarget {
  path: string
  node?: string
}

export interface DeepLinkActions {
  /** Absolute paths of the documents currently open in tabs. */
  openPaths: () => string[]
  /** Selects the node and zooms to it. False when no node carries that name. */
  selectByName: (name: string) => boolean
  notify: (message: string) => void
}

/** A link is attacker-supplied text; a toast is not a place for 4 KB of it. */
export function clamp(value: string): string {
  return value.length > 120 ? `${value.slice(0, 119)}…` : value
}

function endsWithSegments(absolute: string, relative: string): boolean {
  const a = absolute.replaceAll('\\', '/')
  const r = relative.replaceAll('\\', '/')
  return a === r || a.endsWith(`/${r}`)
}

export function resolveDeepLinkFile(file: string, openPaths: string[]): string | null {
  return openPaths.find((path) => endsWithSegments(path, file)) ?? null
}

/** File-system entry points, injected so tests can drive the picker branch. */
interface DeepLinkIo {
  choosePaths: () => Promise<string[]>
  openPath: (path: string) => Promise<void>
}

const tauriIo: DeepLinkIo = {
  choosePaths: chooseTauriOpenPaths,
  openPath: openFileFromPath
}

export async function openDeepLink(
  target: DeepLinkTarget,
  actions: DeepLinkActions,
  io: DeepLinkIo = tauriIo
): Promise<void> {
  const messages = notificationMessages.get()
  let path = resolveDeepLinkFile(target.path, actions.openPaths())
  if (!path) {
    actions.notify(messages.deepLinkLocateFile({ file: clamp(target.path) }))
    path = resolveDeepLinkFile(target.path, await io.choosePaths())
    if (!path) {
      actions.notify(messages.deepLinkCancelled({ file: clamp(target.path) }))
      return
    }
  }
  // Re-opening an already open path focuses its tab instead of duplicating it.
  await io.openPath(path)
  if (target.node && !actions.selectByName(target.node)) {
    actions.notify(
      messages.deepLinkNodeNotFound({ node: clamp(target.node), file: clamp(target.path) })
    )
  }
}
