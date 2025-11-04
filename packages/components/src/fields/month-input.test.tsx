import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonthInput } from './month-input';

describe('MonthInput', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render label and input', () => {
    render(
      <MonthInput
        id="test-month"
        label="Select Month"
        value="2024-03"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByLabelText('Select Month')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2024-03')).toBeInTheDocument();
  });

  it('should render input with type month', () => {
    render(
      <MonthInput
        id="test-month"
        label="Select Month"
        value="2024-03"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByLabelText('Select Month') as HTMLInputElement;
    expect(input.type).toBe('month');
  });

  it('should call onChange when value changes', () => {
    render(
      <MonthInput
        id="test-month"
        label="Select Month"
        value="2024-03"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByLabelText('Select Month');
    fireEvent.change(input, { target: { value: '2024-06' } });

    expect(mockOnChange).toHaveBeenCalledWith('2024-06');
  });

  it('should display required asterisk when required is true', () => {
    render(
      <MonthInput
        id="test-month"
        label="Select Month"
        value="2024-03"
        onChange={mockOnChange}
        required={true}
      />
    );

    const asterisk = screen.getByText('*');
    expect(asterisk).toBeInTheDocument();
    expect(asterisk).toHaveClass('text-destructive');
  });

  it('should not display required asterisk when required is false', () => {
    render(
      <MonthInput
        id="test-month"
        label="Select Month"
        value="2024-03"
        onChange={mockOnChange}
        required={false}
      />
    );

    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });

  it('should apply min attribute when provided', () => {
    render(
      <MonthInput
        id="test-month"
        label="Select Month"
        value="2024-03"
        onChange={mockOnChange}
        min="2024-01"
      />
    );

    const input = screen.getByLabelText('Select Month') as HTMLInputElement;
    expect(input.min).toBe('2024-01');
  });

  it('should apply max attribute when provided', () => {
    render(
      <MonthInput
        id="test-month"
        label="Select Month"
        value="2024-03"
        onChange={mockOnChange}
        max="2024-12"
      />
    );

    const input = screen.getByLabelText('Select Month') as HTMLInputElement;
    expect(input.max).toBe('2024-12');
  });

  it('should display error message when error is provided', () => {
    render(
      <MonthInput
        id="test-month"
        label="Select Month"
        value="2024-03"
        onChange={mockOnChange}
        error="Invalid month selected"
      />
    );

    expect(screen.getByText('Invalid month selected')).toBeInTheDocument();
  });

  it('should apply error styles when error is provided', () => {
    render(
      <MonthInput
        id="test-month"
        label="Select Month"
        value="2024-03"
        onChange={mockOnChange}
        error="Invalid month"
      />
    );

    const input = screen.getByLabelText('Select Month');
    expect(input).toHaveClass('border-destructive');
  });

  it('should not apply error styles when error is not provided', () => {
    render(
      <MonthInput
        id="test-month"
        label="Select Month"
        value="2024-03"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByLabelText('Select Month');
    expect(input).not.toHaveClass('border-destructive');
  });

  it('should apply custom className to container', () => {
    const { container } = render(
      <MonthInput
        id="test-month"
        label="Select Month"
        value="2024-03"
        onChange={mockOnChange}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should apply required attribute to input when required is true', () => {
    render(
      <MonthInput
        id="test-month"
        label="Select Month"
        value="2024-03"
        onChange={mockOnChange}
        required={true}
      />
    );

    const input = screen.getByDisplayValue('2024-03') as HTMLInputElement;
    expect(input.required).toBe(true);
  });

  it('should not apply required attribute to input when required is false', () => {
    render(
      <MonthInput
        id="test-month"
        label="Select Month"
        value="2024-03"
        onChange={mockOnChange}
        required={false}
      />
    );

    const input = screen.getByLabelText('Select Month') as HTMLInputElement;
    expect(input.required).toBe(false);
  });

  it('should use provided id for input and label association', () => {
    render(
      <MonthInput
        id="custom-id"
        label="Select Month"
        value="2024-03"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByLabelText('Select Month');
    expect(input.id).toBe('custom-id');
  });

  it('should handle empty value', () => {
    render(
      <MonthInput
        id="test-month"
        label="Select Month"
        value=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByLabelText('Select Month') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('should handle value change from empty to filled', () => {
    render(
      <MonthInput
        id="test-month"
        label="Select Month"
        value=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByLabelText('Select Month');
    fireEvent.change(input, { target: { value: '2024-12' } });

    expect(mockOnChange).toHaveBeenCalledWith('2024-12');
  });

  it('should render with both min and max constraints', () => {
    render(
      <MonthInput
        id="test-month"
        label="Select Month"
        value="2024-06"
        onChange={mockOnChange}
        min="2024-01"
        max="2024-12"
      />
    );

    const input = screen.getByLabelText('Select Month') as HTMLInputElement;
    expect(input.min).toBe('2024-01');
    expect(input.max).toBe('2024-12');
  });
});
