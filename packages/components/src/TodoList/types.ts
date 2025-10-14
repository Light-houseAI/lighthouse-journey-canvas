import { TodoStatus } from '@journey/schema';

export type { TodoStatus };

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