import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from './popover';

describe('Popover', () => {
  it('should render trigger without crashing', () => {
    render(
      <Popover>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent>Content</PopoverContent>
      </Popover>
    );
    expect(screen.getByText('Open Popover')).toBeInTheDocument();
  });

  it('should apply custom className to trigger', () => {
    render(
      <Popover>
        <PopoverTrigger className="custom-trigger">
          Open
        </PopoverTrigger>
      </Popover>
    );
    expect(screen.getByText('Open')).toHaveClass('custom-trigger');
  });

  it('should render content when open', () => {
    render(
      <Popover open>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Popover content here</PopoverContent>
      </Popover>
    );
    expect(screen.getByText('Popover content here')).toBeInTheDocument();
  });

  it('should apply custom className to content', () => {
    render(
      <Popover open>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent className="custom-content">
          Content
        </PopoverContent>
      </Popover>
    );
    expect(screen.getByText('Content')).toHaveClass('custom-content');
  });
});
