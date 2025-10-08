import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import React from 'react';

import { VStack } from '@journey/components';
import { getUpdatesByNodeId } from '../../../services/updates-api';

interface CareerUpdatesListProps {
  nodeId: string;
}

export const CareerUpdatesList: React.FC<CareerUpdatesListProps> = ({
  nodeId,
}) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['updates', nodeId],
    queryFn: () => getUpdatesByNodeId(nodeId, { page: 1, limit: 100 }),
  });

  if (isLoading) {
    return <div>Loading updates...</div>;
  }

  if (error) {
    return <div>Error loading updates</div>;
  }

  const updates = data?.updates || [];

  // Sort by createdAt descending (newest first)
  const sortedUpdates = [...updates].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (sortedUpdates.length === 0) {
    return <div>No updates yet</div>;
  }

  return (
    <VStack spacing={4}>
      {sortedUpdates.map((update) => {
        const jobSearchActivities = [];
        if (update.meta.appliedToJobs)
          jobSearchActivities.push('Applied to jobs');
        if (update.meta.updatedResumeOrPortfolio)
          jobSearchActivities.push('Updated resume or portfolio');
        if (update.meta.networked) jobSearchActivities.push('Networked');
        if (update.meta.developedSkills)
          jobSearchActivities.push('Developed skills');

        const interviewActivities = [];
        if (update.meta?.pendingInterviews)
          interviewActivities.push('Pending interviews');
        if (update.meta?.completedInterviews)
          interviewActivities.push('Completed interviews');
        if (update.meta?.practicedMock)
          interviewActivities.push('Practiced mock');
        if (update.meta?.receivedOffers)
          interviewActivities.push('Received offers');
        if (update.meta?.receivedRejections)
          interviewActivities.push('Received rejections');
        if (update.meta?.possiblyGhosted)
          interviewActivities.push('Possibly ghosted');

        const hasJobSearchActivities = jobSearchActivities.length > 0;
        const hasInterviewActivities = interviewActivities.length > 0;
        const hasNotes = update.notes && update.notes.trim().length > 0;

        const truncatedNotes =
          update.notes && update.notes.length > 200
            ? `${update.notes.substring(0, 200)}...`
            : update.notes;

        return (
          <div
            key={update.id}
            data-testid={`update-card-${update.id}`}
            className="rounded-lg border border-violet-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3">
              <div className="text-sm text-gray-500">
                {formatDistanceToNow(new Date(update.createdAt), {
                  addSuffix: true,
                })}
              </div>
            </div>

            {hasJobSearchActivities && (
              <div className="mb-3">
                <div className="mb-1 text-sm font-semibold text-violet-800">
                  Job Search Prep
                </div>
                <ul className="list-disc pl-5 text-sm text-gray-700">
                  {jobSearchActivities.map((activity) => (
                    <li key={activity}>{activity}</li>
                  ))}
                </ul>
              </div>
            )}

            {hasInterviewActivities && (
              <div className="mb-3">
                <div className="mb-1 text-sm font-semibold text-violet-800">
                  Interview Activity
                </div>
                <ul className="list-disc pl-5 text-sm text-gray-700">
                  {interviewActivities.map((activity) => (
                    <li key={activity}>{activity}</li>
                  ))}
                </ul>
              </div>
            )}

            {hasNotes && (
              <div>
                <div className="mb-1 text-sm font-semibold text-violet-800">
                  Notes
                </div>
                <p className="text-sm text-gray-700">{truncatedNotes}</p>
              </div>
            )}
          </div>
        );
      })}
    </VStack>
  );
};
