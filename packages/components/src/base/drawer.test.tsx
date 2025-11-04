import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from './drawer';

describe('Drawer', () => {
  it('should render without crashing', () => {
    const { container } = render(
      <Drawer>
        <DrawerTrigger>Open</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Title</DrawerTitle>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply custom className to DrawerHeader', () => {
    const { container } = render(
      <DrawerHeader className="custom-class">Header content</DrawerHeader>
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
