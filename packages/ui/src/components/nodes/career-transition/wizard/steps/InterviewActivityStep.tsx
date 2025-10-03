import {
  InterviewStage,
  InterviewStatus,
  TimelineNodeType,
} from '@journey/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ColumnDef,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowLeft, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';

import { hierarchyApi } from '../../../../../services/hierarchy-api';
import {
  handleAPIError,
  showSuccessToast,
} from '../../../../../utils/error-toast';
import { Input } from '@journey/components';
import { Label } from '@journey/components';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@journey/components';
import type { WizardData } from '../CareerUpdateWizard';

interface InterviewEntry {
  id: string;
  company: string;
  position: string;
  stage: string;
  date: string;
  status?: string;
  notes?: string;
}

interface InterviewActivityStepProps {
  data?: WizardData;
  onNext: (data: Partial<WizardData>) => void;
  onBack?: () => void;
  onCancel: () => void;
  currentStep: number;
  totalSteps: number;
  nodeId: string; // Parent career transition node ID
}

const columnHelper = createColumnHelper<InterviewEntry>();

export const InterviewActivityStep: React.FC<InterviewActivityStepProps> = ({
  onNext,
  onBack,
  onCancel,
  currentStep,
  totalSteps,
  nodeId,
}) => {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<InterviewEntry, 'id'>>({
    company: '',
    position: '',
    stage: '',
    date: '',
    status: '',
    notes: '',
  });

  // Fetch interview event nodes (children of the career transition node)
  const { data: allNodes = [], isLoading } = useQuery({
    queryKey: ['nodes', 'interviews', nodeId],
    queryFn: () => hierarchyApi.listNodes(),
    staleTime: 30000, // Cache for 30 seconds to prevent excessive refetching
  });

  // Filter to get only interview event nodes that are children of this career transition
  const interviews: InterviewEntry[] = React.useMemo(
    () =>
      allNodes
        .filter(
          (node) =>
            node.type === TimelineNodeType.Event &&
            node.parentId === nodeId &&
            node.meta?.eventType === 'interview'
        )
        .map((node) => ({
          id: node.id,
          company: node.meta?.company || '',
          position: node.meta?.role || '',
          stage: node.meta?.stage || '',
          date: node.meta?.startDate || '',
          status: node.meta?.status || '',
          notes: node.meta?.notes || '',
        })),
    [allNodes, nodeId]
  );

  // Create interview mutation
  const createInterviewMutation = useMutation({
    mutationFn: (interviewData: Omit<InterviewEntry, 'id'>) => {
      // Convert YYYY-MM-DD to YYYY-MM format
      const formattedDate = interviewData.date
        ? interviewData.date.substring(0, 7)
        : '';

      return hierarchyApi.createNode({
        type: TimelineNodeType.Event,
        parentId: nodeId,
        meta: {
          title: `Interview at ${interviewData.company}`,
          description: `${interviewData.position} - ${interviewData.stage}`,
          startDate: formattedDate,
          eventType: 'interview',
          company: interviewData.company,
          role: interviewData.position,
          stage: interviewData.stage,
          status: interviewData.status,
          notes: interviewData.notes,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      handleCloseModal();
      showSuccessToast('Interview added successfully');
    },
    onError: (error) => {
      handleAPIError(error, 'Add interview');
    },
  });

  // Update interview mutation
  const updateInterviewMutation = useMutation({
    mutationFn: ({
      id,
      data: interviewData,
    }: {
      id: string;
      data: Omit<InterviewEntry, 'id'>;
    }) => {
      // Convert YYYY-MM-DD to YYYY-MM format
      const formattedDate = interviewData.date
        ? interviewData.date.substring(0, 7)
        : '';

      return hierarchyApi.updateNode(id, {
        meta: {
          title: `Interview at ${interviewData.company}`,
          description: `${interviewData.position} - ${interviewData.stage}`,
          startDate: formattedDate,
          eventType: 'interview',
          company: interviewData.company,
          role: interviewData.position,
          stage: interviewData.stage,
          status: interviewData.status,
          notes: interviewData.notes,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      handleCloseModal();
      showSuccessToast('Interview updated successfully');
    },
    onError: (error) => {
      handleAPIError(error, 'Update interview');
    },
  });

  // Delete interview mutation
  const deleteInterviewMutation = useMutation({
    mutationFn: (id: string) => hierarchyApi.deleteNode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      setDeletingId(null);
      showSuccessToast('Interview deleted successfully');
    },
    onError: (error) => {
      setDeletingId(null);
      handleAPIError(error, 'Delete interview');
    },
  });

  const handleOpenAddModal = () => {
    setFormData({
      company: '',
      position: '',
      stage: '',
      date: '',
      status: '',
      notes: '',
    });
    setEditingId(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (interview: InterviewEntry) => {
    setFormData({
      company: interview.company,
      position: interview.position,
      stage: interview.stage,
      date: interview.date,
      status: interview.status || '',
      notes: interview.notes || '',
    });
    setEditingId(interview.id);
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingId(null);
  };

  const handleSaveInterview = () => {
    if (
      !formData.company ||
      !formData.position ||
      !formData.stage ||
      !formData.date
    ) {
      return;
    }

    if (editingId) {
      // Update existing interview - modal will close on success
      updateInterviewMutation.mutate({
        id: editingId,
        data: formData,
      });
    } else {
      // Add new interview - modal will close on success
      createInterviewMutation.mutate(formData);
    }
  };

  const handleDeleteInterview = (id: string) => {
    setDeletingId(id);
    deleteInterviewMutation.mutate(id);
  };

  const columns: ColumnDef<InterviewEntry, any>[] = [
    columnHelper.accessor('company', {
      header: 'Company',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('position', {
      header: 'Position',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('stage', {
      header: 'Stage',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('date', {
      header: 'Date',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => info.getValue() || '-',
    }),
    columnHelper.accessor('notes', {
      header: 'Notes',
      cell: (info) => {
        const notes = info.getValue();
        return notes ? (
          <div className="max-w-xs truncate" title={notes}>
            {notes}
          </div>
        ) : (
          '-'
        );
      },
    }),
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleOpenEditModal(row.original)}
            className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Edit interview"
          >
            <Pencil className="h-4 w-4" />
          </button>
          {deletingId === row.original.id ? (
            <div className="flex items-center justify-center rounded p-1">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-red-600 border-r-transparent"></div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleDeleteInterview(row.original.id)}
              className="rounded p-1 text-gray-600 hover:bg-red-100 hover:text-red-600"
              aria-label="Delete interview"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: interviews,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleNext = () => {
    onNext({
      interviewActivityData: {
        interviews,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[90vh] w-[90vw] max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Left Panel - Stepper */}
        <div className="w-1/3 bg-gray-50 p-8">
          <div className="text-sm font-medium text-gray-900">
            Step {currentStep + 1} of {totalSteps}: Interview Activity
          </div>
        </div>

        {/* Right Panel - Content */}
        <div className="flex flex-1 flex-col">
          {/* Header */}
          <div className="relative border-b border-gray-200 px-8 py-4">
            <button
              onClick={onCancel}
              className="absolute left-4 top-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              type="button"
            >
              <X className="h-4 w-4" />
              <span>Cancel update</span>
            </button>
            <h2 className="text-center text-lg font-semibold text-gray-900">
              Add update
            </h2>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="mb-2 text-3xl font-bold text-gray-900">
                  Interview Activity
                </h1>
                <p className="text-gray-600">Track your interview progress</p>
              </div>
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <Plus className="h-4 w-4" />
                Add Interview
              </button>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex h-48 items-center justify-center rounded-lg border border-gray-200">
                <div className="text-center">
                  <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-violet-600 border-r-transparent"></div>
                  <p className="text-sm text-gray-600">Loading interviews...</p>
                </div>
              </div>
            ) : interviews.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="whitespace-nowrap px-6 py-4 text-sm text-gray-900"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
                <p className="text-gray-500">No interviews added yet</p>
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="mt-4 inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Add your first interview
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-8 py-4">
            <div className="flex justify-between">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                className="ml-auto flex items-center gap-2 rounded-lg bg-teal-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
              >
                <Check className="h-4 w-4" />
                {currentStep === totalSteps - 1 ? 'Finish' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Interview Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          onClick={(e) => {
            // Only close if clicking the backdrop, not the modal content
            if (e.target === e.currentTarget) {
              handleCloseModal();
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Interview' : 'Add Interview'}
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="company"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Company *
                </Label>
                <Input
                  id="company"
                  type="text"
                  value={formData.company}
                  onChange={(e) =>
                    setFormData({ ...formData, company: e.target.value })
                  }
                  placeholder="e.g., Google"
                  className="w-full"
                />
              </div>

              <div>
                <Label
                  htmlFor="position"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Position *
                </Label>
                <Input
                  id="position"
                  type="text"
                  value={formData.position}
                  onChange={(e) =>
                    setFormData({ ...formData, position: e.target.value })
                  }
                  placeholder="e.g., Software Engineer"
                  className="w-full"
                />
              </div>

              <div>
                <Label
                  htmlFor="stage"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Stage *
                </Label>
                <Select
                  value={formData.stage}
                  onValueChange={(value) =>
                    setFormData({ ...formData, stage: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    <SelectItem value={InterviewStage.Applied}>
                      Applied
                    </SelectItem>
                    <SelectItem value={InterviewStage.Screening}>
                      Screening
                    </SelectItem>
                    <SelectItem value={InterviewStage.PhoneScreen}>
                      Phone Screen
                    </SelectItem>
                    <SelectItem value={InterviewStage.TechnicalRound}>
                      Technical Round
                    </SelectItem>
                    <SelectItem value={InterviewStage.Onsite}>
                      Onsite
                    </SelectItem>
                    <SelectItem value={InterviewStage.FinalRound}>
                      Final Round
                    </SelectItem>
                    <SelectItem value={InterviewStage.OfferReceived}>
                      Offer Received
                    </SelectItem>
                    <SelectItem value={InterviewStage.Rejected}>
                      Rejected
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label
                  htmlFor="date"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Date *
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  className="w-full"
                />
              </div>

              <div>
                <Label
                  htmlFor="status"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Status
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    <SelectItem value={InterviewStatus.Scheduled}>
                      Scheduled
                    </SelectItem>
                    <SelectItem value={InterviewStatus.Completed}>
                      Completed
                    </SelectItem>
                    <SelectItem value={InterviewStatus.Passed}>
                      Passed
                    </SelectItem>
                    <SelectItem value={InterviewStatus.Failed}>
                      Failed
                    </SelectItem>
                    <SelectItem value={InterviewStatus.Pending}>
                      Pending
                    </SelectItem>
                    <SelectItem value={InterviewStatus.Cancelled}>
                      Cancelled
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label
                  htmlFor="notes"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Notes
                </Label>
                <Input
                  id="notes"
                  type="text"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Additional notes about the interview"
                  className="w-full"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={
                  createInterviewMutation.isPending ||
                  updateInterviewMutation.isPending
                }
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveInterview}
                disabled={
                  !formData.company ||
                  !formData.position ||
                  !formData.stage ||
                  !formData.date ||
                  createInterviewMutation.isPending ||
                  updateInterviewMutation.isPending
                }
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {(createInterviewMutation.isPending ||
                  updateInterviewMutation.isPending) && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                )}
                {editingId ? 'Save Changes' : 'Add Interview'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
