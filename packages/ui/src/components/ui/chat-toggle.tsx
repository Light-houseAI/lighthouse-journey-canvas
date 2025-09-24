import { Edit3, MessageCircle } from 'lucide-react';
import React from 'react';

import { Label } from './label';
import { Switch } from './switch';

interface ChatToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  className?: string;
}

/**
 * Toggle component for switching between Chat mode and Manual mode
 * Used in timeline to control node addition behavior
 */
export const ChatToggle: React.FC<ChatToggleProps> = ({
  enabled,
  onToggle,
  className = '',
}) => {
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className="flex items-center space-x-2">
        <Edit3
          className={`h-4 w-4 ${!enabled ? 'text-blue-600' : 'text-gray-400'}`}
          data-testid="edit-icon"
        />
        <Label
          htmlFor="chat-toggle"
          className={`text-sm font-medium ${!enabled ? 'text-blue-600' : 'text-gray-500'}`}
        >
          Manual
        </Label>
      </div>

      <Switch
        id="chat-toggle"
        checked={enabled}
        onCheckedChange={onToggle}
        className="data-[state=checked]:bg-purple-600"
      />

      <div className="flex items-center space-x-2">
        <Label
          htmlFor="chat-toggle"
          className={`text-sm font-medium ${enabled ? 'text-purple-600' : 'text-gray-500'}`}
        >
          Chat
        </Label>
        <MessageCircle
          className={`h-4 w-4 ${enabled ? 'text-purple-600' : 'text-gray-400'}`}
          data-testid="chat-icon"
        />
      </div>
    </div>
  );
};
