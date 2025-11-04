import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from './collapsible';

describe('Collapsible', () => {
  it('should render trigger without crashing', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Content</CollapsibleContent>
      </Collapsible>
    );
    expect(screen.getByText('Toggle')).toBeInTheDocument();
  });

  it('should apply custom className to trigger', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger className="custom-trigger">
          Toggle
        </CollapsibleTrigger>
      </Collapsible>
    );
    expect(screen.getByText('Toggle')).toHaveClass('custom-trigger');
  });

  it('should render content when open', () => {
    render(
      <Collapsible open>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Hidden Content</CollapsibleContent>
      </Collapsible>
    );
    expect(screen.getByText('Hidden Content')).toBeInTheDocument();
  });
});
