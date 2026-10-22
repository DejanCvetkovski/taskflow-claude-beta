import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeTodo, mockFetch } from '../test/fetchMock';
import { api, ApiError, GENERIC_ERROR, UNREACHABLE_ERROR } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('lists todos from the relative /api path', async () => {
    const fetchFn = mockFetch(jsonResponse([makeTodo()]));
    await expect(api.listTodos()).resolves.toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledWith('/api/todos', expect.objectContaining({}));
  });

  it('sends PATCH with a JSON body', async () => {
    const fetchFn = mockFetch(jsonResponse(makeTodo({ completed: true })));
    await api.updateTodo('abc', { completed: true });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('/api/todos/abc');
    expect(init).toMatchObject({ method: 'PATCH', body: '{"completed":true}' });
    expect((init!.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('resolves DELETE on 204 without parsing a body', async () => {
    mockFetch(jsonResponse(null, 204));
    await expect(api.deleteTodo('abc')).resolves.toBeUndefined();
  });

  it('surfaces the first detail msg from a 422', async () => {
    mockFetch(
      jsonResponse(
        { detail: [{ loc: ['body', 'title'], msg: 'Title must be 1-120 characters after trimming', type: 'value_error' }] },
        422,
      ),
    );
    await expect(api.createTodo({ title: 'x' })).rejects.toMatchObject({
      status: 422,
      message: 'Title must be 1-120 characters after trimming',
    });
  });

  it('uses a generic message for a 500', async () => {
    mockFetch(jsonResponse({ detail: 'Internal server error' }, 500));
    const err = await api.listTodos().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toBe(GENERIC_ERROR);
  });

  it('reports a network failure', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    await expect(api.listTodos()).rejects.toMatchObject({ status: 0 });
  });

  it('treats a 5xx with no JSON body as the server being unreachable', async () => {
    mockFetch(new Response('', { status: 500 }));
    await expect(api.listTodos()).rejects.toMatchObject({ status: 500, message: UNREACHABLE_ERROR });
  });
});
