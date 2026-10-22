// Types mirror components.schemas in docs/api/openapi.yaml.

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TodoCreate {
  title: string;
}

/** At least one field is required by the contract. */
export type TodoUpdate =
  | { title: string; completed?: boolean }
  | { title?: string; completed: boolean };

export interface ValidationErrorItem {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface ValidationErrorBody {
  detail: ValidationErrorItem[];
}
