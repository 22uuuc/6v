// JSON 字段读写助手：schema 里数组/对象字段以 String 存储

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function toJson(v: unknown): string {
  return JSON.stringify(v ?? null);
}
