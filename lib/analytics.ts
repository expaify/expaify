/** No-op analytics sink. UI call sites are instrumented now so events flow
    the day a vendor is configured; until then this logs in development only. */
export function track(
  event: string,
  props?: Record<string, string | number | boolean>
): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, props ?? {})
  }
}
