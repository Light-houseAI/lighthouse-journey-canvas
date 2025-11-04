import type { ResumeEntry } from '@journey/schema';
import { LINKEDIN_TYPE } from '@journey/schema';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MaterialsSummaryCard } from './MaterialsSummaryCard';

describe('MaterialsSummaryCard', () => {
  const mockResumeEntry: ResumeEntry = {
    id: '1',
    type: 'General',
    resumeVersion: {
      url: 'https://example.com/resume.pdf',
      lastUpdated: '2024-01-15T12:00:00Z',
      editHistorySummary:
        '- Updated work experience\n- Added new skills\n- Fixed typos',
    },
    careerTransitionId: 'ct-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T12:00:00Z',
  };

  const mockLinkedInEntry: ResumeEntry = {
    id: '2',
    type: LINKEDIN_TYPE,
    resumeVersion: {
      url: 'https://linkedin.com/in/johndoe',
      lastUpdated: '2024-02-20T10:00:00Z',
      editHistorySummary: '- Updated headline\n- Added certifications',
    },
    careerTransitionId: 'ct-1',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-20T10:00:00Z',
  };

  describe('Resume Display', () => {
    it('should render resume type and title', () => {
      render(<MaterialsSummaryCard resumeEntry={mockResumeEntry} />);

      expect(screen.getByText(/general resume/i)).toBeInTheDocument();
    });

    it('should display last updated date', () => {
      render(<MaterialsSummaryCard resumeEntry={mockResumeEntry} />);

      expect(
        screen.getByText(/last updated january 2024/i)
      ).toBeInTheDocument();
    });

    it('should render resume URL link', () => {
      render(<MaterialsSummaryCard resumeEntry={mockResumeEntry} />);

      const link = screen.getByRole('link', { name: /view resume/i });
      expect(link).toHaveAttribute('href', 'https://example.com/resume.pdf');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should display edit history summary as bullet points', () => {
      render(<MaterialsSummaryCard resumeEntry={mockResumeEntry} />);

      expect(screen.getByText(/updated work experience/i)).toBeInTheDocument();
      expect(screen.getByText(/added new skills/i)).toBeInTheDocument();
      expect(screen.getByText(/fixed typos/i)).toBeInTheDocument();
    });

    it('should display "Steps" header', () => {
      render(<MaterialsSummaryCard resumeEntry={mockResumeEntry} />);

      expect(screen.getByText(/^steps$/i)).toBeInTheDocument();
    });
  });

  describe('LinkedIn Display', () => {
    it('should render LinkedIn Profile title', () => {
      render(<MaterialsSummaryCard resumeEntry={mockLinkedInEntry} />);

      expect(
        screen.getByRole('heading', { name: /linkedin profile/i })
      ).toBeInTheDocument();
    });

    it('should display LinkedIn URL link', () => {
      render(<MaterialsSummaryCard resumeEntry={mockLinkedInEntry} />);

      const link = screen.getByRole('link', { name: /view linkedin profile/i });
      expect(link).toHaveAttribute('href', 'https://linkedin.com/in/johndoe');
    });

    it('should display last updated date for LinkedIn', () => {
      render(<MaterialsSummaryCard resumeEntry={mockLinkedInEntry} />);

      expect(
        screen.getByText(/last updated february 2024/i)
      ).toBeInTheDocument();
    });

    it('should display LinkedIn edit history', () => {
      render(<MaterialsSummaryCard resumeEntry={mockLinkedInEntry} />);

      expect(screen.getByText(/updated headline/i)).toBeInTheDocument();
      expect(screen.getByText(/added certifications/i)).toBeInTheDocument();
    });
  });

  describe('Edit History Parsing', () => {
    it('should handle edit history with bullet points', () => {
      const entryWithBullets: ResumeEntry = {
        ...mockResumeEntry,
        resumeVersion: {
          ...mockResumeEntry.resumeVersion!,
          editHistorySummary: '• First item\n• Second item\n• Third item',
        },
      };

      render(<MaterialsSummaryCard resumeEntry={entryWithBullets} />);

      expect(screen.getByText(/first item/i)).toBeInTheDocument();
      expect(screen.getByText(/second item/i)).toBeInTheDocument();
      expect(screen.getByText(/third item/i)).toBeInTheDocument();
    });

    it('should handle edit history with asterisks', () => {
      const entryWithAsterisks: ResumeEntry = {
        ...mockResumeEntry,
        resumeVersion: {
          ...mockResumeEntry.resumeVersion!,
          editHistorySummary: '* Updated section A\n* Updated section B',
        },
      };

      render(<MaterialsSummaryCard resumeEntry={entryWithAsterisks} />);

      expect(screen.getByText(/updated section a/i)).toBeInTheDocument();
      expect(screen.getByText(/updated section b/i)).toBeInTheDocument();
    });

    it('should handle empty edit history summary', () => {
      const entryWithoutSummary: ResumeEntry = {
        ...mockResumeEntry,
        resumeVersion: {
          ...mockResumeEntry.resumeVersion!,
          editHistorySummary: '',
        },
      };

      render(<MaterialsSummaryCard resumeEntry={entryWithoutSummary} />);

      expect(
        screen.getByText(/summary will be generated automatically/i)
      ).toBeInTheDocument();
    });

    it('should handle missing edit history summary', () => {
      const entryWithoutSummary: ResumeEntry = {
        ...mockResumeEntry,
        resumeVersion: {
          ...mockResumeEntry.resumeVersion!,
          editHistorySummary: undefined,
        },
      };

      render(<MaterialsSummaryCard resumeEntry={entryWithoutSummary} />);

      expect(
        screen.getByText(/summary will be generated automatically/i)
      ).toBeInTheDocument();
    });

    it('should filter out empty lines in summary', () => {
      const entryWithEmptyLines: ResumeEntry = {
        ...mockResumeEntry,
        resumeVersion: {
          ...mockResumeEntry.resumeVersion!,
          editHistorySummary: '- Item 1\n\n\n- Item 2\n',
        },
      };

      const { container } = render(
        <MaterialsSummaryCard resumeEntry={entryWithEmptyLines} />
      );

      const listItems = container.querySelectorAll('li');
      expect(listItems).toHaveLength(2);
    });
  });

  describe('Date Formatting', () => {
    it('should format valid dates correctly', () => {
      render(<MaterialsSummaryCard resumeEntry={mockResumeEntry} />);

      expect(screen.getByText(/january 2024/i)).toBeInTheDocument();
    });

    it('should handle invalid dates gracefully', () => {
      const entryWithInvalidDate: ResumeEntry = {
        ...mockResumeEntry,
        resumeVersion: {
          ...mockResumeEntry.resumeVersion!,
          lastUpdated: 'invalid-date',
        },
      };

      render(<MaterialsSummaryCard resumeEntry={entryWithInvalidDate} />);

      expect(screen.getByText(/date not available/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing resume version', () => {
      const entryWithoutVersion: ResumeEntry = {
        ...mockResumeEntry,
        resumeVersion: undefined,
      };

      render(<MaterialsSummaryCard resumeEntry={entryWithoutVersion} />);

      expect(screen.getByText(/no resume data available/i)).toBeInTheDocument();
    });

    it('should handle different resume types', () => {
      const technicalResume: ResumeEntry = {
        ...mockResumeEntry,
        type: 'Technical',
      };

      render(<MaterialsSummaryCard resumeEntry={technicalResume} />);

      expect(screen.getByText(/technical resume/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have external link icon', () => {
      const { container } = render(
        <MaterialsSummaryCard resumeEntry={mockResumeEntry} />
      );

      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should have calendar icon for date', () => {
      const { container } = render(
        <MaterialsSummaryCard resumeEntry={mockResumeEntry} />
      );

      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });
});
