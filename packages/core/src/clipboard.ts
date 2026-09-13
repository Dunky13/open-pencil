import { inflateSync, deflateSync } from 'fflate'

import { isFigClipboardVisualType } from '@open-pencil/fig'
import { initCodec, getCompiledSchema, getSchemaBytes } from '@open-pencil/kiwi/fig/codec'
import type { GUID, NodeChange as KiwiNodeChange } from '@open-pencil/kiwi/fig/codec'
import { decodeBinarySchema, compileSchema, ByteBuffer } from '@open-pencil/kiwi/schema-runtime'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { appendVariableNodeChanges } from '#core/io/formats/fig/variable-export'

import { decodeBase64, decodeBase64Text, encodeBase64, encodeBase64Text } from './bytes'
import { shapeTextForClipboard } from './canvas/text/clipboard'
import { prepareClipboardImport } from './clipboard/fig-import'
import {
  sceneNodeToKiwi,
  buildFigKiwi,
  parseFigKiwiChunks,
  decompressFigKiwiDataAsync,
  makeDocumentNodeChange,
  makeCanvasNodeChange,
  buildFontDigestMap
} from './kiwi/fig/node-change/serialize'
import { randomInt } from './random'
import { buildDerivedTextDataV4 } from './text/derived-text/clipboard'

interface FigmaClipboardMeta {
  fileKey: string
  pasteID: number
  dataType: string
}

export async function prefetchFigmaSchema(): Promise<void> {
  await initCodec()
}

// --- Paste from Figma ---

export async function parseFigmaClipboard(
  html: string
): Promise<{ nodes: KiwiNodeChange[]; meta: FigmaClipboardMeta; blobs: Uint8Array[] } | null> {
  const metaMatch = html.match(/\(figmeta\)(.*?)\(\/figmeta\)/)
  const bufMatch = html.match(/\(figma\)(.*?)\(\/figma\)/s)
  if (!metaMatch || !bufMatch) return null

  const meta: FigmaClipboardMeta = JSON.parse(decodeBase64Text(metaMatch[1]))
  const binary = decodeBase64(bufMatch[1])

  try {
    const chunks = parseFigKiwiChunks(binary)
    if (!chunks) return null

    const schemaBytes = inflateSync(chunks[0])
    const schema = decodeBinarySchema(new ByteBuffer(schemaBytes))
    const compiled = compileSchema(schema)
    if (!compiled.decodeMessage) return null
    const dataRaw = await decompressFigKiwiDataAsync(chunks[1])
    const msg = compiled.decodeMessage(dataRaw) as {
      nodeChanges?: KiwiNodeChange[]
      blobs?: Array<{ bytes: Uint8Array | Record<string, number> }>
    }

    const blobs: Uint8Array[] = (msg.blobs ?? []).map((b) =>
      b.bytes instanceof Uint8Array ? b.bytes : new Uint8Array(Object.values(b.bytes))
    )

    return { nodes: msg.nodeChanges ?? [], meta, blobs }
  } catch {
    return null
  }
}

function isChildOfVisualNode(nc: KiwiNodeChange, parentTypes: Map<string, string>): boolean {
  const parentId = nc.parentIndex?.guid
    ? `${nc.parentIndex.guid.sessionID}:${nc.parentIndex.guid.localID}`
    : null
  return (
    !!parentId && parentTypes.has(parentId) && isFigClipboardVisualType(parentTypes.get(parentId))
  )
}

export function figmaNodesBounds(
  nodeChanges: KiwiNodeChange[]
): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const parentTypes = new Map<string, string>()
  for (const nc of nodeChanges) {
    if (!nc.guid) continue
    const id = `${nc.guid.sessionID}:${nc.guid.localID}`
    parentTypes.set(id, nc.type ?? '')
  }

  for (const nc of nodeChanges) {
    if (!isFigClipboardVisualType(nc.type)) continue
    if (isChildOfVisualNode(nc, parentTypes)) continue

    const x = nc.transform?.m02 ?? 0
    const y = nc.transform?.m12 ?? 0
    const w = nc.size?.x ?? 0
    const h = nc.size?.y ?? 0
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }

  if (minX === Infinity) return null
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function importClipboardNodes(
  nodeChanges: KiwiNodeChange[],
  graph: SceneGraph,
  targetParentId: string,
  offsetX = 0,
  offsetY = 0,
  blobs: Uint8Array[] = []
): string[] {
  const operation = prepareClipboardImport(
    nodeChanges,
    graph,
    targetParentId,
    blobs,
    offsetX,
    offsetY
  )
  operation.commit()
  return operation.plan.rootIds
}

export async function buildFigmaClipboardHTML(
  nodes: SceneNode[],
  graph: SceneGraph
): Promise<string | null> {
  const compiled = getCompiledSchema()
  const schemaDeflated = deflateSync(getSchemaBytes())
  const fontDigestMap = await buildFontDigestMap(graph)

  const docGuid = { sessionID: 0, localID: 0 }
  const canvasGuid = { sessionID: 0, localID: 1 }
  const localIdCounter = { value: 100 }

  const nodeChanges: KiwiNodeChange[] = [
    makeDocumentNodeChange(docGuid, graph.documentColorSpace),
    makeCanvasNodeChange(canvasGuid, docGuid, '!', 'Page 1')
  ]

  const exportedTextNodes: SceneNode[] = []
  const collectTextNodes = (node: SceneNode) => {
    if (node.type === 'TEXT') exportedTextNodes.push(node)
    for (const childId of node.childIds) {
      const child = graph.getNode(childId)
      if (child) collectTextNodes(child)
    }
  }

  const nodeIdToGuid = new Map<string, GUID>()
  const assignedGuidValues = new Set<string>()
  const blobs: Uint8Array[] = []
  const variableIds = new Map<string, GUID>()
  const modeIds = new Map<string, GUID>()
  const allocateResource = (id: string, map: Map<string, GUID>) => {
    const guid = { sessionID: 1, localID: localIdCounter.value++ }
    map.set(id, guid)
    assignedGuidValues.add(`1:${guid.localID}`)
  }
  for (const id of [...graph.variableCollections.keys(), ...graph.variables.keys()])
    allocateResource(id, variableIds)
  for (const collection of graph.variableCollections.values())
    for (const mode of collection.modes) {
      if (!modeIds.has(mode.modeId)) allocateResource(mode.modeId, modeIds)
    }
  for (const node of graph.getAllNodes())
    if (node.sharedStyleType) {
      const guid = { sessionID: 1, localID: localIdCounter.value++ }
      nodeIdToGuid.set(node.id, guid)
      assignedGuidValues.add(`1:${guid.localID}`)
    }
  for (let i = 0; i < nodes.length; i++) {
    collectTextNodes(nodes[i])
    nodeChanges.push(
      ...sceneNodeToKiwi(
        nodes[i],
        canvasGuid,
        i,
        localIdCounter,
        graph,
        blobs,
        nodeIdToGuid,
        fontDigestMap,
        variableIds,
        undefined,
        undefined,
        assignedGuidValues,
        undefined,
        undefined,
        modeIds
      )
    )
  }

  const dependencies = new Map<string, SceneNode>()
  const selected = new Set<string>()
  const mark = (node: SceneNode): void => {
    selected.add(node.id)
    for (const child of graph.getChildren(node.id)) mark(child)
  }
  for (const node of nodes) mark(node)
  const visitDependencies = (node: SceneNode): void => {
    if (
      node.type === 'INSTANCE' &&
      node.componentId &&
      !selected.has(node.componentId) &&
      !dependencies.has(node.componentId)
    ) {
      const component = graph.getNode(node.componentId)
      if (!component) throw new Error(`Missing clipboard component ${node.componentId}`)
      dependencies.set(component.id, component)
      visitDependencies(component)
    }
    for (const child of graph.getChildren(node.id)) visitDependencies(child)
  }
  for (const node of nodes) visitDependencies(node)
  for (const node of graph.getAllNodes())
    if (node.sharedStyleType && !selected.has(node.id)) dependencies.set(node.id, node)
  const dependencyCanvas = { sessionID: 0, localID: 2 }
  if (dependencies.size || graph.variableCollections.size)
    nodeChanges.push({
      ...makeCanvasNodeChange(dependencyCanvas, docGuid, '"', 'Clipboard dependencies'),
      internalOnly: true
    })
  for (const component of dependencies.values()) {
    collectTextNodes(component)
    nodeChanges.push(
      ...sceneNodeToKiwi(
        component,
        dependencyCanvas,
        0,
        localIdCounter,
        graph,
        blobs,
        nodeIdToGuid,
        fontDigestMap,
        variableIds,
        undefined,
        undefined,
        assignedGuidValues,
        undefined,
        undefined,
        modeIds
      )
    )
  }

  appendVariableNodeChanges(graph, nodeChanges, dependencyCanvas, variableIds, modeIds)
  const textNodeQueue = [...exportedTextNodes]
  await Promise.all(
    nodeChanges.map(async (change) => {
      if (change.type !== 'TEXT') return
      const source = textNodeQueue.shift()
      if (!source) return
      change.textAutoResize = 'NONE'
      change.textUserLayoutVersion = 5
      change.lineHeight = {
        value: source.lineHeight ?? 100,
        units: source.lineHeight ? 'PIXELS' : 'PERCENT'
      }
      const shaped = await shapeTextForClipboard(source).catch(() => null)
      change.derivedTextData = await buildDerivedTextDataV4(source, fontDigestMap, shaped, blobs)
    })
  )

  const msg: Record<string, unknown> = {
    type: 'NODE_CHANGES',
    sessionID: 0,
    ackID: 0,
    pasteID: randomInt(),
    pasteFileKey: 'openpencil',
    nodeChanges
  }

  if (blobs.length > 0) {
    msg.blobs = blobs.map((bytes) => ({ bytes }))
  }

  const dataRaw = compiled.encodeMessage(msg)
  const figKiwiBinary = buildFigKiwi(schemaDeflated, dataRaw)
  const bufferB64 = encodeBase64(figKiwiBinary)

  const meta: FigmaClipboardMeta = {
    fileKey: 'openpencil',
    pasteID: msg.pasteID as number,
    dataType: 'scene'
  }
  const metaB64 = encodeBase64Text(JSON.stringify(meta))

  return (
    `<meta charset='utf-8'>` +
    `<span data-metadata="<!--(figmeta)${metaB64}(/figmeta)-->"></span>` +
    `<span data-buffer="<!--(figma)${bufferB64}(/figma)-->"></span>`
  )
}

export {
  buildOpenPencilClipboardHTML,
  parseOpenPencilClipboard,
  type OpenPencilClipboardData,
  type TextPictureBuilder
} from './clipboard/openpencil'
