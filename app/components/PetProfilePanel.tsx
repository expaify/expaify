'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode, Ref } from 'react'

export type StatedPetType = 'dog' | 'cat' | 'other'
export type PetWeightUnit = 'lb' | 'kg'

export interface StatedPetProfile {
  type: StatedPetType
  otherAnimalType?: string
  count: number
  knowsWeights: boolean
  weights: Array<{ value: number; unit: PetWeightUnit }>
}

export type PetProfileDraft = {
  type: StatedPetType | ''
  otherAnimalType: string
  count: string
  knowsWeights: 'yes' | 'unsure' | ''
  weights: Array<{ value: string; unit: PetWeightUnit }>
}

type FieldErrors = Partial<Record<'type' | 'otherAnimalType' | 'count' | 'knowsWeights' | `weight-${number}`, string>>

export type PetProfilePanelProps = {
  state?: 'ready' | 'loading' | 'error'
  profile?: StatedPetProfile | null
  busy?: boolean
  resultCount?: number
  resultSummary?: string
  onSave: (profile: StatedPetProfile) => void | Promise<void>
  onRemove?: () => void | Promise<void>
  onRetry?: () => void
}

function createDraft(profile?: StatedPetProfile | null): PetProfileDraft {
  if (!profile) {
    return { type: '', otherAnimalType: '', count: '1', knowsWeights: '', weights: [{ value: '', unit: 'lb' }] }
  }
  return {
    type: profile.type,
    otherAnimalType: profile.otherAnimalType ?? '',
    count: String(profile.count),
    knowsWeights: profile.knowsWeights ? 'yes' : 'unsure',
    weights: profile.knowsWeights
      ? Array.from({ length: profile.count }, (_, index) => {
          const weight = profile.weights[index]
          return weight ? { value: String(weight.value), unit: weight.unit } : { value: '', unit: 'lb' as const }
        })
      : Array.from({ length: profile.count }, () => ({ value: '', unit: 'lb' as const })),
  }
}

function profileSummary(profile: StatedPetProfile): string {
  const animal = profile.type === 'other' ? profile.otherAnimalType?.trim() || 'other animal' : profile.type
  const noun = profile.count === 1 ? animal : `${animal}s`
  const weights = profile.knowsWeights ? ` · ${profile.weights.map(weight => `${weight.value} ${weight.unit}`).join(' · ')}` : ''
  return `${profile.count} ${noun}${weights}`
}

export function validatePetProfileDraft(draft: PetProfileDraft): FieldErrors {
  const errors: FieldErrors = {}
  if (!draft.type) errors.type = 'Choose a pet type.'
  if (draft.type === 'other' && !draft.otherAnimalType.trim()) errors.otherAnimalType = 'Enter the type of animal travelling.'

  const count = Number(draft.count)
  if (!draft.count.trim() || !Number.isInteger(count)) errors.count = 'Enter a whole number of pets.'
  else if (count < 1 || count > 9) errors.count = 'Enter between 1 and 9 pets.'

  if (!draft.knowsWeights) errors.knowsWeights = "Choose Yes or Not sure."
  if (draft.knowsWeights === 'yes') {
    draft.weights.slice(0, Number.isInteger(count) && count > 0 ? count : 1).forEach((weight, index) => {
      const value = Number(weight.value)
      const maximum = weight.unit === 'kg' ? 136 : 300
      if (!weight.value.trim()) errors[`weight-${index}`] = "Enter this pet's weight, or choose Not sure."
      else if (!Number.isFinite(value) || value <= 0) errors[`weight-${index}`] = 'Enter a weight greater than 0.'
      else if (value > maximum) errors[`weight-${index}`] = 'Check this weight and enter 300 lb / 136 kg or less.'
    })
  }
  return errors
}

function FieldError({ id, children }: { id: string; children?: string }) {
  return children ? <p id={id} className="mt-1 text-xs font-medium leading-5 text-[color:var(--error)]">{children}</p> : null
}

function RadioOption({ name, value, checked, disabled, onChange, onBlur, children, inputRef, field, describedBy }: {
  name: string
  value: string
  checked: boolean
  disabled: boolean
  onChange: () => void
  onBlur?: () => void
  children: ReactNode
  inputRef?: Ref<HTMLInputElement>
  field?: string
  describedBy?: string
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-3 py-2 text-sm font-medium text-[color:var(--text-1)]">
      <input ref={inputRef} data-pet-field={field} type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} onBlur={onBlur} aria-describedby={describedBy} />
      <span>{children}</span>
    </label>
  )
}

export default function PetProfilePanel({
  state = 'ready',
  profile = null,
  busy = false,
  resultCount = 0,
  resultSummary,
  onSave,
  onRemove,
  onRetry,
}: PetProfilePanelProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<PetProfileDraft>(() => createDraft(profile))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)
  const typeRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state === 'error') errorRef.current?.focus()
  }, [state])

  function openEditor() {
    setDraft(createDraft(profile))
    setErrors({})
    setTouched(new Set())
    setOpen(true)
    requestAnimationFrame(() => typeRef.current?.focus())
  }

  function updateCount(value: string) {
    const count = Number(value)
    setDraft(current => ({
      ...current,
      count: value,
      weights: Number.isInteger(count) && count >= 1 && count <= 9
        ? Array.from({ length: count }, (_, index) => current.weights[index] ?? { value: '', unit: 'lb' })
        : current.weights,
    }))
  }

  function markTouched(field: string) {
    setTouched(current => new Set(current).add(field))
    setErrors(validatePetProfileDraft(draft))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validatePetProfileDraft(draft)
    setErrors(nextErrors)
    setTouched(new Set(Object.keys(nextErrors)))
    const firstError = Object.keys(nextErrors)[0]
    if (firstError) {
      errorRef.current?.focus()
      const control = document.querySelector<HTMLElement>(`[data-pet-field="${firstError}"]`)
      control?.focus()
      return
    }

    const count = Number(draft.count)
    await onSave({
      type: draft.type as StatedPetType,
      otherAnimalType: draft.type === 'other' ? draft.otherAnimalType.trim() : undefined,
      count,
      knowsWeights: draft.knowsWeights === 'yes',
      weights: draft.knowsWeights === 'yes'
        ? draft.weights.slice(0, count).map(weight => ({ value: Number(weight.value), unit: weight.unit }))
        : [],
    })
    setOpen(false)
    triggerRef.current?.focus()
  }

  if (state === 'loading') {
    return (
      <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3 sm:p-5" aria-busy="true">
        <h2 className="text-sm font-bold text-[color:var(--text-1)]">Your pet details</h2>
        <div className="mt-3 space-y-2" aria-hidden="true">
          <div className="skeleton h-4 w-2/3 rounded-[var(--radius-control)]" />
          <div className="skeleton h-4 w-full rounded-[var(--radius-control)]" />
          <div className="skeleton h-11 w-36 rounded-[var(--radius-control)]" />
        </div>
        <span className="sr-only" role="status" aria-live="polite">Loading your pet details…</span>
      </section>
    )
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3 sm:p-5" aria-busy={busy}>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[color:var(--text-1)]">{profile ? 'Your pet details' : 'Travelling with a pet?'}</h2>
          {profile ? <p className="mt-1 break-words text-sm font-medium text-[color:var(--text-2)]">{profileSummary(profile)}</p> : null}
          <p className="mt-1 text-xs leading-5 text-[color:var(--text-3)]">We compare your details with policies returned by hotel providers. Always confirm final acceptance and charges before booking.</p>
        </div>
        <button ref={triggerRef} type="button" onClick={openEditor} disabled={busy} aria-expanded={open} className="btn-outline min-h-11 shrink-0 rounded-[var(--radius-control)] px-3 text-sm font-bold">
          {profile ? 'Edit pet details' : 'Add pet details'}
        </button>
      </div>

      {state === 'error' ? (
        <div ref={errorRef} tabIndex={-1} role="alert" className="mt-3 rounded-[var(--radius-control)] bg-[color:var(--error-soft)] px-3 py-2 text-sm font-medium text-[color:var(--text-1)]">
          <p>We couldn&apos;t apply your pet details. Your hotel results have not changed.</p>
          {onRetry ? <button type="button" onClick={onRetry} className="mt-2 min-h-11 font-bold underline underline-offset-4">Try again</button> : null}
        </div>
      ) : null}

      {open ? (
        <form onSubmit={submit} className="mt-4 border-t border-[color:var(--border)] pt-4" noValidate>
          {Object.keys(errors).length ? (
            <div ref={errorRef} tabIndex={-1} role="alert" className="mb-4 rounded-[var(--radius-control)] bg-[color:var(--error-soft)] px-3 py-2 text-sm font-medium text-[color:var(--text-1)]">
              Pet details need attention. Review the highlighted fields.
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <fieldset aria-describedby="pet-type-error" aria-invalid={Boolean(errors.type && touched.has('type'))}>
              <legend className="block text-sm font-bold text-[color:var(--text-1)]">Type of pet</legend>
              <div className="mt-1 grid grid-cols-1 gap-2">
                {(['dog', 'cat', 'other'] as const).map((type, index) => (
                  <RadioOption key={type} inputRef={index === 0 ? typeRef : undefined} field={index === 0 ? 'type' : undefined} name="pet-type" value={type} checked={draft.type === type} disabled={busy} onChange={() => setDraft(current => ({ ...current, type }))} onBlur={() => markTouched('type')} describedBy="pet-type-error">
                    {type === 'dog' ? 'Dog' : type === 'cat' ? 'Cat' : 'Other animal'}
                  </RadioOption>
                ))}
              </div>
              <FieldError id="pet-type-error">{touched.has('type') ? errors.type : undefined}</FieldError>
            </fieldset>

            {draft.type === 'other' ? (
              <div className="sm:col-span-2">
                <label htmlFor="pet-other-type" className="block text-sm font-bold text-[color:var(--text-1)]">Animal type</label>
                <input id="pet-other-type" data-pet-field="otherAnimalType" className={`field-input mt-1 ${errors.otherAnimalType && touched.has('otherAnimalType') ? 'border-[color:var(--error)]' : ''}`} value={draft.otherAnimalType} disabled={busy} onChange={event => setDraft(current => ({ ...current, otherAnimalType: event.target.value }))} onBlur={() => markTouched('otherAnimalType')} aria-invalid={Boolean(errors.otherAnimalType && touched.has('otherAnimalType'))} aria-describedby="pet-other-helper pet-other-error" />
                <p id="pet-other-helper" className="mt-1 text-xs leading-5 text-[color:var(--text-3)]">Enter the animal type shown in the hotel&apos;s policy, if known.</p>
                <FieldError id="pet-other-error">{touched.has('otherAnimalType') ? errors.otherAnimalType : undefined}</FieldError>
              </div>
            ) : null}

            <div>
              <label htmlFor="pet-count" className="block text-sm font-bold text-[color:var(--text-1)]">Number of pets</label>
              <input id="pet-count" data-pet-field="count" className={`field-input mt-1 ${errors.count && touched.has('count') ? 'border-[color:var(--error)]' : ''}`} type="number" inputMode="numeric" min="1" max="9" step="1" value={draft.count} disabled={busy} onChange={event => updateCount(event.target.value)} onBlur={() => markTouched('count')} aria-invalid={Boolean(errors.count && touched.has('count'))} aria-describedby="pet-count-helper pet-count-error" />
              <p id="pet-count-helper" className="mt-1 text-xs leading-5 text-[color:var(--text-3)]">Enter the total travelling on this stay.</p>
              <FieldError id="pet-count-error">{touched.has('count') ? errors.count : undefined}</FieldError>
            </div>

            <fieldset className="sm:col-span-2" aria-describedby="pet-weight-known-error" aria-invalid={Boolean(errors.knowsWeights && touched.has('knowsWeights'))}>
              <legend className="block text-sm font-bold text-[color:var(--text-1)]">Do you know each pet&apos;s weight?</legend>
              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <RadioOption field="knowsWeights" name="pet-weight-known" value="yes" checked={draft.knowsWeights === 'yes'} disabled={busy} onChange={() => setDraft(current => ({ ...current, knowsWeights: 'yes' }))} onBlur={() => markTouched('knowsWeights')} describedBy="pet-weight-known-error">Yes</RadioOption>
                <RadioOption name="pet-weight-known" value="unsure" checked={draft.knowsWeights === 'unsure'} disabled={busy} onChange={() => setDraft(current => ({ ...current, knowsWeights: 'unsure' }))} onBlur={() => markTouched('knowsWeights')} describedBy="pet-weight-known-error">Not sure</RadioOption>
              </div>
              <FieldError id="pet-weight-known-error">{touched.has('knowsWeights') ? errors.knowsWeights : undefined}</FieldError>
            </fieldset>

            {draft.knowsWeights === 'yes' ? draft.weights.map((weight, index) => {
              const error = errors[`weight-${index}`]
              return (
                <div key={index}>
                  <label htmlFor={`pet-weight-${index}`} className="block text-sm font-bold text-[color:var(--text-1)]">Pet {index + 1} weight</label>
                  <div className="mt-1 grid grid-cols-[minmax(0,1fr)_5rem] gap-2">
                    <input id={`pet-weight-${index}`} data-pet-field={`weight-${index}`} className={`field-input ${error && touched.has(`weight-${index}`) ? 'border-[color:var(--error)]' : ''}`} type="number" inputMode="decimal" min="0.1" step="0.1" value={weight.value} disabled={busy} onChange={event => setDraft(current => ({ ...current, weights: current.weights.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) }))} onBlur={() => markTouched(`weight-${index}`)} aria-invalid={Boolean(error && touched.has(`weight-${index}`))} aria-describedby={`pet-weight-helper-${index} pet-weight-error-${index}`} />
                    <select aria-label={`Pet ${index + 1} weight unit`} className="field-input" value={weight.unit} disabled={busy} onChange={event => setDraft(current => ({ ...current, weights: current.weights.map((item, itemIndex) => itemIndex === index ? { ...item, unit: event.target.value as PetWeightUnit } : item) }))}>
                      <option value="lb">lb</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                  <p id={`pet-weight-helper-${index}`} className="mt-1 text-xs leading-5 text-[color:var(--text-3)]">Use the current weight for each pet.</p>
                  <FieldError id={`pet-weight-error-${index}`}>{touched.has(`weight-${index}`) ? error : undefined}</FieldError>
                </div>
              )
            }) : null}
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {profile ? <button type="button" disabled={busy} onClick={() => { setOpen(false); triggerRef.current?.focus() }} className="min-h-11 px-3 text-sm font-bold text-[color:var(--text-1)]">Cancel changes</button> : null}
            <button type="submit" disabled={busy} className="btn-primary min-h-11 rounded-[var(--radius-control)] px-4 text-sm font-bold">{busy ? 'Checking hotel policies…' : profile ? 'Update policy matches' : 'Check hotel policies'}</button>
          </div>
        </form>
      ) : null}

      {profile && !open && onRemove ? (
        <div className="mt-3">
          <button type="button" disabled={busy} onClick={() => setConfirmingRemoval(true)} className="min-h-11 text-sm font-bold underline underline-offset-4">Remove pet details</button>
          {confirmingRemoval ? (
            <div className="mt-2 rounded-[var(--radius-control)] bg-[color:var(--warning-soft)] px-3 py-2 text-sm font-medium text-[color:var(--warning)]">
              <p>Remove these pet details? Hotel policy matches will no longer be shown.</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <button type="button" disabled={busy} className="min-h-11 px-3 font-bold" onClick={() => setConfirmingRemoval(false)}>Keep details</button>
                <button type="button" disabled={busy} className="min-h-11 px-3 font-bold underline underline-offset-4" onClick={async () => { await onRemove(); setConfirmingRemoval(false); triggerRef.current?.focus() }}>Remove details</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {busy ? `Checking pet policies for ${resultCount} hotels.` : resultSummary ?? ''}
      </div>
    </section>
  )
}
