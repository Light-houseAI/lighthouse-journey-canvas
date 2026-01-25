import { Button } from '@journey/components';
import { Home, Search, Settings, Sparkles } from 'lucide-react';
import React from 'react';
import { useLocation } from 'wouter';

import logoImage from '../../assets/images/logo.png';
import { useAnalytics, AnalyticsEvents } from '../../hooks/useAnalytics';
import { CompanyDocsUploadButton } from '../insight-assistant/CompanyDocsUploadButton';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  isActive?: boolean;
}

export function CompactSidebar() {
  const [location, setLocation] = useLocation();
  const { track } = useAnalytics();

  const handleLogoClick = () => {
    track(AnalyticsEvents.BUTTON_CLICKED, { button_name: 'logo', button_location: 'sidebar' });
    setLocation('/');
  };

  const handleNavClick = (item: NavItem) => {
    track(AnalyticsEvents.BUTTON_CLICKED, { button_name: item.label, button_location: 'sidebar' });
    setLocation(item.path);
  };

  const navItems: NavItem[] = [
    {
      icon: <Home className="h-5 w-5" />,
      label: 'Home',
      path: '/',
      isActive: location === '/',
    },
    {
      icon: <Search className="h-5 w-5" />,
      label: 'Search',
      path: '/search',
      isActive: location === '/search',
    },
    {
      icon: <Settings className="h-5 w-5" />,
      label: 'Settings',
      path: '/settings',
      isActive: location === '/settings',
    },
    {
      icon: <Sparkles className="h-5 w-5" />,
      label: 'Insight Assistant',
      path: '/insight-assistant',
      isActive: location === '/insight-assistant',
    },
  ];

  return (
    <div
      className="flex h-full w-[72px] flex-col items-center border-r bg-white py-4"
      style={{
        borderColor: '#EAECF0',
      }}
    >
      {/* Logo at top */}
      <Button
        onClick={handleLogoClick}
        variant="ghost"
        className="mb-6 flex h-10 w-10 items-center justify-center p-0 hover:bg-gray-100"
        aria-label="Go to home page"
      >
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
          <img
            src={logoImage}
            alt="Lighthouse"
            className="h-full w-full object-contain"
          />
        </div>
      </Button>

      {/* Navigation icons */}
      <nav className="flex flex-1 flex-col items-center gap-2">
        {navItems.map((item) => (
          <Button
            key={item.path}
            onClick={() => handleNavClick(item)}
            variant="ghost"
            className={`flex h-10 w-10 items-center justify-center rounded-lg p-0 transition-colors ${
              item.isActive
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
            aria-label={item.label}
            title={item.label}
          >
            {item.icon}
          </Button>
        ))}
      </nav>

      {/* Company docs upload button */}
      <div className="mb-4">
        <CompanyDocsUploadButton />
      </div>

      {/* Bottom spacer */}
      <div className="mt-auto" />
    </div>
  );
}
