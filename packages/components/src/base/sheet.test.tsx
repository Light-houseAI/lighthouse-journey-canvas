import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from './sheet';

describe('Sheet', () => {
  it('should render without crashing', () => {
    const { container } = render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Title</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply custom className to SheetHeader', () => {
    const { container } = render(
      <SheetHeader className="custom-class">Header content</SheetHeader>
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
