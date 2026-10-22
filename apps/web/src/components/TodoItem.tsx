import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api/client';
import type { Todo, TodoUpdate } from '../api/types';
import { formatCreated } from '../format';
import { TITLE_MAX, validateTitle } from '../validation';

interface Props {
  todo: Todo;
  onUpdate: (id: string, body: TodoUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type Mode = 'view' | 'edit' | 'confirm-delete';

export function TodoItem({ todo, onUpdate, onDelete }: Props) {
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState(todo.title);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorId = `todo-error-${todo.id}`;
  const editId = `todo-edit-${todo.id}`;

  async function run(action: () => Promise<void>, after?: () => void) {
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
    setDraft(todo.title);
    setError(null);
    setMode('edit');
  }

  function cancelEdit() {
    setDraft(todo.title);
    setError(null);
    setMode('view');
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    const problem = validateTitle(draft);
    if (problem) {
      setError(problem);
      return;
    }
    const title = draft.trim();
    if (title === todo.title) {
      setMode('view');
      return;
    }
    void run(() => onUpdate(todo.id, { title }), () => setMode('view'));
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
            maxLength={TITLE_MAX + 50}
            autoFocus
            disabled={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelEdit();
            }}
          />
          <div className="todo-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Save
            </button>
            <button type="button" className="btn" onClick={cancelEdit} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <input
            type="checkbox"
            className="todo-check"
            checked={todo.completed}
            disabled={busy}
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
                  disabled={busy}
                  aria-label={`Yes, delete “${todo.title}”`}
                  onClick={() => void run(() => onDelete(todo.id))}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  aria-label={`No, keep “${todo.title}”`}
                  onClick={() => setMode('view')}
                >
                  No
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  aria-label={`Edit “${todo.title}”`}
                  onClick={startEdit}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  aria-label={`Delete “${todo.title}”`}
                  onClick={() => {
                    setError(null);
                    setMode('confirm-delete');
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
