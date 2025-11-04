import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Select } from './select';

describe('Select', () => {
  const options = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  it('should render without crashing', () => {
    render(<Select options={options} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should render all options', () => {
    render(<Select options={options} />);
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  it('should handle value change', () => {
    const handleChange = vi.fn();
    render(<Select options={options} onChange={handleChange} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'option2' } });
    expect(handleChange).toHaveBeenCalledWith('option2');
  });

  it('should display selected value', () => {
    render(<Select options={options} value="option2" />);
    expect(screen.getByRole('combobox')).toHaveValue('option2');
  });

  it('should render placeholder when provided', () => {
    render(<Select options={options} placeholder="Select an option" />);
    expect(screen.getByText('Select an option')).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Select options={options} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('should apply custom className', () => {
    const { container } = render(<Select options={options} className="custom-select" />);
    expect(container.querySelector('.custom-select')).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(<Select options={options} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });
});
