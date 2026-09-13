import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { setInstanceOverride, type SceneNode } from '@open-pencil/scene-graph'

import { SCALAR_OVERRIDE_FIELDS } from './field-contract'

export function recordScalarOverrideClaims(
  owner: SceneNode,
  target: SceneNode,
  properties: NodeChange
): void {
  for (const field of Object.keys(SCALAR_OVERRIDE_FIELDS) as Array<
    keyof typeof SCALAR_OVERRIDE_FIELDS
  >) {
    if (field in properties)
      setInstanceOverride(owner.instanceOverrides, owner.id, target.id, field, target[field])
  }
}
