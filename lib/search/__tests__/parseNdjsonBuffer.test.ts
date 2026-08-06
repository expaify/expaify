import { extractNdjsonLines } from '../parseNdjsonBuffer';

describe('extractNdjsonLines', () => {
  it('parses multiple complete lines and carries an incomplete trailing line as remainder', () => {
    const chunk = '{"type":"flights","data":[]}\n{"type":"done"}\n{"type":"sugg';

    const { events, remainder } = extractNdjsonLines(chunk);

    expect(events).toEqual([
      { type: 'flights', data: [] },
      { type: 'done' },
    ]);
    expect(remainder).toBe('{"type":"sugg');
  });

  it('skips blank lines without producing an event', () => {
    const { events, remainder } = extractNdjsonLines('\n\n{"type":"done"}\n\n');

    expect(events).toEqual([{ type: 'done' }]);
    expect(remainder).toBe('');
  });

  it('returns the whole buffer as remainder when no newline has arrived yet', () => {
    const { events, remainder } = extractNdjsonLines('{"type":"flights"');

    expect(events).toEqual([]);
    expect(remainder).toBe('{"type":"flights"');
  });

  it('turns an unparseable line into a malformed_response notice instead of throwing or dropping it', () => {
    const { events, remainder } = extractNdjsonLines('not valid json at all\n');

    expect(events).toEqual([
      {
        type: 'notice',
        provider: 'Search stream',
        status: 'malformed_response',
        message: 'Received an unreadable line from the search stream.',
      },
    ]);
    expect(remainder).toBe('');
  });

  it('handles a buffer spanning many chunks by repeated calls', () => {
    let buffer = '';
    const allEvents: unknown[] = [];

    for (const piece of ['{"type":"fl', 'ights","data":[]}\n{"typ', 'e":"done"}\n']) {
      buffer += piece;
      const { events, remainder } = extractNdjsonLines(buffer);
      allEvents.push(...events);
      buffer = remainder;
    }

    expect(allEvents).toEqual([
      { type: 'flights', data: [] },
      { type: 'done' },
    ]);
    expect(buffer).toBe('');
  });
});
