import { describe, expect, mock, test } from 'bun:test'

import { openWebLink, parseWebOpenParams } from '@/app/document/io/web-link'

const RAW = 'https://raw.githubusercontent.com/o/r/master/design/hikyo.pen'

describe('parseWebOpenParams', () => {
  test('accepts an https .pen URL with a node', () => {
    const target = parseWebOpenParams(
      `?file=${encodeURIComponent(RAW)}&node=Button%2FLarge%2FDefault`
    )
    expect(target?.file.href).toBe(RAW)
    expect(target?.node).toBe('Button/Large/Default')
  })

  test('accepts a .fig URL without a node', () => {
    const target = parseWebOpenParams('?file=https%3A%2F%2Fexample.com%2Fa%2Fb.FIG')
    expect(target?.file.href).toBe('https://example.com/a/b.FIG')
    expect(target?.node).toBeUndefined()
  })

  test('refuses http', () => {
    expect(parseWebOpenParams('?file=http%3A%2F%2Fexample.com%2Fa.pen')).toBeNull()
  })

  test('refuses file URLs', () => {
    expect(parseWebOpenParams('?file=file%3A%2F%2F%2Fetc%2Fpasswd.pen')).toBeNull()
  })

  test('refuses another extension', () => {
    expect(parseWebOpenParams('?file=https%3A%2F%2Fexample.com%2Fa.svg')).toBeNull()
  })

  test('refuses a relative path, which has no protocol of its own', () => {
    expect(parseWebOpenParams('?file=design%2Fhikyo.pen')).toBeNull()
  })

  test('returns null without a file', () => {
    expect(parseWebOpenParams('?node=Button')).toBeNull()
    expect(parseWebOpenParams('')).toBeNull()
    expect(parseWebOpenParams('?file=&node=Button')).toBeNull()
  })

  test('ignores an empty node', () => {
    expect(parseWebOpenParams(`?file=${encodeURIComponent(RAW)}&node=`)?.node).toBeUndefined()
  })
})

describe('openWebLink', () => {
  const target = { file: new URL(RAW), node: 'Button/Large/Default' }

  test('selects the node after the document opens', async () => {
    const open = mock(async (): Promise<void> => undefined)
    const selectByName = mock(() => true)
    const notices: string[] = []

    await openWebLink(target, { selectByName, notify: (m) => notices.push(m) }, { open })

    expect(open).toHaveBeenCalledWith(target.file)
    expect(selectByName).toHaveBeenCalledWith('Button/Large/Default')
    expect(notices).toEqual([])
  })

  test('notifies with the host, not the whole link, when the fetch fails', async () => {
    const open = mock(async (): Promise<void> => {
      throw new Error('Failed to fetch')
    })
    const selectByName = mock(() => true)
    const notices: string[] = []

    await openWebLink(target, { selectByName, notify: (m) => notices.push(m) }, { open })

    expect(selectByName).not.toHaveBeenCalled()
    expect(notices).toHaveLength(1)
    expect(notices[0]).toContain('raw.githubusercontent.com')
  })

  test('notifies when the node is missing', async () => {
    const open = mock(async (): Promise<void> => undefined)
    const notices: string[] = []

    await openWebLink(
      target,
      { selectByName: () => false, notify: (m) => notices.push(m) },
      { open }
    )

    expect(notices).toHaveLength(1)
    expect(notices[0]).toContain('Button/Large/Default')
  })
})
