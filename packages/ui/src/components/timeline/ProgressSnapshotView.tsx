/**
 * Progress Snapshot View
 * Displays user progress over 1, 2, and 4 week periods grouped by actual themes of work.
 * Themes are dynamically extracted from session titles/summaries, not static categories.
 * Designed for sharing with managers or personal retrospectives.
 */

import { useState, useMemo } from 'react';
import type { SessionMappingItem } from '@journey/schema';
import {
  Camera,
  Calendar,
  Clock,
  ChevronRight,
  Briefcase,
  Code,
  FileText,
  Users,
  Lightbulb,
  Rocket,
  PenTool,
  MessageSquare,
  Settings,
  TrendingUp,
  Share2,
  Copy,
  Check,
  Layers,
} from 'lucide-react';
import { Button } from '@journey/components';
import { formatSessionDuration, formatSessionDate } from '../../services/session-api';
import { getSessionDisplayTitle } from '../../utils/node-title';

interface ProgressSnapshotViewProps {
  sessions: SessionMappingItem[];
  totalDuration: number;
  nodeTitle?: string;
}

type TimePeriod = '1week' | '2weeks' | '4weeks';

interface WorkTheme {
  id: string;
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  sessions: SessionMappingItem[];
  totalDuration: number;
  keyActivities: string[];
}

// Color palette for themes (assigned dynamically)
const THEME_COLORS = [
  { color: 'blue', icon: Code },
  { color: 'purple', icon: Rocket },
  { color: 'amber', icon: FileText },
  { color: 'green', icon: MessageSquare },
  { color: 'cyan', icon: Lightbulb },
  { color: 'pink', icon: PenTool },
  { color: 'indigo', icon: Layers },
  { color: 'orange', icon: Settings },
  { color: 'teal', icon: Users },
];

const COLOR_STYLES: Record<string, {
  bg: string;
  border: string;
  text: string;
  accent: string;
  iconBg: string;
}> = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-900',
    accent: 'text-blue-600',
    iconBg: 'bg-blue-100',
  },
  indigo: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-900',
    accent: 'text-indigo-600',
    iconBg: 'bg-indigo-100',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-900',
    accent: 'text-purple-600',
    iconBg: 'bg-purple-100',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    accent: 'text-amber-600',
    iconBg: 'bg-amber-100',
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-900',
    accent: 'text-orange-600',
    iconBg: 'bg-orange-100',
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-900',
    accent: 'text-green-600',
    iconBg: 'bg-green-100',
  },
  teal: {
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-900',
    accent: 'text-teal-600',
    iconBg: 'bg-teal-100',
  },
  cyan: {
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    text: 'text-cyan-900',
    accent: 'text-cyan-600',
    iconBg: 'bg-cyan-100',
  },
  pink: {
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-900',
    accent: 'text-pink-600',
    iconBg: 'bg-pink-100',
  },
  gray: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-900',
    accent: 'text-gray-600',
    iconBg: 'bg-gray-100',
  },
};

const TIME_PERIODS: { value: TimePeriod; label: string; days: number }[] = [
  { value: '1week', label: 'Last 7 days', days: 7 },
  { value: '2weeks', label: 'Last 14 days', days: 14 },
  { value: '4weeks', label: 'Last 28 days', days: 28 },
];

/**
 * Extract key terms from a title for grouping similar sessions
 */
function extractKeyTerms(title: string): string[] {
  // Common filler words to ignore
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'dare', 'ought', 'used', 'work', 'working', 'session', 'continue',
    'continued', 'continuing', 'started', 'starting', 'start', 'some',
    'more', 'new', 'this', 'that', 'these', 'those', 'my', 'your', 'our',
  ]);

  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

/**
 * Calculate similarity between two sessions based on their titles/summaries
 */
function calculateSimilarity(session1: SessionMappingItem, session2: SessionMappingItem): number {
  const title1 = getSessionDisplayTitle(session1) || '';
  const title2 = getSessionDisplayTitle(session2) || '';
  
  // Also consider high-level summary
  const text1 = `${title1} ${session1.highLevelSummary || ''}`.toLowerCase();
  const text2 = `${title2} ${session2.highLevelSummary || ''}`.toLowerCase();
  
  const terms1 = new Set(extractKeyTerms(text1));
  const terms2 = new Set(extractKeyTerms(text2));
  
  if (terms1.size === 0 || terms2.size === 0) return 0;
  
  // Calculate Jaccard similarity
  const intersection = [...terms1].filter(term => terms2.has(term)).length;
  const union = new Set([...terms1, ...terms2]).size;
  
  return intersection / union;
}

/**
 * Generate a theme name from a group of sessions
 * Picks the most descriptive/representative title
 */
function generateThemeName(sessions: SessionMappingItem[]): string {
  if (sessions.length === 0) return 'Work Sessions';
  
  // Get all titles
  const titles = sessions
    .map(s => getSessionDisplayTitle(s))
    .filter(Boolean);
  
  if (titles.length === 0) return 'Work Sessions';
  
  // If there's only one session or all have the same title, use that
  if (titles.length === 1) return titles[0];
  
  // Find common patterns in titles
  const titleWords = titles.map(t => extractKeyTerms(t));
  const wordFrequency = new Map<string, number>();
  
  titleWords.forEach(words => {
    words.forEach(word => {
      wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
    });
  });
  
  // Get words that appear in at least half the titles
  const commonWords = [...wordFrequency.entries()]
    .filter(([_, count]) => count >= Math.ceil(titles.length / 2))
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
  
  if (commonWords.length >= 2) {
    // Create a theme from common words
    const themeName = commonWords.slice(0, 3).join(' ');
    // Capitalize first letter of each word
    return themeName
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  
  // Fall back to the title of the session with most time spent
  const longestSession = sessions.reduce((longest, current) => 
    (current.durationSeconds || 0) > (longest.durationSeconds || 0) ? current : longest
  );
  
  return getSessionDisplayTitle(longestSession) || 'Work Sessions';
}

/**
 * Cluster sessions into work themes using similarity-based grouping
 */
function clusterSessionsIntoThemes(sessions: SessionMappingItem[]): WorkTheme[] {
  if (sessions.length === 0) return [];
  
  const SIMILARITY_THRESHOLD = 0.25; // Minimum similarity to group together
  const themes: WorkTheme[] = [];
  const assigned = new Set<string>();
  
  // Sort sessions by duration (longest first) to prioritize important work
  const sortedSessions = [...sessions].sort(
    (a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0)
  );
  
  sortedSessions.forEach((session, index) => {
    if (assigned.has(session.id)) return;
    
    // Start a new theme with this session
    const themeSessions: SessionMappingItem[] = [session];
    assigned.add(session.id);
    
    // Find similar sessions
    sortedSessions.slice(index + 1).forEach(otherSession => {
      if (assigned.has(otherSession.id)) return;
      
      const similarity = calculateSimilarity(session, otherSession);
      if (similarity >= SIMILARITY_THRESHOLD) {
        themeSessions.push(otherSession);
        assigned.add(otherSession.id);
      }
    });
    
    // Create the theme
    const colorConfig = THEME_COLORS[themes.length % THEME_COLORS.length];
    const totalDuration = themeSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    
    // Extract unique activities (high-level summaries)
    const keyActivities: string[] = [];
    themeSessions.forEach(s => {
      if (s.highLevelSummary && !keyActivities.includes(s.highLevelSummary)) {
        keyActivities.push(s.highLevelSummary);
      }
    });
    
    themes.push({
      id: `theme-${themes.length}`,
      name: generateThemeName(themeSessions),
      icon: colorConfig.icon,
      color: colorConfig.color,
      sessions: themeSessions,
      totalDuration,
      keyActivities,
    });
  });
  
  // Sort themes by total duration
  return themes.sort((a, b) => b.totalDuration - a.totalDuration);
}

export function ProgressSnapshotView({ sessions, totalDuration, nodeTitle }: ProgressSnapshotViewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1week');
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Filter sessions by selected time period
  const filteredSessions = useMemo(() => {
    const periodConfig = TIME_PERIODS.find(p => p.value === selectedPeriod);
    if (!periodConfig) return sessions;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodConfig.days);

    return sessions.filter(session => {
      if (!session.startedAt) return false;
      return new Date(session.startedAt) >= cutoffDate;
    });
  }, [sessions, selectedPeriod]);

  // Cluster sessions into work themes
  const workThemes = useMemo(() => {
    return clusterSessionsIntoThemes(filteredSessions);
  }, [filteredSessions]);

  // Calculate period stats
  const periodStats = useMemo(() => {
    const totalTime = filteredSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    const sessionCount = filteredSessions.length;
    const themeCount = workThemes.length;
    
    return { totalTime, sessionCount, themeCount };
  }, [filteredSessions, workThemes]);

  // Generate shareable summary text
  const generateShareableText = () => {
    const periodConfig = TIME_PERIODS.find(p => p.value === selectedPeriod);
    const periodLabel = periodConfig?.label || 'Last week';

    let text = `📊 Progress Snapshot - ${periodLabel}\n\n`;
    
    if (nodeTitle) {
      text += `🎯 Journey: ${nodeTitle}\n\n`;
    }

    text += `📈 Summary:\n`;
    text += `• ${periodStats.sessionCount} work sessions\n`;
    text += `• ${formatSessionDuration(periodStats.totalTime)} total time invested\n`;
    text += `• ${periodStats.themeCount} themes of work\n\n`;

    text += `🔨 What I worked on:\n\n`;

    workThemes.forEach((theme, index) => {
      text += `${index + 1}. ${theme.name} (${formatSessionDuration(theme.totalDuration)})\n`;
      
      // Add key activities
      if (theme.keyActivities.length > 0) {
        theme.keyActivities.slice(0, 2).forEach(activity => {
          text += `   • ${activity}\n`;
        });
      } else {
        // If no high-level summaries, use session titles
        theme.sessions.slice(0, 2).forEach(session => {
          const title = getSessionDisplayTitle(session);
          if (title && title !== theme.name) {
            text += `   • ${title}\n`;
          }
        });
      }
      text += `\n`;
    });

    return text;
  };

  const handleCopyToClipboard = async () => {
    const text = generateShareableText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleTheme = (themeId: string) => {
    setExpandedTheme(expandedTheme === themeId ? null : themeId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-5 border border-indigo-100">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-indigo-900 text-lg">
              <Camera size={22} className="text-indigo-600" />
              Progress Snapshot
            </h3>
            <p className="mt-1 text-sm text-indigo-700">
              Your work organized by themes — perfect for status updates
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyToClipboard}
            className="flex items-center gap-1.5 bg-white/80 hover:bg-white border-indigo-200 text-indigo-700"
          >
            {copied ? (
              <>
                <Check size={14} />
                Copied!
              </>
            ) : (
              <>
                <Copy size={14} />
                Copy summary
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Time Period Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
        {TIME_PERIODS.map(period => (
          <button
            key={period.value}
            onClick={() => setSelectedPeriod(period.value)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              selectedPeriod === period.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <Calendar size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">Sessions</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{periodStats.sessionCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">work sessions logged</div>
        </div>

        <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Clock size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">Time</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatSessionDuration(periodStats.totalTime)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">total time invested</div>
        </div>

        <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-pink-600 mb-1">
            <TrendingUp size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">Focus Areas</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{periodStats.themeCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">themes of work</div>
        </div>
      </div>

      {/* Work Themes */}
      {workThemes.length > 0 ? (
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <Briefcase size={16} className="text-gray-500" />
            What I Worked On
          </h4>

          <div className="space-y-3">
            {workThemes.map((theme, index) => {
              const styles = COLOR_STYLES[theme.color] || COLOR_STYLES.gray;
              const Icon = theme.icon;
              const isExpanded = expandedTheme === theme.id;

              return (
                <div
                  key={theme.id}
                  className={`rounded-xl border ${styles.border} overflow-hidden transition-all`}
                >
                  {/* Theme Header */}
                  <button
                    onClick={() => toggleTheme(theme.id)}
                    className={`w-full ${styles.bg} p-4 flex items-center justify-between hover:brightness-95 transition-all`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${styles.iconBg}`}>
                        <Icon size={20} className={styles.accent} />
                      </div>
                      <div className="text-left">
                        <h5 className={`font-semibold ${styles.text}`}>{theme.name}</h5>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-500">
                            {theme.sessions.length} {theme.sessions.length === 1 ? 'session' : 'sessions'}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">
                            {formatSessionDuration(theme.totalDuration)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      size={18}
                      className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="bg-white p-4 border-t border-gray-100">
                      <div className="space-y-4">
                        {/* Key Activities / What was done */}
                        {theme.keyActivities.length > 0 && (
                          <div>
                            <h6 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                              What I Did
                            </h6>
                            <ul className="space-y-2">
                              {theme.keyActivities.slice(0, 4).map((activity, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-start gap-2 text-sm text-gray-700"
                                >
                                  <div className={`w-1.5 h-1.5 rounded-full bg-current ${styles.accent} mt-1.5 flex-shrink-0`} />
                                  <span className="leading-relaxed">{activity}</span>
                                </li>
                              ))}
                            </ul>
                            {theme.keyActivities.length > 4 && (
                              <p className="text-xs text-gray-400 mt-2 ml-3.5">
                                + {theme.keyActivities.length - 4} more
                              </p>
                            )}
                          </div>
                        )}

                        {/* Session Timeline */}
                        <div className={theme.keyActivities.length > 0 ? 'pt-3 border-t border-gray-100' : ''}>
                          <h6 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Sessions
                          </h6>
                          <div className="space-y-2">
                            {theme.sessions.slice(0, 5).map(session => (
                              <div
                                key={session.id}
                                className="flex items-center justify-between text-sm py-1"
                              >
                                <span className="text-gray-700 truncate max-w-[55%]">
                                  {getSessionDisplayTitle(session)}
                                </span>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span>{formatSessionDate(session.startedAt)}</span>
                                  {session.durationSeconds && (
                                    <>
                                      <span className="text-gray-300">•</span>
                                      <span>{formatSessionDuration(session.durationSeconds)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                            {theme.sessions.length > 5 && (
                              <p className="text-xs text-gray-400 pt-1">
                                + {theme.sessions.length - 5} more sessions
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
          <Camera className="mx-auto h-10 w-10 text-gray-400" />
          <h4 className="mt-3 font-medium text-gray-900">No work logged in this period</h4>
          <p className="mt-1 text-sm text-gray-500">
            Push sessions from your desktop app to see your progress snapshot.
          </p>
        </div>
      )}

      {/* Share/Export Section */}
      {workThemes.length > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 p-5">
          <div className="flex items-start gap-3">
            <Share2 className="text-gray-500 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">Share Your Progress</h4>
              <p className="text-sm text-gray-600 mb-3">
                Copy this snapshot to share with your manager, team, or for your own records.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyToClipboard}
                className="flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    Copied to clipboard!
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy as text
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
