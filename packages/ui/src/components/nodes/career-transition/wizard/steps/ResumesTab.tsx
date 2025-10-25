/**
 * Resumes Tab Component
 *
 * Container for resume table and modal
 * Handles add/edit/delete resume operations
 */

import { ResumeEntry } from '@journey/schema';
import React, { useState } from 'react';

import {
  useApplicationMaterials,
  useUpdateApplicationMaterials,
} from '../../../../../hooks/use-application-materials';
import {
  handleAPIError,
  showSuccessToast,
} from '../../../../../utils/error-toast';
import { ResumeModal } from './ResumeModal';
import { ResumesTable } from './ResumesTable';

export interface ResumesTabProps {
  careerTransitionId: string;
  resumeItems: ResumeEntry[];
}

export const ResumesTab: React.FC<ResumesTabProps> = ({
  careerTransitionId,
  resumeItems,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResume, setEditingResume] = useState<ResumeEntry | null>(null);

  const { data: materials } = useApplicationMaterials(careerTransitionId);
  const updateMaterialsMutation =
    useUpdateApplicationMaterials(careerTransitionId);

  const handleAdd = () => {
    setEditingResume(null);
    setIsModalOpen(true);
  };

  const handleEdit = (resume: ResumeEntry) => {
    setEditingResume(resume);
    setIsModalOpen(true);
  };

  const handleDelete = async (type: string) => {
    try {
      // Keep all non-deleted items (including LinkedIn if it exists)
      const updatedItems =
        materials?.items?.filter((r: ResumeEntry) => r.type !== type) || [];

      await updateMaterialsMutation.mutateAsync({ items: updatedItems });

      showSuccessToast('Resume deleted successfully');
    } catch (error) {
      handleAPIError(error, 'Failed to delete resume');
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingResume(null);
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    setEditingResume(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Resumes</h3>
        <p className="mt-1 text-sm text-gray-600">
          Keep your resumes updated to track your progress and maintain a
          complete record of your job search journey.
        </p>
      </div>

      {/* Resumes Table */}
      <ResumesTable
        resumes={resumeItems}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Resume Modal */}
      {isModalOpen && (
        <ResumeModal
          careerTransitionId={careerTransitionId}
          resume={editingResume || undefined}
          resumeItems={resumeItems}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
};
