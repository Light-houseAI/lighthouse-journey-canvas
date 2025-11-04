import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from './context-menu';

describe('ContextMenu', () => {
  it('should render without crashing', () => {
    const { container } = render(
      <ContextMenu>
        <ContextMenuTrigger>Right click me</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Item 1</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply custom className to ContextMenuTrigger', () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger className="custom-class">Right click me</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Item</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    expect(screen.getByText('Right click me')).toHaveClass('custom-class');
  });
});
