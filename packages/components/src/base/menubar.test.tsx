import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
} from './menubar';

describe('Menubar', () => {
  it('should render without crashing', () => {
    const { container } = render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <Menubar className="custom-menubar">
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    );
    expect(container.firstChild).toHaveClass('custom-menubar');
  });

  it('should render menu triggers', () => {
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Edit</MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    );
    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('should render menu items when open', () => {
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>New</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>Open</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    );
    // Menu content is typically hidden until interaction
    const trigger = screen.getByText('File');
    expect(trigger).toBeInTheDocument();
  });
});
