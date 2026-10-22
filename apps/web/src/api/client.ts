import type { Todo, TodoCreate, TodoUpdate, ValidationErrorBody } from './types';

const BASE = '/api';
export const GENERIC_ERROR = 'Something went wrong. Please try again.';
export const UNREACHABLE_ERROR = 'Could not reach the server. Check your connection and try again.';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function hasDetail(body: unknown): boolean {
  return typeof body === 'object' && body !== null && 'detail' in body;
}

function isValidationBody(body: unknown): body is ValidationErrorBody {
  const detail = (body as { detail?: unknown } | null)?.detail;
  return (
    Array.isArray(detail) &&
    detail.length > 0 &&
    typeof (detail[0] as { msg?: unknown }).msg === 'string'
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    });
  } catch {
    throw new ApiError(UNREACHABLE_ERROR, 0);
  }

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    let message = res.status === 404 ? 'This task no longer exists.' : GENERIC_ERROR;
    if (res.status === 422 && isValidationBody(body)) message = body.detail[0].msg;
    // A 5xx with no JSON detail comes from a proxy (e.g. Vite with the API down), not the API.
    if (res.status >= 500 && !hasDetail(body)) message = UNREACHABLE_ERROR;
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listTodos: () => request<Todo[]>('/todos'),
  createTodo: (body: TodoCreate) =>
    request<Todo>('/todos', { method: 'POST', body: JSON.stringify(body) }),
  updateTodo: (id: string, body: TodoUpdate) =>
    request<Todo>(`/todos/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTodo: (id: string) =>
    request<void>(`/todos/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : GENERIC_ERROR;
}
