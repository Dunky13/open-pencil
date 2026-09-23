import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { deriveSlashVariantProperties } from '@open-pencil/scene-graph/variant-properties'

import { sceneNodeToDesignDocument } from './from-scene-graph'
import type { ExportHTMLFile } from './html-export'
import { serializeHTML } from './serialize'

export type StorybookFramework = 'react' | 'vue' | 'html'

export interface ExportStorybookOptions {
  framework?: StorybookFramework
  /** Limit the export to one page. Defaults to every page. */
  pageId?: string
  /** Repository-relative `.fig`/`.pen` path; adds an `openpencil://` design link to stories. */
  linkPath?: string
}

interface StoryVariant {
  values: string[]
  html: string
  /** Layer name the story links to, when it differs from the group's. */
  linkNode?: string
}

interface StoryGroup {
  title: string
  name: string
  props: { name: string; options: string[] }[]
  variants: StoryVariant[]
  linkNode?: string
}

const FRAMEWORKS: Record<StorybookFramework, { types: string; imports: string; render: string }> = {
  react: {
    types: '@storybook/react-vite',
    imports: "import { createElement } from 'react'\n",
    render: "createElement('div', { dangerouslySetInnerHTML: { __html: variantHTML(args) } })"
  },
  vue: {
    types: '@storybook/vue3-vite',
    imports: "import { h } from 'vue'\n",
    render: "({ setup: () => () => h('div', { innerHTML: variantHTML(args) }) })"
  },
  html: { types: '@storybook/html-vite', imports: '', render: 'variantHTML(args)' }
}

const lit = (value: string) => JSON.stringify(value)

function isExported(node: SceneNode): boolean {
  return node.visible && !node.internalOnly
}

function nodeHTML(graph: SceneGraph, node: SceneNode): string {
  return serializeHTML(sceneNodeToDesignDocument(graph, node.id, false))
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

/** Variants whose property values collide are told apart by layer name instead. */
function distinctVariants(group: StoryGroup, names: string[]): StoryGroup {
  const keys = group.variants.map((variant) => JSON.stringify(variant.values))
  if (new Set(keys).size === keys.length) return group
  const used = new Set<string>()
  const labels = names.map((name) => {
    let label = name
    for (let i = 2; used.has(label); i++) label = `${name} ${i}`
    used.add(label)
    return label
  })
  return {
    ...group,
    props: [{ name: 'Variant', options: labels }],
    variants: group.variants.map((variant, i) => ({ ...variant, values: [labels[i] ?? ''] }))
  }
}

function componentSetGroup(graph: SceneGraph, page: SceneNode, set: SceneNode): StoryGroup {
  const definitions = set.componentPropertyDefinitions.filter((def) => def.type === 'VARIANT')
  const components = graph
    .getChildren(set.id)
    .filter((child) => child.type === 'COMPONENT' && isExported(child))
  const variants = components.map((component) => ({
    values: definitions.map((def) => component.componentPropertyValues[def.name] ?? ''),
    html: nodeHTML(graph, component)
  }))
  const props = definitions.map((def, index) => ({
    name: def.name,
    options: unique([...(def.variantOptions ?? []), ...variants.map((v) => v.values[index] ?? '')])
  }))
  return distinctVariants(
    { title: `${page.name}/${set.name}`, name: set.name, props, variants, linkNode: set.name },
    components.map((component) => component.name)
  )
}

function componentGroup(graph: SceneGraph, page: SceneNode, component: SceneNode): StoryGroup {
  return {
    title: `${page.name}/${component.name}`,
    name: component.name,
    props: [],
    variants: [{ values: [], html: nodeHTML(graph, component) }],
    linkNode: component.name
  }
}

/** `Button/Primary`, `Button/Secondary` → one `Button` group with a derived variant property. */
function slashGroups(
  graph: SceneGraph,
  page: SceneNode,
  prefix: string,
  components: SceneNode[]
): StoryGroup[] {
  const derived = deriveSlashVariantProperties(components, () => '')
  if (!derived) return components.map((component) => componentGroup(graph, page, component))
  const props = derived.definitions.map((def) => ({
    name: def.name,
    options: def.variantOptions ?? []
  }))
  const variants = components.map((component) => {
    const values = derived.variants.get(component.id)?.componentPropertyValues ?? {}
    return {
      values: props.map((prop) => values[prop.name] ?? ''),
      html: nodeHTML(graph, component),
      linkNode: component.name
    }
  })
  return [
    distinctVariants(
      { title: `${page.name}/${prefix}`, name: prefix, props, variants },
      components.map((component) => component.name)
    )
  ]
}

function collectGroups(graph: SceneGraph, page: SceneNode): StoryGroup[] {
  const groups: StoryGroup[] = []
  const slashed = new Map<string, SceneNode[]>()
  const visit = (node: SceneNode) => {
    if (!isExported(node) || node.type === 'INSTANCE') return
    if (node.type === 'COMPONENT_SET') {
      const group = componentSetGroup(graph, page, node)
      if (group.variants.length > 0) groups.push(group)
      return
    }
    if (node.type === 'COMPONENT') {
      const prefix = node.name.split('/')[0]?.trim()
      if (!node.name.includes('/') || !prefix) groups.push(componentGroup(graph, page, node))
      else slashed.set(prefix, [...(slashed.get(prefix) ?? []), node])
      return
    }
    for (const child of graph.getChildren(node.id)) visit(child)
  }
  for (const child of graph.getChildren(page.id)) visit(child)
  for (const [prefix, components] of slashed)
    groups.push(...slashGroups(graph, page, prefix, components))
  return groups
}

function identifier(text: string, used: Set<string>): string {
  const words = text.split(/[^A-Za-z0-9]+/).filter(Boolean)
  const base = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('')
  const name = /^[A-Za-z]/.test(base) ? base : `Variant${base}`
  let candidate = name
  for (let i = 2; used.has(candidate.toLowerCase()); i++) candidate = `${name}${i}`
  used.add(candidate.toLowerCase())
  return candidate
}

function designLink(linkPath: string | undefined, node: string | undefined): string {
  if (!linkPath || !node) return ''
  const url = `openpencil://open?file=${encodeURIComponent(linkPath)}&node=${encodeURIComponent(node)}`
  return `parameters: { design: { type: 'link', url: ${lit(url)} } }, `
}

function storyModule(
  group: StoryGroup,
  framework: StorybookFramework,
  linkPath: string | undefined
): string {
  const { types, imports, render } = FRAMEWORKS[framework]
  const { props, variants } = group
  const argsType =
    props.length === 0
      ? 'Record<string, never>'
      : `{ ${props.map((p) => `${lit(p.name)}: ${p.options.map(lit).join(' | ')}`).join('; ')} }`
  const argsLiteral = (values: string[]) =>
    `{ ${props.map((p, i) => `${lit(p.name)}: ${lit(values[i] ?? '')}`).join(', ')} }`
  const argTypes = props
    .map(
      (p) => `${lit(p.name)}: { control: 'select', options: [${p.options.map(lit).join(', ')}] }`
    )
    .join(', ')
  const used = new Set<string>()
  const stories = variants.map((variant) => {
    const label =
      props.length === 0
        ? 'Default'
        : props.map((p, i) => `${p.name}=${variant.values[i] ?? ''}`).join(', ')
    const exportName = identifier(props.length === 0 ? 'Default' : variant.values.join(' '), used)
    return `export const ${exportName}: Story = { name: ${lit(label)}, ${designLink(linkPath, variant.linkNode)}args: ${argsLiteral(variant.values)} }`
  })

  return `// Generated by OpenPencil from ${linkPath ?? 'a design document'}. Re-export to update; edits are overwritten.
import type { Meta, StoryObj } from '${types}'
${imports}
type Args = ${argsType}

const variants: Record<string, string> = {
${variants.map((v) => `  ${lit(JSON.stringify(v.values))}: ${lit(v.html)},`).join('\n')}
}

function variantHTML(args: Args): string {
  const key = JSON.stringify([${props.map((p) => `args[${lit(p.name)}]`).join(', ')}])
  const html = variants[key]
  if (html === undefined) throw new Error(${lit(`${group.name} has no variant `)} + key)
  return html
}

const meta = {
  title: ${lit(group.title)},
  ${designLink(linkPath, group.linkNode)}args: ${argsLiteral(variants[0]?.values ?? [])},
  argTypes: { ${argTypes} },
  render: (args) => ${render}
} satisfies Meta<Args>

export default meta
type Story = StoryObj<Args>

${stories.join('\n')}
`
}

/** Generate one CSF3 `.stories.ts` file per component or component set. */
export function exportStorybook(
  graph: SceneGraph,
  options: ExportStorybookOptions = {}
): ExportHTMLFile[] {
  const framework = options.framework ?? 'react'
  const pages = graph.getPages().filter((page) => !options.pageId || page.id === options.pageId)
  const usedFiles = new Set<string>()
  return pages.flatMap((page) =>
    collectGroups(graph, page).map((group) => ({
      path: `${identifier(group.name, usedFiles)}.stories.ts`,
      content: storyModule(group, framework, options.linkPath)
    }))
  )
}
