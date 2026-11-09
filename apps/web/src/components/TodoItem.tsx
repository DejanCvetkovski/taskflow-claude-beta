import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import type { Todo, TodoUpdate } from '../api/types';
import { formatCreated } from '../format';

interface Props {
  todo: Todo;
  onUpdate: (id: string, body: TodoUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type Mode = 'view' | 'confirm-delete';
type FocusTarget = 'delete' | 'no';

export function checkboxId(todoId: string): string {
  return `todo-check-${todoId}`;
}

// Controls use aria-disabled rather than disabled while a request is in flight,
// because a disabled element drops keyboard focus to <body>.
export function TodoItem({ todo, onUpdate, onDelete }: Props) {
  const [mode, setMode] = useState<Mode>('view');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const noButton = useRef<HTMLButtonElement>(null);
  const focusAfterRender = useRef<FocusTarget | null>(null);
  const errorId = `todo-error-${todo.id}`;

  useEffect(() => {
    const target = focusAfterRender.current;
    focusAfterRender.current = null;
    if (target === 'delete') deleteButton.current?.focus();
    if (target === 'no') noButton.current?.focus();
  }, [mode]);

  function switchMode(next: Mode, focus: FocusTarget | null = null) {
    focusAfterRender.current = focus;
    setMode(next);
  }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`todo${todo.completed ? ' todo-done' : ''}`}>
      <input
        id={checkboxId(todo.id)}
        type="checkbox"
        className="todo-check"
        checked={todo.completed}
        aria-disabled={busy || undefined}
        aria-label={`Mark “${todo.title}” as ${todo.completed ? 'active' : 'completed'}`}
        onChange={() => void run(() => onUpdate(todo.id, { completed: !todo.completed }))}
      />
      <div className="todo-body">
        <span className="todo-title">{todo.title}</span>
        <time className="todo-time" dateTime={todo.created_at}>
          {formatCreated(todo.created_at)}
        </time>
      </div>
      <div className="todo-actions">
        {mode === 'confirm-delete' ? (
          <>
            <span className="confirm-text">Delete?</span>
            <button
              type="button"
              className="btn btn-danger"
              aria-disabled={busy || undefined}
              aria-label={`Yes, delete “${todo.title}”`}
              onClick={() => void run(() => onDelete(todo.id))}
            >
              Yes
            </button>
            <button
              ref={noButton}
              type="button"
              className="btn"
              aria-disabled={busy || undefined}
              aria-label={`No, keep “${todo.title}”`}
              onClick={() => {
                if (!busy) switchMode('view', 'delete');
              }}
            >
              No
            </button>
          </>
        ) : (
          <button
            ref={deleteButton}
            type="button"
            className="btn"
            aria-disabled={busy || undefined}
            aria-label={`Delete “${todo.title}”`}
            onClick={() => {
              if (busy) return;
              setError(null);
              switchMode('confirm-delete', 'no');
            }}
          >
            Delete
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="field-error todo-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
