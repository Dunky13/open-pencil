import type { SceneNode } from '@open-pencil/scene-graph'

/** Simple scalar claims shared by materialization protection and runtime export. */
export const SCALAR_OVERRIDE_FIELDS = {
  opacity: 'opacity',
  fontSize: 'fontSize',
  name: 'name'
} as const satisfies Partial<Record<keyof SceneNode, keyof SceneNode>>

export type ScalarOverrideField = keyof typeof SCALAR_OVERRIDE_FIELDS
