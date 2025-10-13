export type TodoStatus = 'pending' | 'in-progress' | 'completed' | 'blocked';

export interface Todo {
  id: string;
  description: string;
  status: TodoStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface TodoListProps {
  todos: Todo[];
  onChange: (todos: Todo[]) => void;
  groupByStatus?: boolean;
  allowStatusChange?: boolean;
  placeholder?: string;
  className?: string;
}