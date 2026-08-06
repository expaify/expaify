/**
 * Splits a growing text buffer (as decoded from a fetch NDJSON body stream)
 * into complete, parsed JSON lines plus whatever incomplete trailing text
 * should be carried into the next chunk.
 *
 * A line that isn't valid JSON is not silently dropped — it's turned into a
 * synthetic `notice` event so callers can surface it the same way they'd
 * surface any other provider notice, instead of the stream going quiet with
 * no explanation.
 */
export type ParsedNdjsonChunk = {
  events: unknown[];
  remainder: string;
};

export function extractNdjsonLines(buffer: string): ParsedNdjsonChunk {
  const events: unknown[] = [];
  let remainder = buffer;
  let newlineIndex = remainder.indexOf('\n');

  while (newlineIndex >= 0) {
    const line = remainder.slice(0, newlineIndex).trim();
    remainder = remainder.slice(newlineIndex + 1);

    if (line) {
      try {
        events.push(JSON.parse(line));
      } catch {
        events.push({
          type: 'notice',
          provider: 'Search stream',
          status: 'malformed_response',
          message: 'Received an unreadable line from the search stream.',
        });
      }
    }

    newlineIndex = remainder.indexOf('\n');
  }

  return { events, remainder };
}
