import { expect, test } from 'bun:test'

import { findNodesByName } from '@/app/editor/selection/select-by-name'

import { firstPageId, makeSceneGraph } from '#tests/helpers/scene'

test('finds every node with the exact name and nothing else', () => {
  const graph = makeSceneGraph()
  const pageId = firstPageId(graph)
  const frame = graph.createNode('FRAME', pageId, { name: 'Card' })
  const exact = graph.createNode('RECTANGLE', frame.id, { name: 'Button' })
  graph.createNode('RECTANGLE', frame.id, { name: 'Button/Primary' })
  graph.createNode('TEXT', frame.id, { name: 'button' })

  expect(findNodesByName(graph, pageId, 'Button')).toEqual([exact.id])
  expect(findNodesByName(graph, pageId, 'Missing')).toEqual([])
})

test('walks nested groups rather than only the first level', () => {
  const graph = makeSceneGraph()
  const pageId = firstPageId(graph)
  const outer = graph.createNode('FRAME', pageId, { name: 'Outer' })
  const inner = graph.createNode('GROUP', outer.id, { name: 'Inner' })
  const leaf = graph.createNode('RECTANGLE', inner.id, { name: 'Deep' })

  expect(findNodesByName(graph, pageId, 'Deep')).toEqual([leaf.id])
})
