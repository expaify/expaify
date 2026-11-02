import { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import { DealLoadingTransition } from '../DealLoadingTransition'

let mockEnabled = true
jest.mock('../DealMotion', () => ({
  useDealMotion: () => ({ enabled: mockEnabled, transition: { duration: mockEnabled ? 0.3 : 0 } }),
}))

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

it.each([true, false])('keeps only the current card set with motion enabled=%s', async enabled => {
  mockEnabled = enabled
  let renderer: ReactTestRenderer
  const view = (loading: boolean, city?: string) => (
    <DealLoadingTransition loading={loading} skeleton={<span>Loading hotels</span>}>
      {city ? <article key={city}>{city}</article> : null}
    </DealLoadingTransition>
  )
  await act(async () => { renderer = create(view(true)) })
  expect(renderer!.root.findAllByType('article')).toHaveLength(0)
  await act(async () => { renderer!.update(view(false, 'Miami')) })
  expect(renderer!.root.findAllByType('article').map(node => node.children)).toEqual([['Miami']])
  await act(async () => { renderer!.update(view(false, 'Boston')) })
  expect(renderer!.root.findAllByType('article').map(node => node.children)).toEqual([['Boston']])
  await act(async () => { renderer!.update(view(true)) })
  expect(renderer!.root.findAllByType('article')).toHaveLength(0)
  await act(async () => { renderer!.update(view(false)) })
  expect(renderer!.root.findAllByType('article')).toHaveLength(0)
  if (!enabled) expect(JSON.stringify(renderer!.toJSON())).not.toContain('Loading hotels')
  await act(async () => { renderer!.unmount() })
})
