import React, { createContext, useContext, ReactNode } from 'react';

// Theme configuration for light theme - Based on Figma design
const lightTheme = {
  // Background colors - Clean and professional (Figma: background/base #F5F5F5)
  backgroundGradient: 'bg-[#F5F5F5]',
  cardBackground: 'bg-white',
  glassBackground: 'bg-white/90',
  inputBackground: 'bg-white',
  modalBackground: 'bg-white',
  panelBackground: 'bg-white',
  
  // Text colors - Based on Figma design tokens
  primaryText: 'text-[#2E2E2E]', // text/primary
  secondaryText: 'text-[#4A4F4E]', // text/secondary  
  mutedText: 'text-[#454C52]', // Grey/700
  placeholderText: 'text-gray-400',
  
  // Border colors - Subtle and clean
  primaryBorder: 'border-gray-200',
  accentBorder: 'border-gray-300',
  focusBorder: 'border-green-400',
  
  // Shadow colors - Figma design system shadows
  cardShadow: 'shadow-[0px_2px_5px_0px_rgba(103,110,118,0.08),0px_0px_0px_1px_rgba(103,110,118,0.16),0px_1px_1px_0px_rgba(0,0,0,0.12)]',
  glowShadow: 'shadow-lg shadow-gray-200/50',
  
  // Interactive states - Clean and minimal
  hover: 'hover:bg-gray-50',
  hoverCard: 'hover:bg-gray-50/50',
  focus: 'focus:ring-green-400/20',
  
  // Component-specific colors
  nodeColors: {
    education: 'from-blue-100 to-blue-200',
    work: 'from-green-100 to-green-200',
    project: 'from-purple-100 to-purple-200',
    transition: 'from-orange-100 to-orange-200',
    event: 'from-red-100 to-red-200',
    action: 'from-pink-100 to-pink-200'
  }
} as const;

interface ThemeContextType {
  theme: typeof lightTheme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <ThemeContext.Provider value={{ theme: lightTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Utility function to get theme classes as a string
export function getThemeClasses(themeKey: keyof typeof lightTheme): string {
  return lightTheme[themeKey] as string;
}