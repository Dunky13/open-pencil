// openpencil://open?file=<relative>&node=<name>. The file is resolved against the
// paths of the open tabs, else the user picks it once per link. No path is
// remembered and no fs scope is widened here: the dialog plugin scopes what it
// returns, and nothing else is ever read from disk.
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

function endsWithSegments(absolute: string, relative: string): boolean {
  const a = absolute.replaceAll('\\', '/')
  const r = relative.replaceAll('\\', '/')
  return a === r || a.endsWith(`/${r}`)
}

export function resolveDeepLinkFile(file: string, openPaths: string[]): string | null {
  return openPaths.find((path) => endsWithSegments(path, file)) ?? null
}

export async function openDeepLink(
  target: DeepLinkTarget,
  actions: DeepLinkActions
): Promise<void> {
  const messages = notificationMessages.get()
  let path = resolveDeepLinkFile(target.path, actions.openPaths())
  if (!path) {
    actions.notify(messages.deepLinkLocateFile({ file: target.path }))
    path = resolveDeepLinkFile(target.path, await chooseTauriOpenPaths())
    if (!path) {
      actions.notify(messages.deepLinkCancelled({ file: target.path }))
      return
    }
  }
  // Re-opening an already open path focuses its tab instead of duplicating it.
  await openFileFromPath(path)
  if (target.node && !actions.selectByName(target.node)) {
    actions.notify(messages.deepLinkNodeNotFound({ node: target.node, file: target.path }))
  }
}
