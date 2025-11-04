import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from './carousel';

describe('Carousel', () => {
  it('should render without crashing', () => {
    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
        </CarouselContent>
      </Carousel>
    );
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('should have carousel role', () => {
    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
        </CarouselContent>
      </Carousel>
    );
    const carousel = screen.getByRole('region');
    expect(carousel).toHaveAttribute('aria-roledescription', 'carousel');
  });

  it('should render carousel items', () => {
    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
          <CarouselItem>Item 2</CarouselItem>
        </CarouselContent>
      </Carousel>
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('should render navigation buttons', () => {
    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
          <CarouselItem>Item 2</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    );
    expect(screen.getByText('Previous slide')).toBeInTheDocument();
    expect(screen.getByText('Next slide')).toBeInTheDocument();
  });

  it('should call setApi when provided', () => {
    const setApi = vi.fn();
    render(
      <Carousel setApi={setApi}>
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
        </CarouselContent>
      </Carousel>
    );
    expect(setApi).toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <Carousel className="custom-carousel">
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
        </CarouselContent>
      </Carousel>
    );
    expect(container.querySelector('.custom-carousel')).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(
      <Carousel ref={ref}>
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
        </CarouselContent>
      </Carousel>
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('should support vertical orientation', () => {
    render(
      <Carousel orientation="vertical">
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
        </CarouselContent>
      </Carousel>
    );
    expect(screen.getByRole('region')).toBeInTheDocument();
  });
});
