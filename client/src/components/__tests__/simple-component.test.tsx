/**
 * Simple Component Test to validate setup
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Simple test component
const TestComponent = ({ message }: { message: string }) => {
  return <div data-testid="test-message">{message}</div>;
};

describe('Simple Component Test', () => {
  it('should render message', () => {
    const message = 'Hello World';
    render(<TestComponent message={message} />);
    
    expect(screen.getByTestId('test-message')).toHaveTextContent(message);
  });

  it('should handle empty message', () => {
    render(<TestComponent message="" />);
    
    expect(screen.getByTestId('test-message')).toHaveTextContent('');
  });
});