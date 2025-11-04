import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Alert, AlertDescription, AlertTitle } from './alert';

describe('Alert', () => {
  it('should render without crashing', () => {
    render(
      <Alert>
        <AlertTitle>Title</AlertTitle>
        <AlertDescription>Description</AlertDescription>
      </Alert>
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('should apply default variant', () => {
    const { container} = render(<Alert>Default Alert</Alert>);
    expect(container.firstChild).toHaveClass('border');
  });

  it('should apply destructive variant', () => {
    const { container } = render(<Alert variant="destructive">Destructive</Alert>);
    const alert = container.firstChild as HTMLElement;
    expect(alert).toHaveClass('border');
  });

  it('should apply custom className', () => {
    const { container } = render(<Alert className="custom-class">Alert</Alert>);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
