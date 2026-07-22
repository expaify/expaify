describe('production analytics', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEndpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  afterEach(() => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalNodeEnv, writable: true, configurable: true });
    if (originalEndpoint === undefined) delete process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
    else process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT = originalEndpoint;
    jest.resetModules();
    jest.restoreAllMocks();
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete (globalThis as { window?: unknown }).window;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete (globalThis as { navigator?: unknown }).navigator;
  });

  it('sends categorical events to the configured production sink', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true, configurable: true });
    process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT = 'https://analytics.expaify.test/events';
    const sendBeacon = jest.fn().mockReturnValue(true);
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
    Object.defineProperty(globalThis, 'navigator', { value: { sendBeacon }, configurable: true });
    const { track } = require('../analytics') as typeof import('../analytics');

    track('hotel_invoice_need_changed', { needed: true, source: 'hotellook', partnerNamed: false });

    expect(sendBeacon).toHaveBeenCalledWith(
      'https://analytics.expaify.test/events',
      expect.any(Blob),
    );
  });

  it('does not attempt production delivery without an approved endpoint', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true, configurable: true });
    delete process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
    const sendBeacon = jest.fn();
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
    Object.defineProperty(globalThis, 'navigator', { value: { sendBeacon }, configurable: true });
    const { track } = require('../analytics') as typeof import('../analytics');

    track('hotel_invoice_need_changed', { needed: true });

    expect(sendBeacon).not.toHaveBeenCalled();
  });
});
