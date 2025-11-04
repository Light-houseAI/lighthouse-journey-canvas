import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './resizable';

describe('Resizable', () => {
  it('should render without crashing', () => {
    const { container } = render(
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel>Panel 1</ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>Panel 2</ResizablePanel>
      </ResizablePanelGroup>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply custom className to ResizablePanelGroup', () => {
    const { container } = render(
      <ResizablePanelGroup direction="horizontal" className="custom-class">
        <ResizablePanel>Panel 1</ResizablePanel>
      </ResizablePanelGroup>
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('should render with handle', () => {
    const { container } = render(
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel>Panel 1</ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel>Panel 2</ResizablePanel>
      </ResizablePanelGroup>
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
