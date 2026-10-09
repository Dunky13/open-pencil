import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'fflate'

import { parseFigBuffer, writeFigArchive } from '@open-pencil/fig'
import { exportFigFile, SceneGraph } from '@open-pencil/core'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { createNodeChangesMessage, encodeMessage, getSchemaBytes, initCodec } from '@open-pencil/kiwi/fig/codec'

import { CLI_ENTRY } from '#cli-tests/helpers/paths'

describe('diff snapshot CLI', () => {
  test('independent CLI edits of the same base save different new layer GUIDs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-branches-'))
    try {
      const graph = new SceneGraph()
      const file = join(dir, 'base.fig')
      await writeFile(file, await exportFigFile(graph))
      const savedIds: string[] = []
      for (const branch of ['Left', 'Right']) {
        const output = join(dir, `${branch}.fig`)
        const run = Bun.spawn([process.execPath, CLI_ENTRY, 'eval', file, '--code', `const node = figma.createRectangle(); node.name = '${branch}';`, '-o', output, '--quiet'], { stdout: 'pipe', stderr: 'pipe' })
        const error = await new Response(run.stderr).text()
        expect(error).toBe('')
        expect(await run.exited).toBe(0)
        const bytes = await readFile(output)
        const record = parseFigBuffer(Uint8Array.from(bytes).buffer).nodeChanges.find((node) => node.name === branch)
        if (!record?.guid) throw new Error(`Missing saved ${branch} record`)
        savedIds.push(guidToString(record.guid))
      }
      expect(savedIds[0]).not.toBe(savedIds[1])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }, 60_000)

  test('separate processes write identical review bytes to stdout and a file', async () => {
    await initCodec()
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-review-'))
    try {
      const file = join(dir, 'design.fig')
      const output = join(dir, 'review.json')
      await writeFile(file, writeFigArchive({
        schemaDeflated: deflateSync(getSchemaBytes()),
        kiwiData: encodeMessage(createNodeChangesMessage(0, 0, [{ guid: { sessionID: 2, localID: 3 }, type: 'RECTANGLE', name: 'Stable' }])),
        thumbnailPNG: new Uint8Array(),
        metaJSON: '{}'
      }))
      const stdoutRun = Bun.spawn([process.execPath, CLI_ENTRY, 'diff', 'snapshot', file], { stdout: 'pipe', stderr: 'pipe' })
      const text = await new Response(stdoutRun.stdout).text()
      expect(await stdoutRun.exited).toBe(0)
      const fileRun = Bun.spawn([process.execPath, CLI_ENTRY, 'diff', 'snapshot', file, '-o', output], { stdout: 'pipe', stderr: 'pipe' })
      expect(await fileRun.exited).toBe(0)
      expect(await readFile(output, 'utf8')).toBe(text)
      expect(text).toContain('"2:3":')
      expect(text.endsWith('\n')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
