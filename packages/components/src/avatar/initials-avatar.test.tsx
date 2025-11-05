import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InitialsAvatar, getInitials } from './initials-avatar';

describe('InitialsAvatar', () => {
  describe('getInitials function', () => {
    it('should extract first and last initials from full name', () => {
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('should extract first and last initials from name with multiple middle names', () => {
      expect(getInitials('John Michael William Doe')).toBe('JD');
    });

    it('should extract first two characters from single name', () => {
      expect(getInitials('Madonna')).toBe('MA');
    });

    it('should handle single character names', () => {
      expect(getInitials('X')).toBe('X');
    });

    it('should handle names with extra whitespace', () => {
      expect(getInitials('  John   Doe  ')).toBe('JD');
    });

    it('should convert to uppercase', () => {
      expect(getInitials('john doe')).toBe('JD');
    });
  });

  describe('InitialsAvatar component', () => {
    it('should render initials for a full name', () => {
      render(<InitialsAvatar name="Jane Smith" />);
      expect(screen.getByText('JS')).toBeInTheDocument();
    });

    it('should pass src prop to avatar component', () => {
      // The InitialsAvatar component uses Radix Avatar which handles image rendering
      // In tests, we can verify the component renders and falls back to initials
      render(<InitialsAvatar name="Jane Smith" src="https://example.com/avatar.jpg" />);
      // The fallback initials should still be in the document as a fallback
      expect(screen.getByText('JS')).toBeInTheDocument();
    });

    it('should apply correct size classes', () => {
      const { container: containerSm } = render(<InitialsAvatar name="John Doe" size="sm" />);
      expect(containerSm.querySelector('[class*="h-8 w-8"]')).toBeInTheDocument();

      const { container: containerMd } = render(<InitialsAvatar name="John Doe" size="md" />);
      expect(containerMd.querySelector('[class*="h-10 w-10"]')).toBeInTheDocument();

      const { container: containerLg } = render(<InitialsAvatar name="John Doe" size="lg" />);
      expect(containerLg.querySelector('[class*="h-12 w-12"]')).toBeInTheDocument();

      const { container: containerXl } = render(<InitialsAvatar name="John Doe" size="xl" />);
      expect(containerXl.querySelector('[class*="h-16 w-16"]')).toBeInTheDocument();
    });

    it('should apply default medium size when size not specified', () => {
      const { container } = render(<InitialsAvatar name="John Doe" />);
      expect(container.querySelector('[class*="h-10 w-10"]')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <InitialsAvatar name="John Doe" className="custom-class" />
      );
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should generate consistent colors for the same name', () => {
      const { container: container1 } = render(<InitialsAvatar name="Test User" />);
      const fallback1 = container1.querySelector('[class*="bg-"]');
      const classes1 = fallback1?.className;

      const { container: container2 } = render(<InitialsAvatar name="Test User" />);
      const fallback2 = container2.querySelector('[class*="bg-"]');
      const classes2 = fallback2?.className;

      expect(classes1).toBe(classes2);
    });

    it('should generate different colors for different names', () => {
      const { container: container1 } = render(<InitialsAvatar name="Alice" />);
      const fallback1 = container1.querySelector('[class*="bg-"]');
      const classes1 = fallback1?.className;

      const { container: container2 } = render(<InitialsAvatar name="Bob" />);
      const fallback2 = container2.querySelector('[class*="bg-"]');
      const classes2 = fallback2?.className;

      // While not guaranteed, different names should typically generate different colors
      // This is probabilistic, but with 16 colors, most different names will differ
      expect(classes1).not.toBe(classes2);
    });

    it('should use colorSeed to override color generation', () => {
      const { container: container1 } = render(
        <InitialsAvatar name="Test User" colorSeed="seed1" />
      );
      const fallback1 = container1.querySelector('[class*="bg-"]');
      const classes1 = fallback1?.className;

      const { container: container2 } = render(
        <InitialsAvatar name="Different Name" colorSeed="seed1" />
      );
      const fallback2 = container2.querySelector('[class*="bg-"]');
      const classes2 = fallback2?.className;

      // Same colorSeed should produce same color regardless of name
      expect(classes1).toBe(classes2);
    });
  });
});
