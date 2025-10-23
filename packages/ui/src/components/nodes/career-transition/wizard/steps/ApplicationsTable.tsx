import { Button } from '@journey/components';
import { TodoStatus } from '@journey/schema';
import { Edit2, ExternalLink, Plus, Trash2 } from 'lucide-react';
import React from 'react';

import type { ApplicationsTableProps, JobApplication } from './types';
import { ApplicationStatus } from './types';

const statusColors: Record<ApplicationStatus, { bg: string; text: string }> = {
  [ApplicationStatus.Applied]: { bg: 'bg-gray-100', text: 'text-gray-700' },
  [ApplicationStatus.RecruiterScreen]: {
    bg: 'bg-teal-50',
    text: 'text-teal-700',
  },
  [ApplicationStatus.PhoneInterview]: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
  },
  [ApplicationStatus.TechnicalInterview]: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
  },
  [ApplicationStatus.OnsiteInterview]: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
  },
  [ApplicationStatus.FinalInterview]: {
    bg: 'bg-pink-50',
    text: 'text-pink-700',
  },
  [ApplicationStatus.Offer]: { bg: 'bg-green-50', text: 'text-green-700' },
  [ApplicationStatus.OfferAccepted]: {
    bg: 'bg-green-100',
    text: 'text-green-800',
  },
  [ApplicationStatus.OfferDeclined]: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
  },
  [ApplicationStatus.Rejected]: { bg: 'bg-red-50', text: 'text-red-700' },
  [ApplicationStatus.Withdrawn]: { bg: 'bg-gray-50', text: 'text-gray-600' },
  [ApplicationStatus.Ghosted]: { bg: 'bg-gray-50', text: 'text-gray-500' },
};

export const ApplicationsTable: React.FC<ApplicationsTableProps> = ({
  applications,
  onEdit,
  onDelete,
  onAdd,
  isLoading,
}) => {
  const handleDelete = (application: JobApplication) => {
    if (
      window.confirm('Are you sure you want to delete this job application?')
    ) {
      onDelete(application.id);
    }
  };

  const calculateTodoCount = (application: JobApplication) => {
    // Count todos across all statuses from statusData
    let completed = 0;
    let total = 0;

    if (application.statusData) {
      // New structure: extract todos from statusData
      Object.values(application.statusData).forEach((data) => {
        const todos = data.todos || [];
        total += todos.length;
        completed += todos.filter(
          (t) => t.status === TodoStatus.Completed
        ).length;
      });
    }

    return { completed, total };
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">Loading applications...</div>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <div className="text-gray-500">No job applications yet</div>
        <Button onClick={onAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add job application
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm">
      <table className="w-full">
        <thead className="bg-teal-700 text-white">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold">Job</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">
              Status
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold">
              Outreach
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold">
              Posting URL
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Todos</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {applications.map((application) => {
            const todoCount = calculateTodoCount(application);
            const statusConfig =
              statusColors[application.applicationStatus] ||
              statusColors[ApplicationStatus.Applied];

            return (
              <tr key={application.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">
                      {application.company}
                    </span>
                    <span className="text-xs text-gray-500">
                      {application.jobTitle}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}
                    >
                      {application.applicationStatus}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(
                        application.applicationDate
                      ).toLocaleDateString()}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-900">
                    {application.outreachMethod}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {application.jobPostingUrl ? (
                    <a
                      href={application.jobPostingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-600 underline hover:text-blue-800"
                    >
                      <span className="max-w-[200px] truncate">
                        {application.jobPostingUrl}
                      </span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="text-sm text-gray-700"
                    data-testid={`todo-count-${application.id}`}
                  >
                    {todoCount.completed} / {todoCount.total}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(application)}
                      className="rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      aria-label="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(application)}
                      className="rounded p-1.5 text-gray-600 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-gray-200 p-3">
        <Button onClick={onAdd} variant="outline" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Add job application
        </Button>
      </div>
    </div>
  );
};
