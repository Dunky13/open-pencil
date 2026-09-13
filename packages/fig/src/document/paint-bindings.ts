import { copyFills, copyStrokes, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

/** Resolve bound paint colors only after occurrence hierarchy and modes are available. */
export function applyDocumentPaintBindings(
  graph: SceneGraph,
  existingNodeIds: ReadonlySet<string>
): void {
  for (const node of graph.getAllNodes()) {
    if (existingNodeIds.has(node.id)) continue
    const changes: Partial<SceneNode> = {}
    for (const [field, id] of Object.entries(node.boundVariables)) {
      const match = /^(fills|strokes)\/(\d+)\/color$/.exec(field)
      if (!match) continue
      const kind = match[1] === 'fills' ? 'fills' : 'strokes'
      const index = Number(match[2])
      const color = graph.resolveColorVariableForNode(node.id, id)
      if (!color || !node[kind][index]) continue
      if (kind === 'fills') {
        changes.fills ??= copyFills(node.fills)
        changes.fills[index].color = { ...color }
      } else {
        changes.strokes ??= copyStrokes(node.strokes)
        changes.strokes[index].color = { ...color }
      }
    }
    if (Object.keys(changes).length) graph.updateNode(node.id, changes)
  }
}
