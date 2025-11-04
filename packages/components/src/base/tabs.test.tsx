import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TabsGroup, TabButton } from './tabs';

describe('TabsGroup', () => {
  const options = [
    { value: 'tab1', label: 'Tab 1' },
    { value: 'tab2', label: 'Tab 2' },
  ];

  it('should render without crashing', () => {
    const { container } = render(
      <TabsGroup
        options={options}
        activeTab="tab1"
        onTabChange={() => {}}
      />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <TabsGroup
        options={options}
        activeTab="tab1"
        onTabChange={() => {}}
        className="custom-class"
      />
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('should render all tab options', () => {
    render(
      <TabsGroup
        options={options}
        activeTab="tab1"
        onTabChange={() => {}}
      />
    );
    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
  });
});

describe('TabButton', () => {
  it('should render without crashing', () => {
    const { container } = render(<TabButton>Tab</TabButton>);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<TabButton className="custom-class">Tab</TabButton>);
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  it('should render active state', () => {
    render(<TabButton active>Active Tab</TabButton>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
