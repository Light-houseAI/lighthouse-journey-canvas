import type { Todo } from '@journey/components';
import { ApplicationStatus, EventType, OutreachMethod } from '@journey/schema';

// Re-export for convenience
export { ApplicationStatus, EventType, OutreachMethod };

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

  // Interview details
  interviewContext?: string;

  // Todos per status (allows different todos for each application status)
  todosByStatus?: Record<ApplicationStatus, Todo[]>;

  // LLM-generated summaries per status
  summariesByStatus?: Record<ApplicationStatus, string>;

  // Legacy: Single todos array (for backward compatibility)
  todos?: Todo[];

  // Notes
  notes?: string;
}

export interface JobApplicationFormData {
  company: string;
  companyId?: number; // Organization ID for normalized company data
  jobTitle: string;
  applicationDate: string;
  jobPostingUrl?: string;
  applicationStatus: ApplicationStatus;
  outreachMethod: OutreachMethod;
  interviewContext?: string;
  todosByStatus?: Record<ApplicationStatus, Todo[]>;
  summariesByStatus?: Record<ApplicationStatus, string>;
  todos?: Todo[]; // Legacy field for backward compatibility
  notes?: string;
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
