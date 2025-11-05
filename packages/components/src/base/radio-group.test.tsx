import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RadioGroup, RadioGroupItem } from './radio-group';

describe('RadioGroup', () => {
  it('should render without crashing', () => {
    const { container } = render(
      <RadioGroup>
        <RadioGroupItem value="option1" />
      </RadioGroup>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <RadioGroup className="custom-radio-group">
        <RadioGroupItem value="option1" />
      </RadioGroup>
    );
    expect(container.firstChild).toHaveClass('custom-radio-group');
  });

  it('should render multiple radio items', () => {
    const { container } = render(
      <RadioGroup>
        <div>
          <RadioGroupItem value="option1" id="r1" />
          <label htmlFor="r1">Option 1</label>
        </div>
        <div>
          <RadioGroupItem value="option2" id="r2" />
          <label htmlFor="r2">Option 2</label>
        </div>
      </RadioGroup>
    );
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('should apply custom className to item', () => {
    const { container } = render(
      <RadioGroup>
        <RadioGroupItem value="option1" className="custom-item" />
      </RadioGroup>
    );
    const radioItem = container.querySelector('.custom-item');
    expect(radioItem).toBeInTheDocument();
  });
});
