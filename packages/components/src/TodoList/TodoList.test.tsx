import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TodoList } from './TodoList';
import type { Todo } from './types';

describe('TodoList', () => {
  const mockOnChange = vi.fn();

  const sampleTodos: Todo[] = [
    {
      id: '1',
      description: 'Research company',
      status: 'completed',
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z'
    },
    {
      id: '2',
      description: 'Update resume',
      status: 'in-progress',
      createdAt: '2024-01-01T11:00:00Z',
      updatedAt: '2024-01-01T11:00:00Z'
    },
    {
      id: '3',
      description: 'Prepare questions',
      status: 'pending',
      createdAt: '2024-01-01T12:00:00Z',
      updatedAt: '2024-01-01T12:00:00Z'
    }
  ];

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('should render todos', () => {
    render(<TodoList todos={sampleTodos} onChange={mockOnChange} />);

    expect(screen.getByText('Research company')).toBeInTheDocument();
    expect(screen.getByText('Update resume')).toBeInTheDocument();
    expect(screen.getByText('Prepare questions')).toBeInTheDocument();
  });

  it('should render empty state when no todos', () => {
    render(<TodoList todos={[]} onChange={mockOnChange} />);

    expect(screen.getByText('No todos yet. Add one above!')).toBeInTheDocument();
  });

  it('should add a new todo', async () => {
    render(<TodoList todos={[]} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText('Add a new todo...');
    const addButton = screen.getByText('Add');

    fireEvent.change(input, { target: { value: 'New task' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            description: 'New task',
            status: 'pending'
          })
        ])
      );
    });
  });

  it('should add todo on Enter key press', async () => {
    render(<TodoList todos={[]} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText('Add a new todo...');

    fireEvent.change(input, { target: { value: 'New task' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            description: 'New task',
            status: 'pending'
          })
        ])
      );
    });
  });

  it('should not add empty todo', () => {
    render(<TodoList todos={[]} onChange={mockOnChange} />);

    const addButton = screen.getByText('Add');

    fireEvent.click(addButton);

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should delete a todo', async () => {
    render(<TodoList todos={sampleTodos} onChange={mockOnChange} />);

    const deleteButtons = screen.getAllByRole('button', { name: '' }).filter(
      button => button.querySelector('svg')
    );

    // Click the first delete button (X icon)
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: '2' }),
          expect.objectContaining({ id: '3' })
        ])
      );
    });
  });

  it('should edit todo inline', async () => {
    render(<TodoList todos={sampleTodos} onChange={mockOnChange} />);

    // Click on the todo description to start editing
    const todoText = screen.getByText('Research company');
    fireEvent.click(todoText);

    // An input should appear
    const input = screen.getByDisplayValue('Research company');
    fireEvent.change(input, { target: { value: 'Research company culture' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            description: 'Research company culture'
          })
        ])
      );
    });
  });

  it('should cancel editing on Escape key', async () => {
    render(<TodoList todos={sampleTodos} onChange={mockOnChange} />);

    // Click on the todo description to start editing
    const todoText = screen.getByText('Research company');
    fireEvent.click(todoText);

    // An input should appear
    const input = screen.getByDisplayValue('Research company');
    fireEvent.change(input, { target: { value: 'Changed text' } });
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

    // Should not call onChange
    expect(mockOnChange).not.toHaveBeenCalled();

    // Original text should still be visible
    await waitFor(() => {
      expect(screen.getByText('Research company')).toBeInTheDocument();
    });
  });

  it('should change todo status', async () => {
    render(<TodoList todos={sampleTodos} onChange={mockOnChange} />);

    // Get all select elements (native HTML selects)
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];

    // Change the first todo's status to "blocked"
    fireEvent.change(selects[0], { target: { value: 'blocked' } });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            status: 'blocked'
          })
        ])
      );
    });
  });

  it('should group todos by status when groupByStatus is true', () => {
    render(<TodoList todos={sampleTodos} onChange={mockOnChange} groupByStatus={true} />);

    expect(screen.getByText('Pending (1)')).toBeInTheDocument();
    expect(screen.getByText('In Progress (1)')).toBeInTheDocument();
    expect(screen.getByText('Completed (1)')).toBeInTheDocument();
  });

  it('should not show status change dropdown when allowStatusChange is false', () => {
    render(<TodoList todos={sampleTodos} onChange={mockOnChange} allowStatusChange={false} />);

    const selectTriggers = screen.queryAllByRole('button').filter(
      button => button.textContent?.includes('Progress') ||
                button.textContent?.includes('Pending') ||
                button.textContent?.includes('Completed')
    );

    expect(selectTriggers).toHaveLength(0);
  });

  it('should use custom placeholder text', () => {
    render(
      <TodoList
        todos={[]}
        onChange={mockOnChange}
        placeholder="Add a task to prepare..."
      />
    );

    expect(screen.getByPlaceholderText('Add a task to prepare...')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <TodoList
        todos={[]}
        onChange={mockOnChange}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});