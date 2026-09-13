import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type { InstanceOccurrence } from './interpret'
import { bindSourceProperties, instanceBindings } from './interpret-bindings'
import type { ComponentPropAssignment, ComponentPropDef, ComponentPropRef } from './types'

function detachedSymbolId(source: NodeChange): GUID | undefined {
  const value = source.detachedSymbolId as { guid?: GUID } | undefined
  return value?.guid
}

export function remapDetachedAssignments(sources: ReadonlyMap<string, NodeChange>, root: InstanceOccurrence, path: readonly GUID[], assignments: readonly ComponentPropAssignment[]): boolean {
  if (path.length !== 1 || assignments.length === 0) return false
  const wanted = new Set(assignments.flatMap(assignment => assignment.defID ? [guidToString(assignment.defID)] : []))
  const candidates: Array<{ occurrence: InstanceOccurrence; detached: NodeChange }> = []
  const visit = (occurrence: InstanceOccurrence): void => {
    const source = sources.get(occurrence.sourceId)
    const detachedId = source && detachedSymbolId(source)
    const detached = detachedId && sources.get(guidToString(detachedId))
    if (detached && (detached.componentPropDefs as ComponentPropDef[] | undefined)?.some(def => def.id && wanted.has(guidToString(def.id)))) candidates.push({ occurrence, detached })
    occurrence.children.forEach(visit)
  }
  visit(root)
  if (candidates.length !== 1) return false
  const children = new Map<string, NodeChange[]>()
  for (const source of sources.values()) {
    const parent = source.parentIndex?.guid && guidToString(source.parentIndex.guid)
    if (parent) children.set(parent, [...(children.get(parent) ?? []), source])
  }
  let oldField: string | undefined
  const findOldRef = (source: NodeChange): void => {
    for (const ref of (source.componentPropRefs as ComponentPropRef[] | undefined) ?? []) if (ref.defID && wanted.has(guidToString(ref.defID))) oldField = ref.componentPropNodeField
    for (const child of children.get(source.guid ? guidToString(source.guid) : '') ?? []) findOldRef(child)
  }
  findOldRef(candidates[0].detached)
  if (!oldField) return false
  const live: InstanceOccurrence[] = []
  const findLive = (occurrence: InstanceOccurrence): void => {
    const source = sources.get(occurrence.sourceId)
    if (((source?.componentPropRefs as ComponentPropRef[] | undefined) ?? []).some(ref => ref.componentPropNodeField === oldField)) live.push(occurrence)
    occurrence.children.forEach(findLive)
  }
  findLive(candidates[0].occurrence)
  if (live.length !== 1) return false
  const source = sources.get(live[0].sourceId)
  const ref = (source?.componentPropRefs as ComponentPropRef[] | undefined)?.find(item => item.componentPropNodeField === oldField)
  if (!source || !ref?.defID) return false
  const translated = assignments.map(assignment => ({ ...structuredClone(assignment), defID: structuredClone(ref.defID) }))
  live[0].properties = bindSourceProperties(source, instanceBindings([], translated))
  return true
}
