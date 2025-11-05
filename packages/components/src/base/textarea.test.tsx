import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Textarea } from './textarea';

describe('Textarea', () => {
  it('should render without crashing', () => {
    render(<Textarea />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should handle value changes', () => {
    const handleChange = vi.fn();
    render(<Textarea onChange={handleChange} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'test text' } });
    expect(handleChange).toHaveBeenCalled();
    expect(textarea).toHaveValue('test text');
  });

  it('should display placeholder text', () => {
    render(<Textarea placeholder="Enter text here..." />);
    expect(screen.getByPlaceholderText('Enter text here...')).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Textarea disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('should display value prop', () => {
    render(<Textarea value="Initial value" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('Initial value');
  });

  it('should apply custom className', () => {
    const { container } = render(<Textarea className="custom-textarea" />);
    expect(container.querySelector('.custom-textarea')).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(<Textarea ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('should support rows attribute', () => {
    render(<Textarea rows={5} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '5');
  });
});
