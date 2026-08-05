import type { ReactElement } from 'react'
import { GET } from '@/app/api/baggage/route'
import { estimateBaggageFees } from '@/lib/baggage/fees'

type TestElement = ReactElement<Record<string, unknown>>

let hookIndex = 0
let stateValues: unknown[] = []
let effectDeps: unknown[][] = []

function depsChanged(previous: unknown[] | undefined, next: unknown[] | undefined): boolean {
  if (!previous || !next) return true
  if (previous.length !== next.length) return true
  return next.some((value, index) => value !== previous[index])
}

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')

  return {
    ...actual,
    useState: jest.fn((initialValue: unknown) => {
      const index = hookIndex
      hookIndex += 1
      if (stateValues[index] === undefined) stateValues[index] = initialValue

      return [
        stateValues[index],
        (nextValue: unknown) => {
          stateValues[index] =
            typeof nextValue === 'function'
              ? (nextValue as (value: unknown) => unknown)(stateValues[index])
              : nextValue
        },
      ]
    }),
    useMemo: jest.fn((factory: () => unknown) => {
      hookIndex += 1
      return factory()
    }),
    useEffect: jest.fn((effect: () => void | (() => void), deps?: unknown[]) => {
      const index = hookIndex
      hookIndex += 1
      if (depsChanged(effectDeps[index], deps)) {
        effectDeps[index] = deps ?? []
        effect()
      }
    }),
  }
})

const { BaggageFeeEstimator } = jest.requireActual('../BaggageFeeEstimator') as typeof import('../BaggageFeeEstimator')

function resetHooks() {
  hookIndex = 0
  stateValues = []
  effectDeps = []
}

function renderEstimator(): ReactElement {
  hookIndex = 0
  return BaggageFeeEstimator({
    carrierCode: 'ZZ',
    originCountry: 'US',
    destinationCountry: 'US',
    cabinClass: 'ECONOMY',
  })
}

function childrenOf(node: TestElement): unknown[] {
  const children = node.props?.children
  return Array.isArray(children) ? children : [children].filter(Boolean)
}

function resolveFunctionElement(node: TestElement): TestElement {
  if (typeof node.type === 'function') {
    return (node.type as (props: Record<string, unknown>) => TestElement)(node.props)
  }

  return node
}

function findByAriaLabel(node: unknown, label: string): TestElement | null {
  if (!node || typeof node !== 'object') return null
  const element = resolveFunctionElement(node as TestElement)
  if (element.props?.['aria-label'] === label) return element

  for (const child of childrenOf(element)) {
    const match = findByAriaLabel(child, label)
    if (match) return match
  }

  return null
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (typeof node === 'object') return childrenOf(resolveFunctionElement(node as TestElement)).map(collectText).join('')
  return ''
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('estimateBaggageFees', () => {
  it('returns 0 for WN with 2 checked bags', () => {
    const estimate = estimateBaggageFees({
      carrierCode: 'WN',
      originCountry: 'US',
      destinationCountry: 'US',
      cabinClass: 'ECONOMY',
      checkedBags: 2,
      carryOnBags: 1,
    })

    expect(estimate.estimatedTotal).toEqual({ priceCents: 0, currency: 'USD' })
    expect(estimate.includedCheckedBags).toBe(2)
  })

  it('charges default checked-bag fees for an unknown economy carrier with low confidence', () => {
    const estimate = estimateBaggageFees({
      carrierCode: 'ZZ',
      originCountry: 'US',
      destinationCountry: 'US',
      cabinClass: 'ECONOMY',
      checkedBags: 1,
      carryOnBags: 1,
    })

    expect(estimate.estimatedTotal).toEqual({ priceCents: 4000, currency: 'USD' })
    expect(estimate.confidence).toBe('low')
  })

  it('sums multiple paid lines as exact integer cents, never floating-point dollars', () => {
    // BA: 1 carry-on included, 1 checked included, $50/$75 fees. 3 carry-on
    // + 3 checked requests -> 2 paid carry-on ($100.00) + 2 paid checked
    // ($150.00) = $250.00 exactly. Every intermediate and final value here
    // must be an integer number of cents -- if this module ever regresses to
    // dollar-float arithmetic, an equivalent case with a fee that doesn't
    // terminate cleanly in binary floating point would silently drift by a
    // fraction of a cent; asserting exact integers here catches that class
    // of regression even though these particular fee amounts happen to be
    // whole dollars.
    const estimate = estimateBaggageFees({
      carrierCode: 'BA',
      originCountry: 'US',
      destinationCountry: 'GB',
      cabinClass: 'ECONOMY',
      checkedBags: 3,
      carryOnBags: 3,
    })

    const paidCarryOn = estimate.lines.find(l => l.kind === 'carry_on' && !l.included)
    const paidChecked = estimate.lines.find(l => l.kind === 'checked_bag' && !l.included)

    expect(paidCarryOn?.quantity).toBe(2)
    expect(paidCarryOn?.unitPrice).toEqual({ priceCents: 5000, currency: 'USD' })
    expect(paidCarryOn?.total).toEqual({ priceCents: 10000, currency: 'USD' })

    expect(paidChecked?.quantity).toBe(2)
    expect(paidChecked?.unitPrice).toEqual({ priceCents: 7500, currency: 'USD' })
    expect(paidChecked?.total).toEqual({ priceCents: 15000, currency: 'USD' })

    expect(estimate.estimatedTotal).toEqual({ priceCents: 25000, currency: 'USD' })
    expect(Number.isInteger(estimate.estimatedTotal.priceCents)).toBe(true)
    for (const line of estimate.lines) {
      expect(Number.isInteger(line.total.priceCents)).toBe(true)
      expect(Number.isInteger(line.unitPrice.priceCents)).toBe(true)
    }
  })
})

describe('GET /api/baggage', () => {
  it('returns 400 for missing carrierCode', async () => {
    const response = await GET(new Request('https://expaify.test/api/baggage'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'carrierCode is required' })
  })
})

describe('BaggageFeeEstimator', () => {
  beforeEach(() => {
    resetHooks()
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input), 'https://expaify.test')
      const checkedBags = Number(url.searchParams.get('checkedBags') ?? '0')
      const data = estimateBaggageFees({
        carrierCode: url.searchParams.get('carrierCode') ?? 'ZZ',
        originCountry: url.searchParams.get('originCountry') ?? 'US',
        destinationCountry: url.searchParams.get('destinationCountry') ?? 'US',
        cabinClass: 'ECONOMY',
        checkedBags,
        carryOnBags: Number(url.searchParams.get('carryOnBags') ?? '1'),
      })

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(data),
      } as Response)
    })
  })

  it('updates the displayed total when checked bag count increases', async () => {
    let tree = renderEstimator()
    await flushPromises()
    tree = renderEstimator()

    expect(collectText(tree)).toContain('$0')

    const decreaseChecked = findByAriaLabel(tree, 'Decrease checked bags estimate')
    const increaseChecked = findByAriaLabel(tree, 'Increase checked bags estimate')
    expect(decreaseChecked?.props.disabled).toBe(true)
    expect(increaseChecked).not.toBeNull()
    expect(increaseChecked?.props.disabled).toBe(false)
    ;(increaseChecked?.props.onClick as (() => void) | undefined)?.()

    tree = renderEstimator()
    await flushPromises()
    tree = renderEstimator()

    expect(collectText(tree)).toContain('$40')

    const updatedDecreaseChecked = findByAriaLabel(tree, 'Decrease checked bags estimate')
    expect(updatedDecreaseChecked?.props.disabled).toBe(false)
    ;(updatedDecreaseChecked?.props.onClick as (() => void) | undefined)?.()

    tree = renderEstimator()
    await flushPromises()
    tree = renderEstimator()

    expect(collectText(tree)).toContain('$0')
  })

  it('renders a distinct unavailable estimate state when baggage fees cannot load', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('network unavailable')))

    let tree = renderEstimator()
    await flushPromises()
    tree = renderEstimator()

    const text = collectText(tree)
    expect(text).toContain('Baggage fee estimate unavailable right now.')
    expect(text).toContain('do not assume checked or carry-on bag fees are included')
  })

  it('does not render malformed baggage money amounts as prices', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        carrierCode: 'ZZ',
        includedCarryOnBags: 1,
        includedCheckedBags: 0,
        estimatedTotal: { priceCents: Number.NaN, currency: 'USD' },
        confidence: 'low',
        lines: [
          {
            kind: 'checked_bag',
            label: 'Checked bag estimate',
            quantity: 1,
            unitPrice: { priceCents: 4000, currency: 'USD' },
            total: { priceCents: Number.NaN, currency: 'USD' },
            included: false,
          },
        ],
        disclaimer: 'Baggage fees are estimates in USD.',
      }),
    } as Response))

    let tree = renderEstimator()
    await flushPromises()
    tree = renderEstimator()

    const text = collectText(tree)
    expect(text).toContain('Baggage fee estimate unavailable right now.')
    expect(text).not.toContain('$NaN')
  })
})
