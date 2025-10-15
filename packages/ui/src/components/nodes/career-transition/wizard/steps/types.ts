import type { Todo } from '@journey/components';
import { ApplicationStatus, EventType, OutreachMethod } from '@journey/schema';

// Re-export for convenience
export { ApplicationStatus, EventType, OutreachMethod };

// Status-specific data grouped together
export interface StatusData {
  todos?: Todo[];
  interviewContext?: string; // User-entered interview details for this status
  llmSummary?: string; // LLM-generated summary for this status
}

export interface JobApplication {
  id: string;

  // Core fields
  company: string;
  companyId?: number; // Organization ID for normalized company data
  jobTitle: string;
  applicationDate: string; // YYYY-MM-DD

  // Additional info
  jobPostingUrl?: string;
  applicationStatus: ApplicationStatus;
  outreachMethod: OutreachMethod;

  // Notes
  notes?: string;

  // LLM-generated overall summary
  llmInterviewContext?: string;

  // Grouped status data - replaces todosByStatus, interviewContextByStatus, llmSummariesByStatus
  statusData?: Record<ApplicationStatus, StatusData>;
}

export interface JobApplicationFormData {
  company: string;
  companyId?: number; // Organization ID for normalized company data
  jobTitle: string;
  applicationDate: string;
  jobPostingUrl?: string;
  applicationStatus: ApplicationStatus;
  outreachMethod: OutreachMethod;
  notes?: string;
  llmInterviewContext?: string;
  statusData?: Record<ApplicationStatus, StatusData>;
}

export interface JobApplicationTableRow {
  id: string;
  job: string; // "Company - Title"
  status: ApplicationStatus;
  outreach: OutreachMethod;
  postingUrl?: string;
  applicationDate: string;
  todoCount: {
    pending: number;
    inProgress: number;
    completed: number;
    blocked: number;
  };
}

export interface ApplicationModalProps {
  application?: JobApplication; // If editing
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: JobApplicationFormData) => Promise<void>;
}

export interface ApplicationsTableProps {
  applications: JobApplication[];
  onEdit: (application: JobApplication) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  isLoading?: boolean;
}
