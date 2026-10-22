import { vi } from 'vitest';
import type { Todo } from '../api/types';

export function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Review the API contract',
    completed: false,
    created_at: '2026-10-21T12:00:00Z',
    updated_at: '2026-10-21T12:00:00Z',
    ...overrides,
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Stubs global fetch with responses returned in order. */
export function mockFetch(...responses: (Response | Error)[]) {
  const fn = vi.fn<typeof fetch>();
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockResolvedValueOnce(r);
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}
