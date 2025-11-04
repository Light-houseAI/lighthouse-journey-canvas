import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ToggleGroup, ToggleGroupItem } from './toggle-group';

describe('ToggleGroup', () => {
  it('should render without crashing', () => {
    render(
      <ToggleGroup type="single">
        <ToggleGroupItem value="item1">Item 1</ToggleGroupItem>
      </ToggleGroup>
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('should render multiple items', () => {
    render(
      <ToggleGroup type="single">
        <ToggleGroupItem value="item1">Item 1</ToggleGroupItem>
        <ToggleGroupItem value="item2">Item 2</ToggleGroupItem>
        <ToggleGroupItem value="item3">Item 3</ToggleGroupItem>
      </ToggleGroup>
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('should handle value changes in single mode', () => {
    const handleValueChange = vi.fn();
    render(
      <ToggleGroup type="single" onValueChange={handleValueChange}>
        <ToggleGroupItem value="item1">Item 1</ToggleGroupItem>
        <ToggleGroupItem value="item2">Item 2</ToggleGroupItem>
      </ToggleGroup>
    );
    fireEvent.click(screen.getByText('Item 1'));
    expect(handleValueChange).toHaveBeenCalledWith('item1');
  });

  it('should handle value changes in multiple mode', () => {
    const handleValueChange = vi.fn();
    render(
      <ToggleGroup type="multiple" onValueChange={handleValueChange}>
        <ToggleGroupItem value="item1">Item 1</ToggleGroupItem>
        <ToggleGroupItem value="item2">Item 2</ToggleGroupItem>
      </ToggleGroup>
    );
    fireEvent.click(screen.getByText('Item 1'));
    expect(handleValueChange).toHaveBeenCalledWith(['item1']);
  });

  it('should display selected value in single mode', () => {
    render(
      <ToggleGroup type="single" value="item2">
        <ToggleGroupItem value="item1">Item 1</ToggleGroupItem>
        <ToggleGroupItem value="item2">Item 2</ToggleGroupItem>
      </ToggleGroup>
    );
    const item2 = screen.getByText('Item 2');
    expect(item2).toHaveAttribute('data-state', 'on');
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <ToggleGroup type="single" disabled>
        <ToggleGroupItem value="item1">Item 1</ToggleGroupItem>
      </ToggleGroup>
    );
    expect(screen.getByText('Item 1')).toBeDisabled();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ToggleGroup type="single" className="custom-toggle-group">
        <ToggleGroupItem value="item1">Item 1</ToggleGroupItem>
      </ToggleGroup>
    );
    expect(container.querySelector('.custom-toggle-group')).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(
      <ToggleGroup type="single" ref={ref}>
        <ToggleGroupItem value="item1">Item 1</ToggleGroupItem>
      </ToggleGroup>
    );
    expect(ref.current).toBeTruthy();
  });

  it('should support different variants', () => {
    render(
      <ToggleGroup type="single" variant="outline">
        <ToggleGroupItem value="item1">Item 1</ToggleGroupItem>
      </ToggleGroup>
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });
});
