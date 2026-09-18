import type { SceneGraph } from '@open-pencil/scene-graph'

import type { EditorStore } from '@/app/editor/active-store'

/**
 * Ids of the nodes named exactly `name` on the current page, in document order.
 *
 * Exact and case-sensitive on purpose: a link names one layer, where the `find_nodes`
 * tool offers the forgiving search a person does by hand.
 */
export function findNodesByName(graph: SceneGraph, rootId: string, name: string): string[] {
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

/** Selects every node with that name and zooms to the selection. False when none does. */
export function selectNodesByName(store: EditorStore, name: string): boolean {
  const matches = findNodesByName(store.graph, store.state.currentPageId, name)
  if (matches.length === 0) return false
  store.select(matches)
  store.zoomToSelection()
  return true
}
