import { readFile, writeFile } from 'node:fs/promises'

import { defineCommand } from 'citty'

import { createFigReview } from '@open-pencil/fig'

export default defineCommand({
  meta: { description: 'Write a deterministic review snapshot of every saved FIG record' },
  args: {
    file: { type: 'positional', description: 'FIG document path', required: true },
    output: { type: 'string', alias: 'o', description: 'Write JSON to this path instead of stdout' }
  },
  async run({ args }) {
    const bytes = await readFile(args.file)
    const review = createFigReview(Uint8Array.from(bytes).buffer)
    if (args.output) await writeFile(args.output, review)
    else process.stdout.write(review)
  }
})
