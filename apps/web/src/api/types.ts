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

/** The contract requires `completed` and rejects `title` with 422. */
export interface TodoUpdate {
  completed: boolean;
}

export interface ValidationErrorItem {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface ValidationErrorBody {
  detail: ValidationErrorItem[];
}
