import { useEffect, useRef, useState, type FormEvent } from 'react';
import { errorMessage } from '../api/client';
import type { Todo, TodoUpdate } from '../api/types';
import { formatCreated } from '../format';
import { validateTitle } from '../validation';

interface Props {
  todo: Todo;
  onUpdate: (id: string, body: TodoUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type Mode = 'view' | 'edit' | 'confirm-delete';
type FocusTarget = 'edit' | 'delete' | 'no';

export function checkboxId(todoId: string): string {
  return `todo-check-${todoId}`;
}

// Controls use aria-disabled rather than disabled while a request is in flight,
// because a disabled element drops keyboard focus to <body>.
export function TodoItem({ todo, onUpdate, onDelete }: Props) {
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState(todo.title);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const noButton = useRef<HTMLButtonElement>(null);
  const focusAfterRender = useRef<FocusTarget | null>(null);
  const errorId = `todo-error-${todo.id}`;
  const editId = `todo-edit-${todo.id}`;

  useEffect(() => {
    const target = focusAfterRender.current;
    focusAfterRender.current = null;
    if (target === 'edit') editButton.current?.focus();
    if (target === 'delete') deleteButton.current?.focus();
    if (target === 'no') noButton.current?.focus();
  }, [mode]);

  function switchMode(next: Mode, focus: FocusTarget | null = null) {
    focusAfterRender.current = focus;
    setMode(next);
  }

  async function run(action: () => Promise<void>, after?: () => void) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      after?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    if (busy) return;
    setDraft(todo.title);
    setError(null);
    switchMode('edit');
  }

  function cancelEdit() {
    if (busy) return;
    setDraft(todo.title);
    setError(null);
    switchMode('view', 'edit');
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const problem = validateTitle(draft);
    if (problem) {
      setError(problem);
      return;
    }
    const title = draft.trim();
    if (title === todo.title) {
      switchMode('view', 'edit');
      return;
    }
    void run(() => onUpdate(todo.id, { title }), () => switchMode('view', 'edit'));
  }

  return (
    <li className={`todo${todo.completed ? ' todo-done' : ''}`}>
      {mode === 'edit' ? (
        <form className="todo-edit" onSubmit={handleSave} noValidate>
          <label htmlFor={editId} className="visually-hidden">
            Edit title for “{todo.title}”
          </label>
          <input
            id={editId}
            type="text"
            value={draft}
            autoFocus
            readOnly={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelEdit();
            }}
          />
          <div className="todo-actions">
            <button type="submit" className="btn btn-primary" aria-disabled={busy || undefined}>
              Save
            </button>
            <button type="button" className="btn" onClick={cancelEdit} aria-disabled={busy || undefined}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
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
              <>
                <button
                  ref={editButton}
                  type="button"
                  className="btn"
                  aria-disabled={busy || undefined}
                  aria-label={`Edit “${todo.title}”`}
                  onClick={startEdit}
                >
                  Edit
                </button>
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
              </>
            )}
          </div>
        </>
      )}
      {error && (
        <p id={errorId} className="field-error todo-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
