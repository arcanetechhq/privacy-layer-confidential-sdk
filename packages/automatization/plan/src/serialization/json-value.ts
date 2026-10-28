const BIGINT_KEYS = new Set(['amount', 'freeTokens', 'interval']);

export function planToJson(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => planToJson(item));
  }
  if (value !== null && typeof value === 'object') {
    return jsonObject(value);
  }
  return value;
}

export function restorePlanValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => restorePlanValue(item));
  }
  if (value !== null && typeof value === 'object') {
    return restoreObject(value);
  }
  return value;
}

function jsonObject(value: object): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    record[key] = planToJson(item);
  }
  return record;
}

function restoreObject(value: object): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    record[key] = BIGINT_KEYS.has(key) ? BigInt(String(item)) : restorePlanValue(item);
  }
  return record;
}
