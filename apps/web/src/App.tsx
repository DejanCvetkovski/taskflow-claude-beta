import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from './api/client';
import type { Todo, TodoUpdate } from './api/types';
import { AddTodoForm } from './components/AddTodoForm';
import { FilterBar, type Filter } from './components/FilterBar';
import { TodoItem } from './components/TodoItem';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' };

const EMPTY_TEXT: Record<Filter, string> = {
  all: 'No tasks yet. Add your first one above.',
  active: 'No active tasks. Nice work!',
  completed: 'No completed tasks yet.',
};

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [filter, setFilter] = useState<Filter>('all');

  const fetchTodos = useCallback(async () => {
    setLoad({ status: 'loading' });
    try {
      setTodos(await api.listTodos());
      setLoad({ status: 'ready' });
    } catch (err) {
      setLoad({ status: 'error', message: errorMessage(err) });
    }
  }, []);

  useEffect(() => {
    void fetchTodos();
  }, [fetchTodos]);

  // Updates are non-optimistic: state changes only after the server responds.
  async function handleAdd(title: string) {
    const created = await api.createTodo({ title });
    setTodos((prev) => [created, ...prev]);
  }

  async function handleUpdate(id: string, body: TodoUpdate) {
    const updated = await api.updateTodo(id, body);
    setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function handleDelete(id: string) {
    await api.deleteTodo(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  const activeCount = todos.filter((t) => !t.completed).length;
  const visible = todos.filter((t) =>
    filter === 'all' ? true : filter === 'active' ? !t.completed : t.completed,
  );

  return (
    <main className="app">
      <header>
        <h1>TaskFlow</h1>
      </header>

      <AddTodoForm onAdd={handleAdd} />

      {load.status === 'loading' && (
        <p className="status" role="status">
          Loading tasks…
        </p>
      )}

      {load.status === 'error' && (
        <div className="status status-error" role="alert">
          <p>Could not load tasks. {load.message}</p>
          <button type="button" className="btn btn-primary" onClick={() => void fetchTodos()}>
            Retry
          </button>
        </div>
      )}

      {load.status === 'ready' && (
        <section aria-label="Tasks">
          <FilterBar filter={filter} activeCount={activeCount} onChange={setFilter} />
          {visible.length === 0 ? (
            <p className="status empty">{todos.length === 0 ? EMPTY_TEXT.all : EMPTY_TEXT[filter]}</p>
          ) : (
            <ul className="todo-list">
              {visible.map((todo) => (
                <TodoItem key={todo.id} todo={todo} onUpdate={handleUpdate} onDelete={handleDelete} />
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
