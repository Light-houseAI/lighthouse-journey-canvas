import React, { useState } from 'react';
import { Plus, X, Check, Circle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../base/button';
import { Input } from '../base/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../base/select';
import { TodoStatus } from '@journey/schema';
import type { Todo, TodoListProps } from './types';

const statusConfig: Record<TodoStatus, { label: string; icon: React.ReactNode; color: string }> = {
  [TodoStatus.Pending]: {
    label: 'Pending',
    icon: <Circle className="h-4 w-4" />,
    color: 'text-gray-500'
  },
  [TodoStatus.InProgress]: {
    label: 'In Progress',
    icon: <Clock className="h-4 w-4" />,
    color: 'text-blue-500'
  },
  [TodoStatus.Completed]: {
    label: 'Completed',
    icon: <Check className="h-4 w-4" />,
    color: 'text-green-500'
  },
  [TodoStatus.Blocked]: {
    label: 'Blocked',
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'text-red-500'
  }
};

export const TodoList: React.FC<TodoListProps> = ({
  todos,
  onChange,
  groupByStatus = false,
  allowStatusChange = true,
  placeholder = 'Add a new todo...',
  className = '',
}) => {
  const [newTodo, setNewTodo] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const handleAddTodo = () => {
    if (newTodo.trim()) {
      const todo: Todo = {
        id: Date.now().toString(),
        description: newTodo.trim(),
        status: TodoStatus.Pending,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onChange([...todos, todo]);
      setNewTodo('');
    }
  };

  const handleDeleteTodo = (id: string) => {
    onChange(todos.filter(todo => todo.id !== id));
  };

  const handleStatusChange = (id: string, status: TodoStatus) => {
    onChange(
      todos.map(todo =>
        todo.id === id
          ? { ...todo, status, updatedAt: new Date().toISOString() }
          : todo
      )
    );
  };

  const handleEditStart = (todo: Todo) => {
    setEditingId(todo.id);
    setEditingText(todo.description);
  };

  const handleEditSave = () => {
    if (editingId && editingText.trim()) {
      onChange(
        todos.map(todo =>
          todo.id === editingId
            ? { ...todo, description: editingText.trim(), updatedAt: new Date().toISOString() }
            : todo
        )
      );
      setEditingId(null);
      setEditingText('');
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingText('');
  };

  const renderTodoItem = (todo: Todo) => {
    const isEditing = editingId === todo.id;
    const config = statusConfig[todo.status];

    return (
      <div
        key={todo.id}
        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:border-gray-300 transition-colors"
      >
        <div className={config.color}>{config.icon}</div>

        {isEditing ? (
          <Input
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEditSave();
              if (e.key === 'Escape') handleEditCancel();
            }}
            className="flex-1"
            autoFocus
          />
        ) : (
          <div
            className="flex-1 cursor-pointer text-sm text-gray-700"
            onClick={() => handleEditStart(todo)}
          >
            {todo.description}
          </div>
        )}

        {isEditing ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleEditSave}
              className="h-7 w-7 p-0"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleEditCancel}
              className="h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {allowStatusChange && (
              <Select
                value={todo.status}
                onValueChange={(value) => handleStatusChange(todo.id, value as TodoStatus)}
              >
                <SelectTrigger className="h-8 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([status, config]) => (
                    <SelectItem key={status} value={status}>
                      <div className="flex items-center gap-2">
                        <span className={config.color}>{config.icon}</span>
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDeleteTodo(todo.id)}
              className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  const groupedTodos = groupByStatus
    ? Object.entries(statusConfig).reduce((acc, [status]) => {
        acc[status as TodoStatus] = todos.filter(todo => todo.status === status);
        return acc;
      }, {} as Record<TodoStatus, Todo[]>)
    : { all: todos };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Add Todo Input */}
      <div className="flex gap-2">
        <Input
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddTodo();
          }}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          onClick={handleAddTodo}
          disabled={!newTodo.trim()}
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {/* Todo List */}
      {groupByStatus ? (
        Object.entries(groupedTodos).map(([status, todosInStatus]) => {
          const config = statusConfig[status as TodoStatus];
          if (todosInStatus.length === 0) return null;

          return (
            <div key={status} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={config.color}>{config.icon}</span>
                <h3 className="text-sm font-semibold text-gray-700">
                  {config.label} ({todosInStatus.length})
                </h3>
              </div>
              <div className="space-y-2 pl-6">
                {todosInStatus.map(renderTodoItem)}
              </div>
            </div>
          );
        })
      ) : (
        <div className="space-y-2">
          {todos.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-4">
              No todos yet. Add one above!
            </div>
          ) : (
            todos.map(renderTodoItem)
          )}
        </div>
      )}
    </div>
  );
};