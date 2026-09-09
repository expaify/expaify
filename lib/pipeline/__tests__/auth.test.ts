import { isValidPipelineSecret } from '../auth'

function reqWithAuth(header: string | null): { headers: { get: (name: string) => string | null } } {
  return { headers: { get: () => header } }
}

describe('isValidPipelineSecret', () => {
  const originalSecret = process.env.PIPELINE_SECRET

  afterEach(() => {
    process.env.PIPELINE_SECRET = originalSecret
  })

  it('accepts the correct bearer token', () => {
    process.env.PIPELINE_SECRET = 'real-secret-value'
    expect(isValidPipelineSecret(reqWithAuth('Bearer real-secret-value') as never)).toBe(true)
  })

  it('rejects a wrong token of the same length', () => {
    process.env.PIPELINE_SECRET = 'real-secret-value'
    expect(isValidPipelineSecret(reqWithAuth('Bearer wrong-secret-values'.slice(0, 'Bearer real-secret-value'.length)) as never)).toBe(false)
  })

  it('rejects a token of a different length without throwing', () => {
    process.env.PIPELINE_SECRET = 'real-secret-value'
    expect(() => isValidPipelineSecret(reqWithAuth('Bearer short') as never)).not.toThrow()
    expect(isValidPipelineSecret(reqWithAuth('Bearer short') as never)).toBe(false)
  })

  it('rejects a missing authorization header', () => {
    process.env.PIPELINE_SECRET = 'real-secret-value'
    expect(isValidPipelineSecret(reqWithAuth(null) as never)).toBe(false)
  })

  it('fails closed when PIPELINE_SECRET is not configured, even if header happens to match', () => {
    delete process.env.PIPELINE_SECRET
    expect(isValidPipelineSecret(reqWithAuth('Bearer undefined') as never)).toBe(false)
  })
})
