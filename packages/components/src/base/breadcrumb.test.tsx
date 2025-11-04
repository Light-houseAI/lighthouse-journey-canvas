import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './breadcrumb';

describe('Breadcrumb', () => {
  it('should render without crashing', () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
    expect(container.querySelector('nav')).toBeInTheDocument();
  });

  it('should apply custom className to list', () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList className="custom-list">
          <BreadcrumbItem>Home</BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
    expect(container.querySelector('.custom-list')).toBeInTheDocument();
  });

  it('should render breadcrumb items and links', () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Current</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('should render separator between items', () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>Home</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>Docs</BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
    const separator = container.querySelector('[role="presentation"]');
    expect(separator).toBeInTheDocument();
  });
});
