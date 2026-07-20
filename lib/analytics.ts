type AnalyticsProps = Record<string, string | number | boolean>

export function track(event: string, props?: AnalyticsProps): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, props ?? {})
  }
}
