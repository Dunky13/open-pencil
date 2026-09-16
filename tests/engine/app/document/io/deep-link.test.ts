import { describe, expect, mock, test } from 'bun:test'

import { openDeepLink, resolveDeepLinkFile } from '@/app/document/io/deep-link'

describe('resolveDeepLinkFile', () => {
  test('matches an open tab whose path ends with the relative file', () => {
    expect(resolveDeepLinkFile('web/design/hikyo.pen', ['/r/hikyo/web/design/hikyo.pen'])).toBe(
      '/r/hikyo/web/design/hikyo.pen'
    )
  })

  test('returns null when nothing matches', () => {
    expect(resolveDeepLinkFile('web/design/hikyo.pen', ['/other/x.pen'])).toBeNull()
  })

  test('does not match a partial segment', () => {
    expect(resolveDeepLinkFile('design/hikyo.pen', ['/r/redesign/hikyo.pen'])).toBeNull()
  })

  test('accepts backslashes on either side', () => {
    expect(resolveDeepLinkFile('web\\design\\hikyo.pen', ['C:\\r\\web\\design\\hikyo.pen'])).toBe(
      'C:\\r\\web\\design\\hikyo.pen'
    )
  })
})

describe('openDeepLink', () => {
  test('selects the node of an already open file without asking for a path', async () => {
    const selectByName = mock(() => true)
    const notices: string[] = []

    await openDeepLink(
      { path: 'web/design/hikyo.pen', node: 'Button/Large/Default' },
      {
        openPaths: () => ['/r/hikyo/web/design/hikyo.pen'],
        selectByName,
        notify: (message) => notices.push(message)
      }
    )

    expect(selectByName).toHaveBeenCalledWith('Button/Large/Default')
    expect(notices).toEqual([])
  })

  test('notifies when the node is missing', async () => {
    const notices: string[] = []

    await openDeepLink(
      { path: 'web/design/hikyo.pen', node: 'Nope' },
      {
        openPaths: () => ['/r/hikyo/web/design/hikyo.pen'],
        selectByName: () => false,
        notify: (message) => notices.push(message)
      }
    )

    expect(notices).toHaveLength(1)
    expect(notices[0]).toContain('Nope')
  })
})
