import type { SceneGraph } from '@open-pencil/scene-graph'

/** What focusing needs from the editor, so a caller can drive it without a whole store. */
export interface FocusStore {
  graph: Pick<SceneGraph, 'getChildren' | 'getNode' | 'getPages'>
  state: { currentPageId: string }
  select: (ids: string[]) => void
  zoomToSelection: () => void
  /** Loads a page's layers without showing it; imported pages load them on first visit. */
  loadPageNodes: (pageId: string) => Promise<void>
  switchPage: (pageId: string) => Promise<void>
}

/**
 * Ids of the nodes named exactly `name` on the current page, in document order.
 *
 * Exact and case-sensitive on purpose: a link names one layer, where the `find_nodes`
 * tool offers the forgiving search a person does by hand.
 */
export function findNodesByName(
  graph: FocusStore['graph'],
  rootId: string,
  name: string
): string[] {
  const matches: string[] = []
  const walk = (parentId: string) => {
    for (const child of graph.getChildren(parentId)) {
      if (child.name === name) matches.push(child.id)
      walk(child.id)
    }
  }
  walk(rootId)
  return matches
}

/**
 * Selects the nodes and zooms to them. False when none of the ids is in the document,
 * so a caller holding a stale id can tell that nothing was brought into view.
 */
export function focusNodes(store: FocusStore, ids: readonly string[]): boolean {
  const present = ids.filter((id) => store.graph.getNode(id) !== undefined)
  if (present.length === 0) return false
  store.select(present)
  store.zoomToSelection()
  return true
}

/**
 * Focuses every node with that exact name on the current page, or else on the first
 * other page that carries it, switching to that page. Other pages are loaded without
 * being shown, so a miss leaves the view where it was.
 */
export async function focusNodesByName(store: FocusStore, name: string): Promise<boolean> {
  const here = findNodesByName(store.graph, store.state.currentPageId, name)
  if (here.length > 0) return focusNodes(store, here)
  for (const page of store.graph.getPages()) {
    if (page.id === store.state.currentPageId) continue
    await store.loadPageNodes(page.id)
    const ids = findNodesByName(store.graph, page.id, name)
    if (ids.length === 0) continue
    await store.switchPage(page.id)
    return focusNodes(store, ids)
  }
  return false
}
