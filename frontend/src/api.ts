const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api';
const TOKEN_KEY = 'baas_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface Options {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = tokenStore.get();
  const useAuth = opts.auth !== false;
  if (useAuth && token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor');
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    if (res.status === 401 && useAuth && token) {
      tokenStore.clear();
      window.location.href = '/login';
    }
    const message = Array.isArray(data?.message) ? data.message.join('; ') : (data?.message ?? `Erro ${res.status}`);
    throw new ApiError(res.status, message);
  }
  return data as T;
}
