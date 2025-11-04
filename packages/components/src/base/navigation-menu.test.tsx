import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from './navigation-menu';

describe('NavigationMenu', () => {
  it('should render without crashing', () => {
    const { container } = render(
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink>Home</NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <NavigationMenu className="custom-nav">
        <NavigationMenuList>
          <NavigationMenuItem>Item</NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    );
    expect(container.firstChild).toHaveClass('custom-nav');
  });

  it('should render menu items', () => {
    render(
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink>Home</NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink>About</NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('should render trigger with content', () => {
    render(
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Products</NavigationMenuTrigger>
            <NavigationMenuContent>
              <div>Product List</div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    );
    expect(screen.getByText('Products')).toBeInTheDocument();
  });
});
