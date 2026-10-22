import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { TITLE_MAX, validateTitle } from '../validation';

interface Props {
  onAdd: (title: string) => Promise<void>;
}

export function AddTodoForm({ onAdd }: Props) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = validateTitle(title);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onAdd(title.trim());
      setTitle('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="add-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor="new-todo" className="visually-hidden">
        New task
      </label>
      <div className="add-row">
        <input
          id="new-todo"
          type="text"
          placeholder="What needs to be done?"
          value={title}
          maxLength={TITLE_MAX + 50}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'new-todo-error' : undefined}
          disabled={busy}
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error && (
        <p id="new-todo-error" className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
