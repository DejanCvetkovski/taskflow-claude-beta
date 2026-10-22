export type Filter = 'all' | 'active' | 'completed';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

interface Props {
  filter: Filter;
  activeCount: number;
  onChange: (filter: Filter) => void;
}

export function FilterBar({ filter, activeCount, onChange }: Props) {
  return (
    <div className="filter-bar">
      <p className="count" aria-live="polite">
        {activeCount} {activeCount === 1 ? 'task' : 'tasks'} left
      </p>
      <div role="group" aria-label="Filter tasks" className="filters">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className="btn btn-filter"
            aria-pressed={filter === f.value}
            onClick={() => onChange(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
