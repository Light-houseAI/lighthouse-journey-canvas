import { LINKEDIN_TYPE, ResumeEntry } from '@journey/schema';
import { Calendar, ExternalLink } from 'lucide-react';

interface MaterialsSummaryCardProps {
  resumeEntry: ResumeEntry;
}

/**
 * Displays a summary card for a resume or LinkedIn profile
 * Shows URL, last updated date, and LLM-generated summary in bullet points
 */
export function MaterialsSummaryCard({
  resumeEntry,
}: MaterialsSummaryCardProps) {
  const { type, resumeVersion } = resumeEntry;

  // Guard against missing resume version
  if (!resumeVersion) {
    return (
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <p className="text-gray-500">No resume data available</p>
      </div>
    );
  }

  const { url, lastUpdated, editHistorySummary } = resumeVersion;

  const isLinkedIn = type === LINKEDIN_TYPE;

  // Format date - matches interview-chapter-detail.tsx pattern
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return 'Date not available';
    }
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  // Parse edit history summary into bullet points
  const getBulletPoints = (summary?: string) => {
    if (!summary) return [];

    return summary
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.replace(/^[-•*]\s*/, ''));
  };

  const bulletPoints = getBulletPoints(editHistorySummary);

  return (
    <div>
      {/* Resume Type / Title with Last Updated */}
      <div className="mb-4 flex items-baseline gap-3">
        <h3 className="text-lg font-semibold leading-[30px] tracking-[-0.05px] text-[#333333]">
          {isLinkedIn ? 'LinkedIn Profile' : `${type} Resume`}
        </h3>
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Calendar className="h-3.5 w-3.5" />
          <span>Last Updated {formatDate(lastUpdated)}</span>
        </div>
      </div>

      {/* Content Section */}
      <div className="space-y-0 text-[15px] leading-[1.5] text-[#666666]">
        {/* URL */}
        <div className="mb-4">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-teal-600 hover:underline"
          >
            <span>{isLinkedIn ? 'View LinkedIn Profile' : 'View Resume'}</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Edit History Summary Section */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="mb-2 font-bold text-gray-900">Steps</p>

          {bulletPoints.length > 0 ? (
            <ul className="ml-[22.5px] list-disc space-y-1">
              {bulletPoints.map((point, idx) => (
                <li key={idx} className="text-gray-700">
                  <span className="leading-[1.5]">{point}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="italic text-gray-500">
              Summary will be generated automatically after saving edits.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
