import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { stringToSvg as stringToSVG } from '@realfavicongenerator/generate-favicon'
import type { ImageAdapter } from '@realfavicongenerator/generate-favicon'
import { getNodeImageAdapter } from '@realfavicongenerator/image-adapter-node'

import { brand } from './config.ts'

export async function loadArtwork(root: string) {
  const adapter = await getNodeImageAdapter()
  const main = await readFile(join(root, 'assets/brand/mark.svg'), 'utf8')
  const micro = await readFile(join(root, 'assets/brand/mark-micro.svg'), 'utf8')
  return { adapter, main, micro }
}

export function recolor(
  source: string,
  adapter: ImageAdapter,
  mode: 'dark' | 'mono' | 'mono-dark'
) {
  const svg = stringToSVG(source, adapter)
  if (mode === 'dark') {
    for (const [part, color] of Object.entries(brand.darkPalette)) {
      for (const path of svg.find(`[data-part="${part}"]`)) path.fill(color)
    }
    for (const grid of svg.find('[data-detail="grid"]')) grid.opacity(brand.darkGridOpacity)
  } else {
    for (const detail of svg.find('[data-detail]')) detail.remove()
    for (const path of svg.find('[data-part]')) {
      path.fill(mode === 'mono' ? brand.darkBackground : brand.background)
    }
  }
  return svg.svg()
}

/** Square opaque web tiles; only desktop artwork includes its own rounded enclosure. */
export function appArtwork(
  source: string,
  adapter: ImageAdapter,
  kind: 'web' | 'maskable' | 'desktop'
) {
  const svg = adapter.createSvg().size(1024, 1024).viewbox(0, 0, 1024, 1024)
  const desktop = kind === 'desktop'
  const inset = desktop ? 64 : 0
  const background = svg
    .rect(1024 - inset * 2, 1024 - inset * 2)
    .move(inset, inset)
    .fill(brand.background)
  if (desktop) background.radius(200)
  const scale = kind === 'maskable' ? brand.maskableScale : brand.appScale
  const mark = stringToSVG(source, adapter).size(1024 * scale, 1024 * scale)
  mark.move((1024 * (1 - scale)) / 2, (1024 * (1 - scale)) / 2)
  svg.add(mark)
  return svg.svg()
}
