/** UI-only flags that must not count as a data change. */
const IGNORED_KEYS = new Set(['isOffline', 'is_pending_sync']);

/** Strip query strings from URLs so rotating signed-URL tokens don't count as changes. */
const normalize = (v: any): any => {
  if (typeof v === 'string' && /^https?:\/\//.test(v)) return v.split('?')[0];
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((acc: any, k) => {
      if (!IGNORED_KEYS.has(k)) acc[k] = normalize(v[k]);
      return acc;
    }, {});
  }
  return v;
};

/**
 * Returns true if any record in `incoming` differs from the record with the same id in `existing`.
 * Used to avoid dispatching *_updated events (and re-fetch loops) when a background refresh changed nothing.
 */
export function recordsChanged(existing: any[], incoming: any[]): boolean {
  const byId = new Map(existing.map((r) => [String(r.id), r]));
  return incoming.some((r) => {
    const prev = byId.get(String(r.id));
    return !prev || JSON.stringify(normalize(prev)) !== JSON.stringify(normalize(r));
  });
}
