import type { ReactElement } from 'react'
import type { HotelCriteriaDraft, HotelSearchCriteriaV1 } from '@/lib/hotels/searchCriteria'

type EffectRecord = {
  deps?: readonly unknown[]
  nextDeps?: readonly unknown[]
  nextEffect?: () => void | (() => void)
  cleanup?: () => void
}

class HookHarness {
  states: unknown[] = []
  refs: Array<{ current: unknown }> = []
  effects: EffectRecord[] = []
  stateCursor = 0
  refCursor = 0
  effectCursor = 0
  idCursor = 0

  beginRender() {
    this.stateCursor = 0
    this.refCursor = 0
    this.effectCursor = 0
    this.idCursor = 0
  }

  useState(initial: unknown) {
    const index = this.stateCursor++
    if (index >= this.states.length) this.states[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    return [
      this.states[index],
      (next: unknown) => {
        this.states[index] = typeof next === 'function' ? (next as (current: unknown) => unknown)(this.states[index]) : next
      },
    ]
  }

  useRef(initial: unknown) {
    const index = this.refCursor++
    if (!this.refs[index]) this.refs[index] = { current: initial }
    return this.refs[index]
  }

  useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
    const index = this.effectCursor++
    const record = this.effects[index] ?? {}
    record.nextEffect = effect
    record.nextDeps = deps
    this.effects[index] = record
  }

  flushEffects() {
    this.effects.forEach(record => {
      const changed = record.deps === undefined || record.nextDeps === undefined ||
        record.deps.length !== record.nextDeps.length ||
        record.deps.some((value, index) => !Object.is(value, record.nextDeps?.[index]))
      if (!changed) return
      record.cleanup?.()
      const cleanup = record.nextEffect?.()
      record.cleanup = typeof cleanup === 'function' ? cleanup : undefined
      record.deps = record.nextDeps
    })
  }

  cleanup() {
    this.effects.forEach(record => record.cleanup?.())
  }
}

const mockHookHarness = new HookHarness()

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => mockHookHarness.useEffect(effect, deps),
    useId: () => `criteria-id-${mockHookHarness.idCursor++}`,
    useMemo: (factory: () => unknown) => factory(),
    useRef: (initial: unknown) => mockHookHarness.useRef(initial),
    useState: (initial: unknown) => mockHookHarness.useState(initial),
  }
})

jest.mock('next/link', () => ({ __esModule: true, default: 'a' }))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))

const {
  HotelSearchCriteriaEditor,
} = jest.requireActual('../HotelSearchCriteria') as typeof import('../HotelSearchCriteria')
const {
  hotelCriteriaUpdateVersion,
} = jest.requireActual('@/lib/hotels/searchCriteria') as typeof import('@/lib/hotels/searchCriteria')

type TestElement = ReactElement<Record<string, unknown>>

function childrenOf(node: TestElement): unknown[] {
  const children = node.props.children
  return Array.isArray(children) ? children : [children].filter(value => value !== null && value !== undefined)
}

function walk(node: unknown): TestElement[] {
  if (node === null || node === undefined || typeof node !== 'object') return []
  const element = node as TestElement
  if (!('props' in element)) return []
  return [element, ...childrenOf(element).flatMap(walk)]
}

function textOf(node: unknown): string {
  if (typeof node === 'string') return node
  if (node === null || node === undefined || typeof node !== 'object') return ''
  return childrenOf(node as TestElement).map(textOf).join('')
}

class FakeHTMLElement {
  focus = jest.fn(() => {
    fakeDocument.activeElement = this
  })
  querySelectorAll = jest.fn((): FakeHTMLElement[] => [])
}

const listeners = new Map<string, Set<(event: Record<string, unknown>) => void>>()
const fakeDocument = {
  activeElement: null as FakeHTMLElement | null,
  addEventListener: jest.fn((type: string, listener: (event: Record<string, unknown>) => void) => {
    const registered = listeners.get(type) ?? new Set()
    registered.add(listener)
    listeners.set(type, registered)
  }),
  removeEventListener: jest.fn((type: string, listener: (event: Record<string, unknown>) => void) => {
    listeners.get(type)?.delete(listener)
  }),
}

type EditorProps = Parameters<typeof HotelSearchCriteriaEditor>[0]

const criteria: HotelSearchCriteriaV1 = {
  schemaVersion: 1,
  criteriaVersion: '785d80de-8954-46c7-90f7-a4a04f719e5f',
  destination: { state: 'selected', city: 'Paris' },
  dates: { semantic: 'checkin_window', dateFrom: '2026-09-10', dateTo: '2026-09-13' },
  occupancy: { state: 'not_captured' },
  source: 'edit',
}

function renderEditor(overrides: Partial<EditorProps> = {}) {
  mockHookHarness.beginRender()
  const tree = HotelSearchCriteriaEditor({
    open: true,
    criteria,
    cities: ['Paris', 'Rome'],
    surface: 'results',
    onClose: jest.fn(),
    onSubmit: jest.fn(),
    ...overrides,
  })
  mockHookHarness.flushEffects()
  return tree
}

function findByText(tree: unknown, type: string, text: string): TestElement {
  const match = walk(tree).find(element => element.type === type && textOf(element) === text)
  if (!match) throw new Error(`Missing ${type} with text ${text}`)
  return match
}

function dispatchKey(key: string, shiftKey = false) {
  const event = { key, shiftKey, preventDefault: jest.fn() }
  listeners.get('keydown')?.forEach(listener => listener(event))
  return event
}

describe('HotelSearchCriteriaEditor atomic edit contract', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: FakeHTMLElement })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: fakeDocument })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        requestAnimationFrame: (callback: () => void) => {
          callback()
          return 1
        },
        cancelAnimationFrame: jest.fn(),
      },
    })
  })

  beforeEach(() => {
    mockHookHarness.cleanup()
    mockHookHarness.states = []
    mockHookHarness.refs = []
    mockHookHarness.effects = []
    listeners.clear()
    fakeDocument.activeElement = null
    jest.clearAllMocks()
  })

  it.each(['Cancel', 'Escape', 'backdrop'])('discards a dirty draft after %s and restores active criteria on reopen', closeMethod => {
    const onClose = jest.fn()
    let tree = renderEditor({ onClose })
    const destination = walk(tree).find(element => element.type === 'select')
    ;(destination?.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Rome' } })
    tree = renderEditor({ onClose })

    if (closeMethod === 'Cancel') {
      ;(findByText(tree, 'button', 'Cancel').props.onClick as () => void)()
    } else if (closeMethod === 'Escape') {
      dispatchKey('Escape')
    } else {
      const backdrop = tree as TestElement
      const eventTarget = {}
      ;(backdrop.props.onMouseDown as (event: { target: object; currentTarget: object }) => void)({
        target: eventTarget,
        currentTarget: eventTarget,
      })
    }
    expect(onClose).toHaveBeenCalledTimes(1)

    renderEditor({ open: false, onClose })
    renderEditor({ open: true, onClose })
    tree = renderEditor({ open: true, onClose })
    expect(walk(tree).find(element => element.type === 'select')?.props.value).toBe('Paris')
  })

  it('reopens an explicit failed update with its failed draft and keeps its retry version', () => {
    const failedDraft: HotelCriteriaDraft = { city: 'Rome', dateFrom: '2026-10-01', dateTo: '2026-10-04' }
    renderEditor({ open: false })
    renderEditor({ open: true, initialDraft: failedDraft })
    const tree = renderEditor({ open: true, initialDraft: failedDraft })

    expect(walk(tree).find(element => element.type === 'select')?.props.value).toBe('Rome')
    expect(hotelCriteriaUpdateVersion('same-failed-version')).toBe('same-failed-version')
  })

  it('discards an explicitly restored failed draft when Cancel is followed by an ordinary reopen', () => {
    const failedDraft: HotelCriteriaDraft = { city: 'Rome', dateFrom: '2026-10-01', dateTo: '2026-10-04' }
    renderEditor({ open: false })
    let tree = renderEditor({ open: true, initialDraft: failedDraft })
    tree = renderEditor({ open: true, initialDraft: failedDraft })
    expect(walk(tree).find(element => element.type === 'select')?.props.value).toBe('Rome')

    ;(findByText(tree, 'button', 'Cancel').props.onClick as () => void)()
    renderEditor({ open: false })
    renderEditor({ open: true })
    tree = renderEditor({ open: true })

    expect(walk(tree).find(element => element.type === 'select')?.props.value).toBe('Paris')
  })

  it('restores focus to the opener after Cancel', () => {
    const opener = new FakeHTMLElement()
    fakeDocument.activeElement = opener
    const tree = renderEditor()

    ;(findByText(tree, 'button', 'Cancel').props.onClick as () => void)()
    expect(opener.focus).toHaveBeenCalledTimes(1)
  })

  it('traps forward and reverse Tab focus inside the dialog', () => {
    renderEditor()
    const first = new FakeHTMLElement()
    const last = new FakeHTMLElement()
    const dialog = new FakeHTMLElement()
    dialog.querySelectorAll.mockReturnValue([first, last])
    mockHookHarness.refs[0].current = dialog

    fakeDocument.activeElement = last
    const forward = dispatchKey('Tab')
    expect(forward.preventDefault).toHaveBeenCalled()
    expect(first.focus).toHaveBeenCalled()

    fakeDocument.activeElement = first
    const reverse = dispatchKey('Tab', true)
    expect(reverse.preventDefault).toHaveBeenCalled()
    expect(last.focus).toHaveBeenCalled()
  })
})
