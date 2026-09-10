/** Matches the unlock API's deal ID shape; tracked-hotel IDs are ineligible. */
export function isUnlockableDealId(id: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(id)
}
