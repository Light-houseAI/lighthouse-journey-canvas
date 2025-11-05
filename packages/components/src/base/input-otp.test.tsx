import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InputOTP, InputOTPGroup, InputOTPSlot } from './input-otp';

describe('InputOTP', () => {
  it('should render without crashing', () => {
    const { container } = render(
      <InputOTP maxLength={6}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
        </InputOTPGroup>
      </InputOTP>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <InputOTP maxLength={6} className="custom-class">
        <InputOTPGroup>
          <InputOTPSlot index={0} />
        </InputOTPGroup>
      </InputOTP>
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
