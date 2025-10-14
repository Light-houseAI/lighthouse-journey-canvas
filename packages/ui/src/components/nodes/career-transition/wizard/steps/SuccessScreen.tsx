import { Button } from '@journey/components';
import { BookOpen, ListChecks } from 'lucide-react';
import React from 'react';
import { useLocation } from 'wouter';

interface SuccessScreenProps {
  nodeId: string;
  onClose: () => void;
  chaptersUpdated?: string[];
  tasksAdded?: string[];
}

export const SuccessScreen: React.FC<SuccessScreenProps> = ({
  nodeId,
  onClose,
  chaptersUpdated = [],
  tasksAdded = [],
}) => {
  const [, setLocation] = useLocation();

  const handleViewJourney = () => {
    onClose();
    setLocation(`/career-transition/${nodeId}`);
  };

  const handleFindMatches = () => {
    onClose();
    // TODO: Navigate to network matches page
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="success-screen-overlay"
    >
      <div className="w-full max-w-xl rounded-lg bg-white p-8 shadow-xl">
        {/* Success Icon */}
        <div className="mb-6 flex justify-center" data-testid="success-icon">
          <div className="text-6xl">🎉</div>
        </div>

        {/* Success Message */}
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          Successfully added update!
        </h1>
        <p className="mb-8 text-center text-sm text-gray-600">
          Every little bit of progress counts on your journey to reaching your
          goals.
        </p>

        {/* Journey Chapters Updated */}
        {chaptersUpdated.length > 0 && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
              <BookOpen className="h-4 w-4" />
              Journey chapters updated
            </div>
            <ul className="ml-6 list-disc space-y-1 text-sm text-gray-700">
              {chaptersUpdated.map((chapter, idx) => (
                <li key={idx}>{chapter}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Tasks Added */}
        {tasksAdded.length > 0 && (
          <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
              <ListChecks className="h-4 w-4" />
              Tasks added to your journey
            </div>
            <ul className="ml-6 list-disc space-y-1 text-sm text-gray-700">
              {tasksAdded.map((task, idx) => (
                <li key={idx}>{task}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleFindMatches}
            variant="outline"
            className="flex-1"
          >
            Find network matches
          </Button>
          <Button
            onClick={handleViewJourney}
            className="flex-1 bg-teal-700 hover:bg-teal-800"
          >
            View my journey
          </Button>
        </div>
      </div>
    </div>
  );
};
