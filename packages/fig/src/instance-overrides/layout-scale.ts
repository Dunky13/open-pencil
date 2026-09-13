import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import type { InstanceOccurrence } from './interpret'
import { scaleTextLayout } from './text-scale'
import type { SymbolData } from './types'

// Distances only: sizing modes, grow factors, and alignment are dimensionless.
export const LAYOUT_DISTANCE_FIELDS = {
  itemSpacing: 'stackSpacing',
  counterAxisSpacing: 'stackCounterSpacing',
  paddingLeft: 'stackHorizontalPadding',
  paddingTop: 'stackVerticalPadding',
  paddingRight: 'stackPaddingRight',
  paddingBottom: 'stackPaddingBottom'
} as const
const LAYOUT_DISTANCES = ['stackPadding', ...Object.values(LAYOUT_DISTANCE_FIELDS)] as const

function scaleRawVisualProps(props: NodeChange, factor: number): void {
  if (typeof props.strokeWeight === 'number') props.strokeWeight *= factor
  if (typeof props.cornerRadius === 'number') props.cornerRadius *= factor
  for (const field of [
    'rectangleTopLeftCornerRadius',
    'rectangleTopRightCornerRadius',
    'rectangleBottomLeftCornerRadius',
    'rectangleBottomRightCornerRadius'
  ] as const) {
    if (typeof props[field] === 'number') props[field] *= factor
  }
  if (props.dashPattern) props.dashPattern = props.dashPattern.map((value) => value * factor)
  if (props.effects)
    props.effects = props.effects.map((effect) => ({
      ...effect,
      offset: effect.offset
        ? { x: effect.offset.x * factor, y: effect.offset.y * factor }
        : effect.offset,
      radius: typeof effect.radius === 'number' ? effect.radius * factor : effect.radius,
      spread: typeof effect.spread === 'number' ? effect.spread * factor : effect.spread
    }))
}

/**
 * Expansion is in component space; an instance's own NodeChange distances are
 * already in placed space. Explicit path claims are applied before this stage,
 * and saved derived bounds afterwards. Nested expansions are normalized first.
 */
export function applyInstanceLayoutScale(root: InstanceOccurrence, source: NodeChange): void {
  const factor = (source.symbolData as SymbolData | undefined)?.uniformScaleFactor ?? 1
  if (!Number.isFinite(factor) || factor <= 0) throw new Error('Invalid instance uniform scale')
  if (factor === 1) return
  const visit = (node: InstanceOccurrence): void => {
    node.layoutScale = (node.layoutScale ?? 1) * factor
    for (const field of Object.keys(node.variableBindingScales ?? {})) {
      if (node.variableBindingScales && field !== 'opacity' && field !== 'rotation')
        node.variableBindingScales[field] *= factor
    }
    const props = node.properties
    scaleTextLayout(props, factor)
    scaleRawVisualProps(props, factor)
    for (const field of LAYOUT_DISTANCES) {
      const value = props[field]
      if (typeof value === 'number') props[field] = value * factor
    }
    if (props.size) props.size = { x: props.size.x * factor, y: props.size.y * factor }
    if (props.transform)
      props.transform = {
        ...props.transform,
        m02: props.transform.m02 * factor,
        m12: props.transform.m12 * factor
      }
    if (node.derivedSize)
      node.derivedSize = {
        x: node.derivedSize.x * factor,
        y: node.derivedSize.y * factor
      }
    for (const child of node.children) visit(child)
  }
  visit(root)
  for (const field of LAYOUT_DISTANCES) {
    if (source[field] !== undefined) root.properties[field] = source[field]
  }
  if (source.strokeWeight !== undefined) root.properties.strokeWeight = source.strokeWeight
  if (source.fontSize !== undefined) root.properties.fontSize = source.fontSize
  if (source.lineHeight) root.properties.lineHeight = structuredClone(source.lineHeight)
  if (source.letterSpacing) root.properties.letterSpacing = structuredClone(source.letterSpacing)
  if (source.textData) root.properties.textData = structuredClone(source.textData)
  if (source.derivedTextData)
    root.properties.derivedTextData = structuredClone(source.derivedTextData)
  if (source.size) root.properties.size = structuredClone(source.size)
  if (source.transform) root.properties.transform = structuredClone(source.transform)
}
