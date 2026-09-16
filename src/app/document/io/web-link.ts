// https://app.openpencil.dev/?file=<https url>&node=<name> — the browser twin of the
// desktop `openpencil://open` link. The desktop variant resolves a repo-relative path
// against open tabs; the web app has no filesystem, so `file` is an absolute `https:`
// URL the browser fetches cross-origin, without credentials and without following a
// redirect. Nothing else is reachable: no `http:`, no `file:`, no other extension.
import { notificationMessages } from '@/app/i18n/notifications'
import { openBrowserFileFromURL } from '@/app/shell/menu/files'

export interface WebOpenParams {
  file: URL
  node?: string
}

export interface WebLinkActions {
  /** Selects the node and zooms to it. False when no node carries that name. */
  selectByName: (name: string) => boolean
  notify: (message: string) => void
}

/** A link is attacker-supplied text; a toast is not a place for 4 KB of it. */
function clamp(value: string): string {
  return value.length > 120 ? `${value.slice(0, 119)}…` : value
}

/**
 * Pure parser over `window.location.search`. Returns null when the link carries no
 * usable `file`; a present-but-refused `file` also warns once so the cause is visible
 * in the console instead of looking like a silent no-op.
 */
export function parseWebOpenParams(search: string): WebOpenParams | null {
  const params = new URLSearchParams(search)
  const file = params.get('file')
  if (!file) return null
  let url: URL
  try {
    url = new URL(file)
  } catch {
    console.warn('[Web link] refused a file that is not a URL:', clamp(file))
    return null
  }
  if (url.protocol !== 'https:' || !/\.(?:pen|fig)$/i.test(url.pathname)) {
    console.warn('[Web link] refused file, expected https and .pen or .fig:', clamp(file))
    return null
  }
  return { file: url, node: params.get('node') || undefined }
}

/** Fetch entry point, injected so tests can drive the failure branch. */
interface WebLinkIo {
  open: (url: URL) => Promise<void>
}

const browserIo: WebLinkIo = {
  // No cookies leave the app for a link-supplied host, and a redirect is refused
  // rather than followed, so an https URL cannot be bounced to a plaintext one.
  open: (url) => openBrowserFileFromURL(url, { credentials: 'omit', redirect: 'error' })
}

export async function openWebLink(
  target: WebOpenParams,
  actions: WebLinkActions,
  io: WebLinkIo = browserIo
): Promise<void> {
  const messages = notificationMessages.get()
  try {
    await io.open(target.file)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    actions.notify(messages.openFileFailed({ name: clamp(target.file.host), error: detail }))
    return
  }
  if (target.node && !actions.selectByName(target.node)) {
    actions.notify(
      messages.deepLinkNodeNotFound({ node: clamp(target.node), file: clamp(target.file.host) })
    )
  }
}

/**
 * Reads the link off the current URL and strips `file`/`node` as soon as they are read,
 * so a reload does not re-open the document and a copied URL carries no link payload.
 */
export async function openWebLinkFromLocation(actions: WebLinkActions): Promise<void> {
  const stripped = new URL(window.location.href)
  if (!stripped.searchParams.has('file') && !stripped.searchParams.has('node')) return
  const target = parseWebOpenParams(window.location.search)
  // A refused link is stripped too: it opened nothing, and leaving it in the address
  // bar would put it in the next copied URL. `history.state` carries the router's own
  // position state, so it is replaced with itself rather than dropped.
  stripped.searchParams.delete('file')
  stripped.searchParams.delete('node')
  history.replaceState(history.state, '', stripped)
  if (target) await openWebLink(target, actions)
}
