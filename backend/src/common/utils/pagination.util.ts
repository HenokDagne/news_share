export const cursorArgs = (
  cursor?: string,
): { cursor?: { id: string }; skip?: number } =>
  cursor ? { cursor: { id: cursor }, skip: 1 } : {};

export function toPage<T extends { id: string }, R>(
  rows: T[],
  limit: number,
  map: (row: T) => R,
) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    data: items.map(map),
    nextCursor: hasMore ? items[items.length - 1].id : null,
    hasMore,
  };
}
