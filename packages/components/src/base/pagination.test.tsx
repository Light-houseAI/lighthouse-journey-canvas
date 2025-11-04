import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from './pagination';

describe('Pagination', () => {
  it('should render without crashing', () => {
    const { container } = render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="#">1</PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <Pagination className="custom-class">
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="#">1</PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('should render active pagination link', () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="#" isActive>
              1
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
    expect(screen.getByRole('link', { current: 'page' })).toBeInTheDocument();
  });
});
