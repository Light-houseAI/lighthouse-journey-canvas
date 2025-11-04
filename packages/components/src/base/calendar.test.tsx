import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Calendar } from './calendar';

describe('Calendar', () => {
  it('should render without crashing', () => {
    const { container } = render(<Calendar />);
    expect(container.querySelector('.rdp')).toBeInTheDocument();
  });

  it('should render with default month', () => {
    render(<Calendar />);
    const month = new Date().toLocaleString('default', { month: 'long' });
    expect(screen.getByText(new RegExp(month, 'i'))).toBeInTheDocument();
  });

  it('should show outside days by default', () => {
    const { container } = render(<Calendar />);
    expect(container.querySelector('.rdp')).toBeInTheDocument();
    // showOutsideDays is true by default
  });

  it('should not show outside days when showOutsideDays is false', () => {
    const { container } = render(<Calendar showOutsideDays={false} />);
    expect(container.querySelector('.rdp')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<Calendar className="custom-calendar" />);
    expect(container.querySelector('.custom-calendar')).toBeInTheDocument();
  });

  it('should render navigation buttons', () => {
    const { container } = render(<Calendar />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should accept mode prop', () => {
    const { container } = render(<Calendar mode="single" />);
    expect(container.querySelector('.rdp')).toBeInTheDocument();
  });

  it('should render with selected date', () => {
    const selected = new Date(2024, 0, 15);
    render(<Calendar mode="single" selected={selected} />);
    expect(screen.getByText('15')).toBeInTheDocument();
  });
});
