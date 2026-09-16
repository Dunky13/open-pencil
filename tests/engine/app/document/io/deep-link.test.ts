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
    const choosePaths = mock(async (): Promise<string[]> => [])
    const openPath = mock(async (): Promise<void> => undefined)
    const notices: string[] = []

    await openDeepLink(
      { path: 'web/design/hikyo.pen', node: 'Button/Large/Default' },
      {
        openPaths: () => ['/r/hikyo/web/design/hikyo.pen'],
        selectByName,
        notify: (message) => notices.push(message)
      },
      { choosePaths, openPath }
    )

    expect(choosePaths).not.toHaveBeenCalled()
    // The opener must receive the resolved absolute path, never the link's own string.
    expect(openPath).toHaveBeenCalledTimes(1)
    expect(openPath).toHaveBeenCalledWith('/r/hikyo/web/design/hikyo.pen')
    expect(openPath).not.toHaveBeenCalledWith('web/design/hikyo.pen')
    expect(selectByName).toHaveBeenCalledWith('Button/Large/Default')
    expect(notices).toEqual([])
  })

  test('opens the picked file and selects the node when no tab matches', async () => {
    const choosePaths = mock(async () => ['/picked/web/design/hikyo.pen'])
    const openPath = mock(async (): Promise<void> => undefined)
    const selectByName = mock(() => true)
    const notices: string[] = []

    await openDeepLink(
      { path: 'web/design/hikyo.pen', node: 'Button/Large/Default' },
      {
        openPaths: () => [],
        selectByName,
        notify: (message) => notices.push(message)
      },
      { choosePaths, openPath }
    )

    expect(choosePaths).toHaveBeenCalledTimes(1)
    expect(openPath).toHaveBeenCalledTimes(1)
    expect(openPath).toHaveBeenCalledWith('/picked/web/design/hikyo.pen')
    expect(openPath).not.toHaveBeenCalledWith('web/design/hikyo.pen')
    expect(selectByName).toHaveBeenCalledWith('Button/Large/Default')
    expect(notices).toHaveLength(1)
  })

  test('notifies when the node is missing', async () => {
    const choosePaths = mock(async (): Promise<string[]> => [])
    const openPath = mock(async (): Promise<void> => undefined)
    const notices: string[] = []

    await openDeepLink(
      { path: 'web/design/hikyo.pen', node: 'Nope' },
      {
        openPaths: () => ['/r/hikyo/web/design/hikyo.pen'],
        selectByName: () => false,
        notify: (message) => notices.push(message)
      },
      { choosePaths, openPath }
    )

    expect(openPath).toHaveBeenCalledWith('/r/hikyo/web/design/hikyo.pen')
    expect(notices).toHaveLength(1)
    expect(notices[0]).toContain('Nope')
  })

  test('cancels the link when the picked file is not the requested one', async () => {
    const choosePaths = mock(async () => ['/elsewhere/other.pen'])
    const openPath = mock(async (path: string): Promise<void> => {
      throw new Error(`unexpected open of ${path}`)
    })
    const notices: string[] = []

    await openDeepLink(
      { path: 'web/design/hikyo.pen', node: 'Button' },
      {
        openPaths: () => [],
        selectByName: () => true,
        notify: (message) => notices.push(message)
      },
      { choosePaths, openPath }
    )

    expect(choosePaths).toHaveBeenCalledTimes(1)
    expect(openPath).not.toHaveBeenCalled()
    expect(notices).toHaveLength(2)
    expect(notices[1]).toContain('web/design/hikyo.pen')
  })
})
