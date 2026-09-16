import { afterEach, describe, expect, mock, test } from 'bun:test'

import { localeSetting } from '@open-pencil/vue'

import { openDesignFileBatch, readBodyWithLimit } from '@/app/shell/menu/files'
import { toast } from '@/app/shell/ui'

afterEach(() => {
  toast.toasts.value = []
  localeSetting.set(undefined)
})

describe('openDesignFileBatch', () => {
  test('opens selected files sequentially in selection order', async () => {
    const opened: string[] = []
    const openItem = mock(async (name: string) => {
      opened.push(name)
    })

    await openDesignFileBatch(['first.fig', 'second.pen'], (name) => name, openItem)

    expect(opened).toEqual(['first.fig', 'second.pen'])
    expect(openItem).toHaveBeenCalledTimes(2)
  })

  test('reports one failed file and continues opening later selections', async () => {
    localeSetting.set('en')
    const opened: string[] = []
    const openItem = mock(async (name: string) => {
      opened.push(name)
      if (name === 'broken.fig') throw new Error('Invalid FIG container')
    })

    await expect(
      openDesignFileBatch(['first.fig', 'broken.fig', 'last.pen'], (name) => name, openItem)
    ).resolves.toBeUndefined()

    expect(opened).toEqual(['first.fig', 'broken.fig', 'last.pen'])
    expect(toast.toasts.value).toHaveLength(1)
    expect(toast.toasts.value[0]).toMatchObject({
      message: 'Could not open “broken.fig”: Invalid FIG container',
      variant: 'error'
    })
  })
})

function streamed(chunks: number[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const size of chunks) controller.enqueue(new Uint8Array(size))
        controller.close()
      }
    })
  )
}

const MIB = 1024 * 1024

describe('readBodyWithLimit', () => {
  test('buffers a body that stays under the cap', async () => {
    const abort = mock(() => undefined)

    const blob = await readBodyWithLimit(streamed([20, 10]), MIB, abort)

    expect(blob.size).toBe(30)
    expect(abort).not.toHaveBeenCalled()
  })

  test('aborts the request as soon as the cap is exceeded', async () => {
    const abort = mock(() => undefined)
    // The third chunk pushes it over: the read stops there instead of draining the
    // body, and the notice names the cap the user has to stay under.
    const body = streamed([MIB / 2, MIB / 2, 1, 64 * MIB])

    await expect(readBodyWithLimit(body, MIB, abort)).rejects.toThrow('exceeds 1 MiB')
    expect(abort).toHaveBeenCalledTimes(1)
  })

  test('accepts a body of exactly the cap and refuses one byte more', async () => {
    const abort = mock(() => undefined)

    const exact = await readBodyWithLimit(streamed([MIB / 2, MIB / 2]), MIB, abort)
    expect(exact.size).toBe(MIB)
    expect(abort).not.toHaveBeenCalled()

    await expect(readBodyWithLimit(streamed([MIB, 1]), MIB, abort)).rejects.toThrow('exceeds')
    expect(abort).toHaveBeenCalledTimes(1)
  })

  test('counts the bytes that arrive, not a Content-Length claim', async () => {
    const response = streamed([MIB, MIB])
    response.headers.set('Content-Length', '1')
    const abort = mock(() => undefined)

    await expect(readBodyWithLimit(response, MIB, abort)).rejects.toThrow('exceeds')
    expect(abort).toHaveBeenCalledTimes(1)
  })

  test('refuses a response with no body instead of opening an empty document', async () => {
    const abort = mock(() => undefined)

    await expect(readBodyWithLimit(new Response(null), MIB, abort)).rejects.toThrow(
      'carried no body'
    )
    expect(abort).not.toHaveBeenCalled()
  })
})
