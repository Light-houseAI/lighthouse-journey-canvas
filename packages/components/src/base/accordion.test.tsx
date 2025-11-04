import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './accordion';

describe('Accordion', () => {
  it('should render without crashing', () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Trigger</AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(screen.getByText('Trigger')).toBeInTheDocument();
  });

  it('should apply custom className to Accordion', () => {
    const { container } = render(
      <Accordion type="single" className="custom-accordion">
        <AccordionItem value="item-1">
          <AccordionTrigger>Trigger</AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(container.querySelector('.custom-accordion')).toBeInTheDocument();
  });

  it('should render AccordionTrigger as button', () => {
    render(
      <Accordion type="single">
        <AccordionItem value="item-1">
          <AccordionTrigger>Trigger</AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(screen.getByRole('button', { name: 'Trigger' })).toBeInTheDocument();
  });
});
