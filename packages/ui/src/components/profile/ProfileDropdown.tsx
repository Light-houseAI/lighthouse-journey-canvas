import { ChevronDown } from 'lucide-react';
import React, { useEffect, useRef,useState } from 'react';

export interface User {
  name: string;
  avatar: string;
  email?: string;
}

export interface ProfileDropdownProps {
  user: User;
  isOpen?: boolean;
  onToggle?: () => void;
  onLogout?: () => void;
  onSettings?: () => void;
  onProfile?: () => void;
}

export function ProfileDropdown({
  user,
  isOpen = false,
  onToggle,
  onLogout,
  onSettings,
  onProfile,
}: ProfileDropdownProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(isOpen);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Helper function to get user initials
  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  // Use controlled or uncontrolled state
  const dropdownOpen = onToggle ? isOpen : internalIsOpen;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalIsOpen(!internalIsOpen);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (onToggle) {
          // For controlled mode, parent should handle closing
        } else {
          setInternalIsOpen(false);
        }
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen, onToggle]);

  const handleMenuItemClick = (action: 'profile' | 'settings' | 'logout') => {
    // Close dropdown first
    if (onToggle) {
      // For controlled mode, parent should handle closing
    } else {
      setInternalIsOpen(false);
    }

    // Execute the action
    switch (action) {
      case 'profile':
        if (onProfile) onProfile();
        break;
      case 'settings':
        if (onSettings) onSettings();
        break;
      case 'logout':
        if (onLogout) onLogout();
        break;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Trigger Button */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-[12px] hover:bg-white/10 rounded-[8px] px-[12px] py-[8px] transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
        data-testid="profile-dropdown-trigger"
        tabIndex={0}
        role="button"
        aria-label="Open profile menu"
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
      >
        <div
          className="size-[36px] rounded-full bg-cover bg-center flex items-center justify-center"
          style={user.avatar ? { backgroundImage: `url(${user.avatar})` } : {}}
          data-testid="user-avatar"
        >
          {!user.avatar && (
            <div className="size-full rounded-full bg-gray-200 flex items-center justify-center text-[14px] font-medium text-gray-600">
              {getUserInitials(user.name)}
            </div>
          )}
        </div>
        <span className="font-medium text-[16px] text-[#4a4f4e]" data-testid="user-name">
          {user.name}
        </span>
        <ChevronDown
          className={`size-[16px] transition-transform duration-200 opacity-70 hover:opacity-100 ${
            dropdownOpen ? 'rotate-180' : ''
          }`}
          data-testid="profile-dropdown-arrow"
        />
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div
          className="absolute top-[60px] right-0 bg-white rounded-[8px] shadow-[0px_4px_12px_0px_rgba(13,10,44,0.16)] min-w-[200px] py-[8px] z-50"
          data-testid="profile-dropdown-menu"
          role="menu"
          aria-label="Profile menu"
        >
          <button
            onClick={() => handleMenuItemClick('profile')}
            className="w-full px-[16px] py-[12px] text-left hover:bg-[#f5f5f5] font-medium text-[14px] text-[#2e2e2e] transition-colors"
            data-testid="profile-menu-item"
            role="menuitem"
          >
            View Profile
          </button>
          <button
            onClick={() => handleMenuItemClick('settings')}
            className="w-full px-[16px] py-[12px] text-left hover:bg-[#f5f5f5] font-medium text-[14px] text-[#2e2e2e] transition-colors"
            data-testid="settings-menu-item"
            role="menuitem"
          >
            Settings
          </button>
          <button
            onClick={() => handleMenuItemClick('logout')}
            className="w-full px-[16px] py-[12px] text-left hover:bg-[#f5f5f5] font-medium text-[14px] text-[#d56b85] transition-colors"
            data-testid="logout-menu-item"
            role="menuitem"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}