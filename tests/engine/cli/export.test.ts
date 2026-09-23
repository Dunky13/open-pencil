import { expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { unzipSync } from 'fflate'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'

import { runOpenPencilCLI } from '#tests/helpers/cli'
import { cliSourcePath } from '#tests/helpers/paths'
import { createRect, firstPageId, makeSceneGraph } from '#tests/helpers/scene'

setDefaultTimeout(30_000)

const io = new IORegistry(BUILTIN_IO_FORMATS)

async function createFigFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-export-cli-'))
  const figPath = join(dir, 'card.fig')
  const graph = makeSceneGraph('Export Page')
  const firstFrame = graph.createNode('FRAME', firstPageId(graph), {
    name: 'First slide',
    width: 1280,
    height: 720
  })
  const rect = createRect(graph, firstFrame.id, {
    name: 'Export Card',
    x: 0,
    y: 0,
    width: 160,
    height: 80
  })
  rect.layoutMode = 'HORIZONTAL'
  rect.itemSpacing = 8
  rect.paddingLeft = 16
  rect.paddingRight = 16
  rect.paddingTop = 16
  rect.paddingBottom = 16
  rect.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }]

  const secondPage = graph.addPage('Second Page')
  const secondFrame = graph.createNode('FRAME', secondPage.id, {
    name: 'Second slide',
    width: 1280,
    height: 720
  })
  createRect(graph, secondFrame.id, {
    name: 'Second Card',
    x: 0,
    y: 0,
    width: 120,
    height: 60
  })

  const result = await io.writeDocument('fig', graph)
  await Bun.write(figPath, result.data as Uint8Array)
  return { dir, figPath }
}

test('FIG export preserves the whole document by default', async () => {
  const { dir, figPath } = await createFigFixture()
  const output = join(dir, 'whole.fig')

  const { stdout, stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'fig',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  expect(stdout).toContain('Target: whole document')

  const { graph } = await io.readDocument({
    name: output,
    data: new Uint8Array(await Bun.file(output).arrayBuffer())
  })
  expect(graph.getPages()).toHaveLength(3)
  expect(graph.getPages().map((page) => page.name)).toContain('Second Page')
})

test('PPTX export includes slides from every page by default', async () => {
  const { dir, figPath } = await createFigFixture()
  const output = join(dir, 'whole.pptx')

  const { stdout, stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'pptx',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  expect(stdout).toContain('Target: whole document')

  const files = unzipSync(new Uint8Array(await Bun.file(output).arrayBuffer()))
  expect(files['ppt/slides/slide1.xml']).toBeDefined()
  expect(files['ppt/slides/slide2.xml']).toBeDefined()
  expect(files['ppt/slides/slide3.xml']).toBeUndefined()
})

test('FIG export requires an explicit page for a partial archive', async () => {
  const { dir, figPath } = await createFigFixture()
  const output = join(dir, 'page.fig')

  const { stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'fig',
    '--page',
    'Second Page',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  const { graph } = await io.readDocument({
    name: output,
    data: new Uint8Array(await Bun.file(output).arrayBuffer())
  })
  expect(graph.getPages().map((page) => page.name)).toEqual(['Second Page'])
})

test('export CLI writes HTML with inline styles by default', async () => {
  const { dir, figPath } = await createFigFixture()
  const output = join(dir, 'card.html')

  const { stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'html',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  const html = await Bun.file(output).text()
  expect(html).toContain('data-open-pencil-node-id')
  expect(html).toContain('style=')
  expect(html).toContain('display: flex')
})

test('export CLI can write HTML styles as Tailwind classes', async () => {
  const { dir, figPath } = await createFigFixture()
  const output = join(dir, 'card-tailwind.html')

  const { stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'html',
    '--css',
    'tailwind',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  const html = await Bun.file(output).text()
  expect(html).toContain('data-open-pencil-node-id')
  expect(html).toContain('class="')
  expect(html).toContain('flex')
  expect(html).not.toContain('style=')
})

test('export CLI can write standalone HTML', async () => {
  const { dir, figPath } = await createFigFixture()
  const output = join(dir, 'card-standalone.html')

  const { stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'html',
    '--html',
    'standalone',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  const html = await Bun.file(output).text()
  expect(html).toContain('<!doctype html>')
  expect(html).toContain('data-open-pencil-html="standalone"')
  expect(html).toContain('position:relative')
  expect(html).toContain('position: absolute')
  expect(html).not.toContain('@tailwindcss/browser@4')
})

test('export CLI precompiles Tailwind CSS for standalone Tailwind HTML', async () => {
  const { dir, figPath } = await createFigFixture()
  const output = join(dir, 'card-standalone-tailwind.html')

  const { stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'html',
    '--html',
    'standalone',
    '--css',
    'tailwind',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  const html = await Bun.file(output).text()
  expect(html).toContain('<!doctype html>')
  expect(html).toContain('<style>')
  expect(html).toContain('class="')
  expect(html).toContain('.flex')
  expect(html).not.toContain('@tailwindcss/browser@4')
})

test('export CLI can write external standalone HTML assets', async () => {
  const { dir, figPath } = await createFigFixture()
  const output = join(dir, 'card-external.html')

  const { stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'html',
    '--html',
    'standalone',
    '--css',
    'tailwind',
    '--assets',
    'external',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  const html = await Bun.file(output).text()
  const cssPath = join(dir, 'card-external.assets', 'openpencil.css')
  const css = await Bun.file(cssPath).text()
  expect(html).toContain('<link rel="stylesheet" href="card-external.assets/openpencil.css">')
  expect(html).not.toContain('<style>')
  expect(css).toContain('.flex')
  expect(css).toContain('.op-stage')
})

async function writeComponentFixture(dir: string, names: string[], file = 'library.fig') {
  const figPath = join(dir, file)
  const graph = makeSceneGraph()
  const page = graph.addPage('Library')
  for (const name of names) graph.createNode('COMPONENT', page.id, { name, width: 32, height: 16 })
  const result = await io.writeDocument('fig', graph)
  await Bun.write(figPath, result.data as Uint8Array)
  return figPath
}

test('export CLI writes Storybook stories with design images', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-storybook-cli-'))
  const figPath = await writeComponentFixture(dir, ['Badge'])
  const output = join(dir, 'stories')

  const { stdout, stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'storybook',
    '--framework',
    'vue',
    '--font-policy',
    'allow',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  expect(stdout).toContain('Exported 1 story files')
  const story = await Bun.file(join(output, 'Badge.stories.ts')).text()
  expect(story).toContain("from '@storybook/vue3-vite'")
  expect(story).toContain('title: "Library/Badge"')
  expect(story).toContain('new URL("./Badge.design/Default.png", import.meta.url).href')
  const png = new Uint8Array(await Bun.file(join(output, 'Badge.design/Default.png')).arrayBuffer())
  expect(new TextDecoder().decode(png.slice(1, 4))).toBe('PNG')
})

test('export CLI replaces stale generated stories and keeps hand-written ones', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-storybook-cli-'))
  const output = join(dir, 'stories')
  const args = ['--format', 'storybook', '--no-design-images', '--output', output]
  await runOpenPencilCLI(['export', await writeComponentFixture(dir, ['Old']), ...args])
  await Bun.write(join(output, 'Mine.stories.ts'), 'export default {}\n')

  const { exitCode } = await runOpenPencilCLI([
    'export',
    await writeComponentFixture(dir, ['New']),
    ...args
  ])

  expect(exitCode).toBe(0)
  expect(await Bun.file(join(output, 'Old.stories.ts')).exists()).toBe(false)
  expect(await Bun.file(join(output, 'New.stories.ts')).exists()).toBe(true)
  expect((await readdir(output)).some((entry) => entry.endsWith('.design'))).toBe(false)
  expect(await Bun.file(join(output, 'Mine.stories.ts')).text()).toBe('export default {}\n')
})

test('export CLI keeps stories of other documents and refuses to overwrite them', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-storybook-cli-'))
  const output = join(dir, 'stories')
  const args = ['--format', 'storybook', '--no-design-images', '--output', output]
  await runOpenPencilCLI(['export', await writeComponentFixture(dir, ['Card']), ...args])
  await runOpenPencilCLI(['export', await writeComponentFixture(dir, ['Chip'], 'b.fig'), ...args])
  expect(await Bun.file(join(output, 'Card.stories.ts')).exists()).toBe(true)
  expect(await Bun.file(join(output, 'Chip.stories.ts')).exists()).toBe(true)

  await Bun.write(join(output, 'Mine.stories.ts'), 'export default {}\n')
  const { stderr, exitCode } = await runOpenPencilCLI([
    'export',
    await writeComponentFixture(dir, ['Card', 'Mine']),
    ...args
  ])

  expect(exitCode).toBe(1)
  expect(stderr).toContain('Mine.stories.ts was not generated by OpenPencil')
  expect(await Bun.file(join(output, 'Mine.stories.ts')).text()).toBe('export default {}\n')
  expect(await Bun.file(join(output, 'Card.stories.ts')).exists()).toBe(true)
})

test('export CLI --watch re-exports stories when the document changes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-storybook-cli-'))
  const figPath = await writeComponentFixture(dir, ['First'])
  const output = join(dir, 'stories')
  const proc = Bun.spawn(
    [
      process.execPath,
      cliSourcePath('index.ts'),
      'export',
      figPath,
      '--format',
      'storybook',
      '--no-design-images',
      '--watch',
      '--output',
      output
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  )
  try {
    const reader = proc.stdout.getReader()
    let seen = ''
    const waitFor = async (text: string) => {
      while (!seen.includes(text)) {
        const { value, done } = await reader.read()
        if (done) throw new Error(`CLI exited before printing "${text}": ${seen}`)
        seen += new TextDecoder().decode(value)
      }
    }
    await waitFor('Watching')
    await writeComponentFixture(dir, ['Second'])
    const until = Date.now() + 10_000
    while (!(await Bun.file(join(output, 'Second.stories.ts')).exists())) {
      if (Date.now() > until) throw new Error(`No re-export after the change: ${seen}`)
      await Bun.sleep(50)
    }
    expect(await Bun.file(join(output, 'First.stories.ts')).exists()).toBe(false)
  } finally {
    proc.kill()
  }
})

test('export CLI rejects Storybook export of a document without components', async () => {
  const { dir, figPath } = await createFigFixture()

  const { stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'storybook',
    '--output',
    join(dir, 'stories')
  ])

  expect(exitCode).toBe(1)
  expect(stderr).toContain('No components found in the document.')
})
