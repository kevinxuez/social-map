export const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, credentials: 'include' });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}