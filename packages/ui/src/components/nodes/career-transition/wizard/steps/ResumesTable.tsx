/**
 * Resumes Table Component
 *
 * Displays resume entries in a table format with edit/delete actions
 * Pattern based on ApplicationsTable.tsx
 */

import { Button } from '@journey/components';
import { ResumeEntry } from '@journey/schema';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import React from 'react';

export interface ResumesTableProps {
  resumes: ResumeEntry[];
  onEdit: (resume: ResumeEntry) => void;
  onDelete: (type: string) => void;
  onAdd: () => void;
  isLoading?: boolean;
}

export const ResumesTable: React.FC<ResumesTableProps> = ({
  resumes,
  onEdit,
  onDelete,
  onAdd,
  isLoading = false,
}) => {
  const handleDelete = (resume: ResumeEntry) => {
    if (
      window.confirm(
        `Are you sure you want to delete the "${resume.type}" resume?`
      )
    ) {
      onDelete(resume.type);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">Loading resumes...</div>
      </div>
    );
  }

  if (resumes.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <div className="text-center">
          <p className="text-base font-medium text-gray-900">
            No resumes added yet
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Add your first resume to get started
          </p>
        </div>
        <Button onClick={onAdd} className="gap-2 bg-teal-700 hover:bg-teal-800">
          <Plus className="h-4 w-4" />
          Add Resume
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm">
      <table className="w-full">
        <thead className="bg-teal-700 text-white">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold">
              Resume Type
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold">URL</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">
              Last Updated
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {resumes.map((resume) => (
            <tr key={resume.type} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <span className="text-sm font-medium text-gray-900">
                  {resume.type}
                </span>
              </td>
              <td className="px-4 py-3">
                <a
                  href={resume.resumeVersion.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-600 underline hover:text-blue-800"
                >
                  <span className="max-w-[300px] truncate">
                    {resume.resumeVersion.url}
                  </span>
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-gray-700">
                  {formatDate(resume.resumeVersion.lastUpdated)}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <Button
                    onClick={() => onEdit(resume)}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    Update
                  </Button>
                  <button
                    onClick={() => handleDelete(resume)}
                    className="rounded p-1.5 text-gray-600 hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete resume"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-gray-200 p-3">
        <Button onClick={onAdd} variant="outline" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Add Resume
        </Button>
      </div>
    </div>
  );
};
