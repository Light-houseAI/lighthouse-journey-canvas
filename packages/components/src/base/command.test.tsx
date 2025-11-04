import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Command, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty } from './command';

describe('Command', () => {
  it('should render without crashing', () => {
    const { container } = render(<Command />);
    expect(container.querySelector('[cmdk-root]')).toBeInTheDocument();
  });

  it('should render with children', () => {
    render(
      <Command>
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandItem>Item 1</CommandItem>
        </CommandList>
      </Command>
    );
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('should handle input changes', () => {
    render(
      <Command>
        <CommandInput placeholder="Search..." />
      </Command>
    );
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(input).toHaveValue('test');
  });

  it('should render command items', () => {
    render(
      <Command>
        <CommandList>
          <CommandItem>Item 1</CommandItem>
          <CommandItem>Item 2</CommandItem>
        </CommandList>
      </Command>
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('should show empty state when no items match', () => {
    render(
      <Command>
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
        </CommandList>
      </Command>
    );
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('should render command groups', () => {
    render(
      <Command>
        <CommandList>
          <CommandGroup heading="Group 1">
            <CommandItem>Item 1</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );
    expect(screen.getByText('Group 1')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<Command className="custom-command" />);
    expect(container.querySelector('.custom-command')).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(<Command ref={ref} />);
    expect(ref.current).toBeTruthy();
  });
});
