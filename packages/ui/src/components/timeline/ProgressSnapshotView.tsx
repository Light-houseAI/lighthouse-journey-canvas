/**
 * Progress Snapshot View
 * Displays LLM-generated outcome-oriented progress over 1, 2, and 4 week periods.
 * Falls back to client-side clustering if LLM generation fails.
 * Designed for sharing with managers or personal retrospectives.
 */

import { useState, useMemo, useEffect } from 'react';
import type { SessionMappingItem, ProgressSnapshotTheme } from '@journey/schema';
import {
  Camera,
  Calendar,
  Clock,
  ChevronRight,
  ChevronDown,
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
  AlertCircle,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Button } from '@journey/components';
import { formatSessionDuration, formatSessionDate } from '../../services/session-api';
import { getSessionDisplayTitle } from '../../utils/node-title';
import { useProgressSnapshot } from '../../hooks/useProgressSnapshot';

interface ProgressSnapshotViewProps {
  sessions: SessionMappingItem[];
  totalDuration: number;
  nodeTitle?: string;
  nodeId?: string;
}

type TimePeriod = '1day' | '1week' | '2weeks' | '4weeks';

// Legacy WorkTheme interface for fallback client-side clustering
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
  { value: '1day', label: 'Last 1 day', days: 1 },
  { value: '1week', label: 'Last 7 days', days: 7 },
  { value: '2weeks', label: 'Last 14 days', days: 14 },
  { value: '4weeks', label: 'Last 28 days', days: 28 },
];

// ============================================================================
// FALLBACK CLIENT-SIDE CLUSTERING (kept for graceful degradation)
// ============================================================================

function extractKeyTerms(title: string): string[] {
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

function calculateSimilarity(session1: SessionMappingItem, session2: SessionMappingItem): number {
  const title1 = getSessionDisplayTitle(session1) || '';
  const title2 = getSessionDisplayTitle(session2) || '';
  
  const text1 = `${title1} ${session1.highLevelSummary || ''}`.toLowerCase();
  const text2 = `${title2} ${session2.highLevelSummary || ''}`.toLowerCase();
  
  const terms1 = new Set(extractKeyTerms(text1));
  const terms2 = new Set(extractKeyTerms(text2));
  
  if (terms1.size === 0 || terms2.size === 0) return 0;
  
  const intersection = [...terms1].filter(term => terms2.has(term)).length;
  const union = new Set([...terms1, ...terms2]).size;
  
  return intersection / union;
}

function generateThemeName(sessions: SessionMappingItem[]): string {
  if (sessions.length === 0) return 'Work Sessions';
  
  const titles = sessions
    .map(s => getSessionDisplayTitle(s))
    .filter(Boolean);
  
  if (titles.length === 0) return 'Work Sessions';
  if (titles.length === 1) return titles[0];
  
  const titleWords = titles.map(t => extractKeyTerms(t));
  const wordFrequency = new Map<string, number>();
  
  titleWords.forEach(words => {
    words.forEach(word => {
      wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
    });
  });
  
  const commonWords = [...wordFrequency.entries()]
    .filter(([_, count]) => count >= Math.ceil(titles.length / 2))
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
  
  if (commonWords.length >= 2) {
    const themeName = commonWords.slice(0, 3).join(' ');
    return themeName
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  
  const longestSession = sessions.reduce((longest, current) => 
    (current.durationSeconds || 0) > (longest.durationSeconds || 0) ? current : longest
  );
  
  return getSessionDisplayTitle(longestSession) || 'Work Sessions';
}

function clusterSessionsIntoThemes(sessions: SessionMappingItem[]): WorkTheme[] {
  if (sessions.length === 0) return [];
  
  const SIMILARITY_THRESHOLD = 0.25;
  const themes: WorkTheme[] = [];
  const assigned = new Set<string>();
  
  const sortedSessions = [...sessions].sort(
    (a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0)
  );
  
  sortedSessions.forEach((session, index) => {
    if (assigned.has(session.id)) return;
    
    const themeSessions: SessionMappingItem[] = [session];
    assigned.add(session.id);
    
    sortedSessions.slice(index + 1).forEach(otherSession => {
      if (assigned.has(otherSession.id)) return;
      
      const similarity = calculateSimilarity(session, otherSession);
      if (similarity >= SIMILARITY_THRESHOLD) {
        themeSessions.push(otherSession);
        assigned.add(otherSession.id);
      }
    });
    
    const colorConfig = THEME_COLORS[themes.length % THEME_COLORS.length];
    const totalDuration = themeSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    
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
  
  // Limit to top 3 themes (matching LLM output)
  return themes.sort((a, b) => b.totalDuration - a.totalDuration).slice(0, 3);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ProgressSnapshotView({ 
  sessions, 
  totalDuration, 
  nodeTitle,
  nodeId 
}: ProgressSnapshotViewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1week');
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const periodConfig = TIME_PERIODS.find(p => p.value === selectedPeriod);
  const days = periodConfig?.days || 7;
  const rangeLabel = periodConfig?.label || 'Last 7 days';

  // Fetch LLM-generated snapshot if nodeId is provided
  const { 
    snapshot, 
    isLoading: isLLMLoading,
    isFetching: isLLMFetching,
    useFallback,
  } = useProgressSnapshot(
    nodeId || '',
    {
      days,
      rangeLabel,
      journeyName: nodeTitle || 'Work',
    },
    !!nodeId && sessions.length > 0
  );

  // Filter sessions by selected time period (for fallback and evidence)
  const filteredSessions = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return sessions.filter(session => {
      if (!session.startedAt) return false;
      return new Date(session.startedAt) >= cutoffDate;
    });
  }, [sessions, days]);

  // Fallback: client-side clustering when LLM is unavailable
  const fallbackThemes = useMemo(() => {
    if (snapshot && !useFallback) return [];
    return clusterSessionsIntoThemes(filteredSessions);
  }, [filteredSessions, snapshot, useFallback]);

  // Use LLM snapshot or fallback
  const useSnapshot = snapshot && !useFallback;

  // Calculate period stats from either source
  const periodStats = useMemo(() => {
    if (useSnapshot && snapshot) {
      return {
        totalTime: snapshot.metrics.timeSeconds,
        sessionCount: snapshot.metrics.sessionCount,
        themeCount: snapshot.themes.length,
      };
    }
    
    const totalTime = filteredSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    const sessionCount = filteredSessions.length;
    const themeCount = fallbackThemes.length;
    
    return { totalTime, sessionCount, themeCount };
  }, [useSnapshot, snapshot, filteredSessions, fallbackThemes]);

  // Get sessions for a theme by sessionIds
  const getSessionsForTheme = (sessionIds: string[]): SessionMappingItem[] => {
    return filteredSessions.filter(s => sessionIds.includes(s.id));
  };

  // Generate shareable summary text (executive-clean format)
  const generateShareableText = () => {
    let text = `Progress Snapshot - ${rangeLabel}\n`;
    
    if (nodeTitle) {
      text += `Journey: ${nodeTitle}\n`;
    }
    text += '\n';

    // Headlines (LLM only)
    if (useSnapshot && snapshot && snapshot.headlines.length > 0) {
      text += `Headlines:\n`;
      snapshot.headlines.forEach(headline => {
        text += `• ${headline}\n`;
      });
      text += '\n';
    }

    text += `Wins / Progress:\n\n`;

    if (useSnapshot && snapshot) {
      // LLM-generated themes
      snapshot.themes.forEach((theme, index) => {
        text += `${index + 1}. ${theme.name} - ${theme.outcome}\n`;
        
        if (theme.keyWork.length > 0) {
          text += `   Key work:\n`;
          theme.keyWork.forEach(work => {
            text += `   • ${work}\n`;
          });
        }
        
        if (theme.blockers.length > 0) {
          text += `   Blockers:\n`;
          theme.blockers.forEach(blocker => {
            text += `   • ${blocker}\n`;
          });
        }
        
        text += `   Evidence: ${theme.sessionIds.length} sessions • ${formatSessionDuration(theme.timeSeconds)}\n`;
        text += '\n';
      });

      // Needs input section
      if (snapshot.needsInput.length > 0) {
        text += `Needs Input:\n`;
        snapshot.needsInput.forEach(item => {
          text += `• ${item}\n`;
        });
        text += '\n';
      }
    } else {
      // Fallback format
      fallbackThemes.forEach((theme, index) => {
        text += `${index + 1}. ${theme.name} (${formatSessionDuration(theme.totalDuration)})\n`;
        
        if (theme.keyActivities.length > 0) {
          theme.keyActivities.slice(0, 2).forEach(activity => {
            text += `   • ${activity}\n`;
          });
        } else {
          theme.sessions.slice(0, 2).forEach(session => {
            const title = getSessionDisplayTitle(session);
            if (title && title !== theme.name) {
              text += `   • ${title}\n`;
            }
          });
        }
        text += '\n';
      });
    }

    text += `Metrics: ${periodStats.sessionCount} sessions, ${formatSessionDuration(periodStats.totalTime)}, ${periodStats.themeCount} focus areas`;

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

  // Show full loading state only on initial load (no cached/placeholder data)
  // When switching tabs, keepPreviousData provides previous snapshot, so we show a subtle indicator
  const showFullLoading = isLLMLoading && nodeId && !snapshot;
  // Show refreshing indicator whenever fetching (switching tabs or refetching)
  const showRefreshingIndicator = isLLMFetching && nodeId;

  if (showFullLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-5 border border-indigo-100">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            <div>
              <h3 className="font-semibold text-indigo-900 text-lg">
                Generating Progress Snapshot
              </h3>
              <p className="mt-1 text-sm text-indigo-700">
                Creating outcome-oriented summary with AI...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const themes = useSnapshot && snapshot ? snapshot.themes : [];
  const hasThemes = useSnapshot ? themes.length > 0 : fallbackThemes.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-5 border border-indigo-100">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-indigo-900 text-lg">
              <Camera size={22} className="text-indigo-600" />
              Progress Snapshot
              {useSnapshot && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                  <Sparkles size={12} />
                  AI Enhanced
                </span>
              )}
              {showRefreshingIndicator && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                  <Loader2 size={12} className="animate-spin" />
                  Updating...
                </span>
              )}
            </h3>
            <p className="mt-1 text-sm text-indigo-700">
              {useSnapshot 
                ? 'Outcome-oriented summary — perfect for status updates'
                : 'Your work organized by themes — perfect for status updates'
              }
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

      {/* Headlines (LLM only) */}
      {useSnapshot && snapshot && snapshot.headlines.length > 0 && (
        <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Headlines
          </h4>
          <ul className="space-y-2">
            {snapshot.headlines.map((headline, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-800">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                <span className="leading-relaxed font-medium">{headline}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
      {hasThemes ? (
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <Briefcase size={16} className="text-gray-500" />
            {useSnapshot ? 'Wins / Progress' : 'What I Worked On'}
          </h4>

          <div className="space-y-3">
            {useSnapshot && snapshot ? (
              // LLM-generated themes
              snapshot.themes.map((theme, index) => {
                const colorConfig = THEME_COLORS[index % THEME_COLORS.length];
                const styles = COLOR_STYLES[colorConfig.color] || COLOR_STYLES.gray;
                const Icon = colorConfig.icon;
                const themeId = `llm-theme-${index}`;
                const isExpanded = expandedTheme === themeId;
                const themeSessions = getSessionsForTheme(theme.sessionIds);

                return (
                  <LLMThemeCard
                    key={themeId}
                    theme={theme}
                    themeId={themeId}
                    isExpanded={isExpanded}
                    onToggle={() => toggleTheme(themeId)}
                    styles={styles}
                    Icon={Icon}
                    sessions={themeSessions}
                  />
                );
              })
            ) : (
              // Fallback client-side themes
              fallbackThemes.map((theme) => {
                const styles = COLOR_STYLES[theme.color] || COLOR_STYLES.gray;
                const Icon = theme.icon;
                const isExpanded = expandedTheme === theme.id;

                return (
                  <FallbackThemeCard
                    key={theme.id}
                    theme={theme}
                    isExpanded={isExpanded}
                    onToggle={() => toggleTheme(theme.id)}
                    styles={styles}
                    Icon={Icon}
                  />
                );
              })
            )}
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

      {/* Needs Input Section (LLM only) */}
      {useSnapshot && snapshot && snapshot.needsInput.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <h4 className="flex items-center gap-2 font-semibold text-amber-900 mb-3">
            <AlertCircle size={16} className="text-amber-600" />
            Needs Input
          </h4>
          <ul className="space-y-2">
            {snapshot.needsInput.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-amber-800">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Share/Export Section */}
      {hasThemes && (
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

// ============================================================================
// THEME CARD COMPONENTS
// ============================================================================

interface LLMThemeCardProps {
  theme: ProgressSnapshotTheme;
  themeId: string;
  isExpanded: boolean;
  onToggle: () => void;
  styles: typeof COLOR_STYLES[string];
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  sessions: SessionMappingItem[];
}

function LLMThemeCard({ 
  theme, 
  themeId, 
  isExpanded, 
  onToggle, 
  styles, 
  Icon,
  sessions 
}: LLMThemeCardProps) {
  return (
    <div className={`rounded-xl border ${styles.border} overflow-hidden transition-all`}>
      {/* Theme Header */}
      <button
        onClick={onToggle}
        className={`w-full ${styles.bg} p-4 flex items-center justify-between hover:brightness-95 transition-all`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${styles.iconBg}`}>
            <Icon size={20} className={styles.accent} />
          </div>
          <div className="text-left">
            <h5 className={`font-semibold ${styles.text}`}>{theme.name}</h5>
            <p className="text-sm text-gray-600 mt-0.5">{theme.outcome}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500">
                {theme.sessionIds.length} {theme.sessionIds.length === 1 ? 'session' : 'sessions'}
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-500">
                {formatSessionDuration(theme.timeSeconds)}
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
            {/* Key Work */}
            {theme.keyWork.length > 0 && (
              <div>
                <h6 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Key Work
                </h6>
                <ul className="space-y-2">
                  {theme.keyWork.map((work, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <div className={`w-1.5 h-1.5 rounded-full bg-current ${styles.accent} mt-1.5 flex-shrink-0`} />
                      <span className="leading-relaxed">{work}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Blockers */}
            {theme.blockers.length > 0 && (
              <div>
                <h6 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
                  Blockers / Risks
                </h6>
                <ul className="space-y-2">
                  {theme.blockers.map((blocker, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-amber-700">
                      <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                      <span className="leading-relaxed">{blocker}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next Steps */}
            {theme.next.length > 0 && (
              <div>
                <h6 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Next
                </h6>
                <ul className="space-y-2">
                  {theme.next.map((nextItem, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <ChevronRight size={14} className={`mt-0.5 flex-shrink-0 ${styles.accent}`} />
                      <span className="leading-relaxed">{nextItem}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Evidence Accordion */}
            <EvidenceSection sessions={sessions} styles={styles} />
          </div>
        </div>
      )}
    </div>
  );
}

interface FallbackThemeCardProps {
  theme: WorkTheme;
  isExpanded: boolean;
  onToggle: () => void;
  styles: typeof COLOR_STYLES[string];
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}

function FallbackThemeCard({ theme, isExpanded, onToggle, styles, Icon }: FallbackThemeCardProps) {
  return (
    <div className={`rounded-xl border ${styles.border} overflow-hidden transition-all`}>
      {/* Theme Header */}
      <button
        onClick={onToggle}
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
            {/* Key Activities */}
            {theme.keyActivities.length > 0 && (
              <div>
                <h6 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  What I Did
                </h6>
                <ul className="space-y-2">
                  {theme.keyActivities.slice(0, 4).map((activity, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
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

            {/* Evidence Accordion */}
            <EvidenceSection sessions={theme.sessions} styles={styles} />
          </div>
        </div>
      )}
    </div>
  );
}

interface EvidenceSectionProps {
  sessions: SessionMappingItem[];
  styles: typeof COLOR_STYLES[string];
}

function EvidenceSection({ sessions, styles }: EvidenceSectionProps) {
  const [showSessions, setShowSessions] = useState(false);

  if (sessions.length === 0) return null;

  return (
    <div className="pt-3 border-t border-gray-100">
      <button
        onClick={() => setShowSessions(!showSessions)}
        className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
      >
        {showSessions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Evidence ({sessions.length} sessions)
      </button>
      
      {showSessions && (
        <div className="mt-2 space-y-2">
          {sessions.slice(0, 5).map(session => (
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
          {sessions.length > 5 && (
            <p className="text-xs text-gray-400 pt-1">
              + {sessions.length - 5} more sessions
            </p>
          )}
        </div>
      )}
    </div>
  );
}
