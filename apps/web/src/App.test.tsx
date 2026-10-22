import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { jsonResponse, makeTodo, mockFetch } from './test/fetchMock';

afterEach(() => vi.unstubAllGlobals());

const milk = makeTodo({ id: '11111111-1111-4111-8111-111111111111', title: 'Buy milk' });
const report = makeTodo({
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Write report',
  completed: true,
});

async function renderLoaded(todos = [milk, report], ...more: Response[]) {
  const fetchFn = mockFetch(jsonResponse(todos), ...more);
  render(<App />);
  await screen.findByRole('region', { name: 'Tasks' });
  return fetchFn;
}

describe('App', () => {
  it('shows loading, then the error state, and recovers on Retry', async () => {
    mockFetch(jsonResponse({ detail: 'Internal server error' }, 500), jsonResponse([milk]));
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not load tasks/i);
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Buy milk')).toBeInTheDocument();
  });

  it('shows an empty state when there are no todos', async () => {
    await renderLoaded([]);
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
    expect(screen.getByText('0 tasks left')).toBeInTheDocument();
  });

  it('rejects a whitespace-only title without calling the API', async () => {
    const fetchFn = await renderLoaded();
    await userEvent.type(screen.getByLabelText('New task'), '   {Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent(/enter a task title/i);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('creates a todo on Enter with the trimmed title and prepends it', async () => {
    const created = makeTodo({ id: '33333333-3333-4333-8333-333333333333', title: 'New task' });
    const fetchFn = await renderLoaded([milk], jsonResponse(created, 201));

    const input = screen.getByLabelText('New task');
    await userEvent.type(input, '  New task  {Enter}');

    await screen.findByText('New task', { selector: '.todo-title' });
    expect(fetchFn.mock.calls[1][1]).toMatchObject({ method: 'POST', body: '{"title":"New task"}' });
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('New task');
    expect(input).toHaveValue('');
    expect(screen.getByText('2 tasks left')).toBeInTheDocument();
  });

  it('shows the server 422 message when create is rejected', async () => {
    await renderLoaded(
      [milk],
      jsonResponse({ detail: [{ loc: ['body', 'title'], msg: 'Title is not allowed', type: 'value_error' }] }, 422),
    );
    await userEvent.type(screen.getByLabelText('New task'), 'Bad');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Title is not allowed');
  });

  it('filters by status and keeps the active count', async () => {
    await renderLoaded();
    expect(screen.getByText('1 task left')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Active' }));
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
    expect(screen.queryByText('Write report')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Completed' }));
    expect(screen.getByText('Write report')).toBeInTheDocument();
    expect(screen.queryByText('Buy milk')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Completed' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles completion only after the server responds', async () => {
    let resolve!: (r: Response) => void;
    const fetchFn = await renderLoaded([milk]);
    fetchFn.mockImplementationOnce(() => new Promise<Response>((r) => (resolve = r)));

    const checkbox = screen.getByRole('checkbox', { name: /buy milk/i });
    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(fetchFn.mock.calls[1]).toEqual([
      '/api/todos/11111111-1111-4111-8111-111111111111',
      expect.objectContaining({ method: 'PATCH', body: '{"completed":true}' }),
    ]);

    resolve(jsonResponse({ ...milk, completed: true }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /buy milk/i })).toBeChecked());
    expect(screen.getByText('0 tasks left')).toBeInTheDocument();
  });

  it('keeps a toggled todo consistent with the active filter', async () => {
    await renderLoaded([milk], jsonResponse({ ...milk, completed: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Active' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /buy milk/i }));
    expect(await screen.findByText(/no active tasks/i)).toBeInTheDocument();
  });

  it('edits a title with Save and restores it on Cancel', async () => {
    const fetchFn = await renderLoaded([milk], jsonResponse({ ...milk, title: 'Buy oat milk' }));

    await userEvent.click(screen.getByRole('button', { name: /edit “buy milk”/i }));
    const field = screen.getByLabelText(/edit title/i);
    await userEvent.clear(field);
    await userEvent.type(field, 'Something else');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /edit “buy milk”/i }));
    expect(screen.getByLabelText(/edit title/i)).toHaveValue('Buy milk');
    await userEvent.clear(screen.getByLabelText(/edit title/i));
    await userEvent.type(screen.getByLabelText(/edit title/i), ' Buy oat milk ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Buy oat milk')).toBeInTheDocument();
    expect(fetchFn.mock.calls[1][1]).toMatchObject({ method: 'PATCH', body: '{"title":"Buy oat milk"}' });
  });

  it('validates the edited title', async () => {
    await renderLoaded([milk]);
    await userEvent.click(screen.getByRole('button', { name: /edit “buy milk”/i }));
    await userEvent.clear(screen.getByLabelText(/edit title/i));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/enter a task title/i);
  });

  it('deletes after inline confirmation, and No keeps the todo', async () => {
    const fetchFn = await renderLoaded([milk], jsonResponse(null, 204));

    await userEvent.click(screen.getByRole('button', { name: /delete “buy milk”/i }));
    await userEvent.click(screen.getByRole('button', { name: /no, keep/i }));
    expect(screen.getByText('Buy milk')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /delete “buy milk”/i }));
    expect(screen.getByText('Delete?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /yes, delete/i }));

    await waitFor(() => expect(screen.queryByText('Buy milk')).not.toBeInTheDocument());
    expect(fetchFn.mock.calls[1][1]).toMatchObject({ method: 'DELETE' });
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });

  it('shows an error and keeps the todo when delete fails', async () => {
    await renderLoaded([milk], jsonResponse({ detail: 'Todo not found' }, 404));
    await userEvent.click(screen.getByRole('button', { name: /delete “buy milk”/i }));
    await userEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer exists/i);
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
  });
});
