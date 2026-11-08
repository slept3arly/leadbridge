export async function* iterateKeysetPages<Row, Cursor>(options: {
  count: number;
  fetchPage: (cursor: Cursor | undefined, take: number) => Promise<Row[]>;
  cursorFor: (row: Row) => Cursor;
  signal?: AbortSignal;
  batchSize: number;
}): AsyncGenerator<Row> {
  let cursor: Cursor | undefined;
  let emitted = 0;
  while (emitted < options.count && !options.signal?.aborted) {
    const take = Math.min(options.batchSize, options.count - emitted);
    const page = await options.fetchPage(cursor, take);
    if (!page.length || options.signal?.aborted) return;
    for (const row of page) {
      if (options.signal?.aborted) return;
      cursor = options.cursorFor(row);
      emitted += 1;
      yield row;
    }
    if (page.length < take) return;
  }
}
