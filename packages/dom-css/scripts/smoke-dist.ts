import type * as Browser from '../src/browser'
import type * as Export from '../src/export'
import type * as Mapping from '../src/export/storybook/mapping'
import type * as JSX from '../src/import/jsx/runtime'
import type * as DomCSS from '../src/index'
import { mappingConfigFixture } from '../tests/export/storybook/mapping/fixtures'

const distPath = '../dist/index.js'
const browserDistPath = '../dist/browser.js'
const dist = await import(distPath)
const browserDist = await import(browserDistPath)
const exportDistPath = '../dist/export.js'
const jsxDistPath = '../dist/jsx-runtime.js'
const mappingDistPath = '../dist/export/storybook/mapping/index.js'
const exportDist = await import(exportDistPath)
const jsxDist = await import(jsxDistPath)
const mappingDist = await import(mappingDistPath)

const browserHTMLToSceneGraph: typeof Browser.browserHTMLToSceneGraph =
  browserDist.browserHTMLToSceneGraph
const browserTailwindJSXToDesignDocument: typeof Browser.browserTailwindJSXToDesignDocument =
  browserDist.browserTailwindJSXToDesignDocument
const compileTailwindCSS: typeof DomCSS.compileTailwindCSS = dist.compileTailwindCSS
const createHeadlessCSSRuntime: typeof DomCSS.createHeadlessCSSRuntime =
  dist.createHeadlessCSSRuntime
const htmlToSceneGraph: typeof DomCSS.htmlToSceneGraph = dist.htmlToSceneGraph
const jsx: typeof JSX.jsx = jsxDist.jsx
const jsxToDesignDocument: typeof DomCSS.jsxToDesignDocument = dist.jsxToDesignDocument
const parseComponentMappings: typeof Mapping.parseComponentMappings =
  mappingDist.parseComponentMappings
const serializeHTML: typeof Export.serializeHTML = exportDist.serializeHTML

const mappings = parseComponentMappings(JSON.stringify(mappingConfigFixture()))
if (
  mappings.components[0]?.implementation.import !== 'components/Button.ts' ||
  mappings.components[0]?.states.length !== 0
) {
  throw new Error('Expected built parseComponentMappings() to parse component references')
}

type DesignDocument = DomCSS.DesignDocument

const document: DesignDocument = {
  type: 'document',
  children: [
    {
      type: 'element',
      tagName: 'article',
      attrs: { class: 'card' },
      children: [{ type: 'text', text: 'OpenPencil' }]
    }
  ]
}

const html = serializeHTML(document)
if (!html.includes('OpenPencil')) {
  throw new Error('Expected built serializeHTML() to emit document text')
}

const css = await compileTailwindCSS(['flex', 'w-80'])
if (!css.includes('.w-80')) {
  throw new Error('Expected built compileTailwindCSS() to emit Tailwind utility CSS')
}

const graph = await htmlToSceneGraph('<article class="card">OpenPencil</article>', {
  cssText: '.card { display: flex; width: 320px; }',
  runtime: createHeadlessCSSRuntime()
})
const page = graph.getPages()[0]
const card = page ? graph.getChildren(page.id)[0] : undefined
if (card?.type !== 'FRAME' || card.width !== 320) {
  throw new Error('Expected built htmlToSceneGraph() to produce a sized frame')
}

const jsxDocument = await jsxToDesignDocument(
  jsx('article', { class: 'card', children: 'OpenPencil' })
)
if (jsxDocument.children[0]?.type !== 'element') {
  throw new Error('Expected built JSX helpers to produce DesignDOM elements')
}

if (typeof browserHTMLToSceneGraph !== 'function') {
  throw new TypeError('Expected built browser HTML helper to be exported')
}

if (typeof browserTailwindJSXToDesignDocument !== 'function') {
  throw new TypeError('Expected built browser JSX helper to be exported')
}

if (typeof browserDist.browserHTMLToSceneGraph !== 'function') {
  throw new TypeError('Expected built browser subpath HTML helper to be exported')
}

if (typeof browserDist.browserTailwindJSXToDesignDocument !== 'function') {
  throw new TypeError('Expected built browser subpath helper to be exported')
}
