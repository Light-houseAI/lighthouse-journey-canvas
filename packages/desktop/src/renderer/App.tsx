import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { UserProfile, EditingIntent, LLMRequest, ProfileContext, NetworkInsights } from '../shared/types';
import { useDebounce } from './hooks/useDebounce';

interface SampleDocument {
  id: string
  name: string
  description: string
  filePath: string
  intent: 'resume_writing' | 'requirements_documentation'
}

const INTENT_OPTIONS: { value: EditingIntent; label: string; description: string }[] = [
  {
    value: 'resume_writing',
    label: '📄 Resume Writing',
    description: 'Get AI-powered suggestions for writing compelling resumes with quantifiable achievements and strong action verbs'
  },
  {
    value: 'requirements_documentation',
    label: '📋 Requirements Documentation',
    description: 'Get AI-powered help writing clear functional requirements, technical specs, and user stories with acceptance criteria'
  }
];

interface InsightHistoryItem {
  id: string
  timestamp: Date
  message: string
  reasoning: string
  examples: string[]
  suggestedBy: {
    name: string
    role: string
    company: string
  }
}

export default function App() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<EditingIntent | null>(null);
  const [showIntentSelector, setShowIntentSelector] = useState(false);
  const [networkInsights, setNetworkInsights] = useState<NetworkInsights | null>(null);
  const [currentText, setCurrentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [sampleDocuments, setSampleDocuments] = useState<SampleDocument[]>([]);
  const [showSampleDocs, setShowSampleDocs] = useState(false);
  const [insightHistory, setInsightHistory] = useState<InsightHistoryItem[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [shownInsightMessages, setShownInsightMessages] = useState<Set<string>>(new Set());
  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);

  const debouncedText = useDebounce(selectedText || currentText, 800);

  // Load network insights from profile data
  useEffect(() => {
    if (selectedProfile && selectedProfile.networkConnections && selectedProfile.networkConnections.length > 0) {
      // Use real network connections from profile
      const connections = selectedProfile.networkConnections;

      // Extract common data from connections
      const companies = [...new Set(connections.flatMap(c =>
        c.sharedExperience.filter(e => e.type === 'company').map(e => e.name)
      ))];

      const schools = [...new Set(connections.flatMap(c =>
        c.sharedExperience.filter(e => e.type === 'school').map(e => e.name)
      ))];

      const skills = [...new Set(connections.flatMap(c =>
        c.sharedExperience.filter(e => e.type === 'skill').map(e => e.name)
      ))];

      const networkInsights: NetworkInsights = {
        connections,
        commonCompanies: companies,
        commonSchools: schools,
        industryDistribution: { 'Technology': 80, 'Other': 20 },
        skillOverlap: skills,
        careerPaths: [
          {
            description: `Career growth based on ${connections[0]?.name}'s path`,
            examplePeople: connections.map(c => c.name),
            commonTransitions: ['Increased scope', 'Led teams', 'Built expertise'],
            timeframe: '5-8 years'
          }
        ]
      };

      setNetworkInsights(networkInsights);
    } else {
      setNetworkInsights(null);
    }
  }, [selectedProfile])

  // Load profiles on mount - show both demo profiles
  useEffect(() => {
    async function loadProfiles() {
      const response = await window.api.loadProfiles();
      if (response.success && response.data) {
        // Filter to only show Lisa Chen and Jordan Williams
        const demoProfiles = response.data.filter(p =>
          p.id === 'user-005' || p.id === 'user-023'
        );
        setProfiles(demoProfiles);
      }
    }
    loadProfiles();
  }, []);

  // Get LLM suggestion when text changes (debounced)
  useEffect(() => {
    // Only generate insights if we have network insights available
    if (!selectedProfile || !selectedIntent || !debouncedText || debouncedText.length < 10 || !networkInsights || networkInsights.connections.length === 0) {
      return;
    }

    async function getSuggestion() {
      setLoading(true);
      try {
        // Extract skills from projects
        const projectTechnologies = selectedProfile.jobs
          .flatMap(job => job.projects)
          .flatMap(project => project.technologies)
          .filter((tech, index, self) => self.indexOf(tech) === index) // unique
          .slice(0, 10); // top 10

        // Extract key insights from profile
        const userInsights = [
          ...selectedProfile.insights.map(i => i.description),
          ...selectedProfile.jobs.flatMap(job => job.insights.map(i => i.description))
        ].slice(0, 5); // top 5 insights

        const profileContext: ProfileContext = {
          userName: selectedProfile.name,
          currentRole: selectedProfile.jobs[0]?.role || null,
          recentProjects: selectedProfile.jobs[0]?.projects.slice(0, 3).map(p => p.title) || [],
          skills: projectTechnologies,
          education: selectedProfile.education.map(e => e.degree || e.schoolName),
          userInsights,
          networkInsights: networkInsights || undefined
        };

        const request: LLMRequest = {
          intent: selectedIntent,
          currentText: debouncedText,
          profileContext,
          userId: selectedProfile.id,
          sessionId,
          previousInsights: insightHistory.map(i => i.message)
        };

        const response = await window.api.getLLMSuggestion(request);

        if (response.success && response.data?.suggestion) {
          const { message, reasoning, examples } = response.data.suggestion;

          // Check network insights availability
          if (!networkInsights || networkInsights.connections.length === 0) {
            console.warn('No network connections available - skipping insight');
            return;
          }

          // Check if we've already shown this insight (avoid duplicates in session)
          if (shownInsightMessages.has(message)) {
            console.log('Skipping duplicate insight:', message);
            return;
          }

          // Pick a random network connection to attribute the insight to
          const randomConnection = networkInsights.connections[
            Math.floor(Math.random() * networkInsights.connections.length)
          ];

          // Add to insight history
          const newInsight: InsightHistoryItem = {
            id: `insight-${Date.now()}`,
            timestamp: new Date(),
            message,
            reasoning,
            examples,
            suggestedBy: {
              name: randomConnection.name,
              role: randomConnection.currentRole,
              company: randomConnection.currentCompany
            }
          };

          // Track this insight message to prevent duplicates
          setShownInsightMessages(prev => new Set(prev).add(message));
          setInsightHistory(prev => [newInsight, ...prev]);
        } else if (response.data?.error) {
          toast.error(response.data.error.message, {
            action: response.data.error.retryable ? {
              label: 'Retry',
              onClick: () => getSuggestion()
            } : undefined
          });
        }
      } catch (error) {
        console.error('Failed to get suggestion:', error);
      } finally {
        setLoading(false);
      }
    }

    getSuggestion();
  }, [debouncedText, selectedProfile, selectedIntent, sessionId, networkInsights]);

  // Handle text selection
  const handleTextSelect = () => {
    if (textAreaRef.current) {
      const start = textAreaRef.current.selectionStart;
      const end = textAreaRef.current.selectionEnd;
      const selected = currentText.substring(start, end);

      if (selected && selected.length > 10) {
        setSelectedText(selected);
      } else {
        setSelectedText('');
      }
    }
  };

  const handleStartSession = (profile: UserProfile, intent: EditingIntent) => {
    setSelectedProfile(profile);
    setSelectedIntent(intent);

    // Load initial text based on intent
    if (intent === 'resume_writing' && profile.jobs[0]?.description) {
      setCurrentText(profile.jobs[0].description);
    } else if (intent === 'requirements_documentation') {
      // Start with empty text for requirements docs
      setCurrentText('');
    } else {
      setCurrentText('');
    }
  };

  const handleStopSession = () => {
    setSelectedProfile(null);
    setSelectedIntent(null);
    setShowIntentSelector(false);
    setCurrentText('');
    setInsightHistory([]);
    setShownInsightMessages(new Set());
  };

  const handleProfileClick = async (profile: UserProfile) => {
    setSelectedProfile(profile);
    setSelectedIntent('resume_writing');

    // Load the profile's sample resume directly
    const documentId = profile.id === 'user-005' ? 'lisa-resume' : 'jordan-resume';
    const response = await window.api.loadSampleDocument(documentId);
    if (response.success && response.data) {
      setCurrentText(response.data);
    }
  };

  const handleIntentSelect = (intent: EditingIntent) => {
    if (selectedProfile) {
      handleStartSession(selectedProfile, intent);
      setShowIntentSelector(false);
    }
  };

  const handleLoadSampleDocument = async (documentId: string) => {
    try {
      const response = await window.api.loadSampleDocument(documentId);
      if (response.success && response.data) {
        setCurrentText(response.data);
        setShowSampleDocs(false);
        toast.success('Sample document loaded');
      } else {
        toast.error('Failed to load sample document');
      }
    } catch (error) {
      console.error('Error loading sample document:', error);
      toast.error('Failed to load sample document');
    }
  };

  // Load sample documents when intent is selected
  useEffect(() => {
    if (selectedIntent) {
      async function loadSampleDocs() {
        const response = await window.api.getSampleDocuments();
        if (response.success && response.data) {
          // Filter documents by current intent
          const filtered = response.data.filter(d => d.intent === selectedIntent);
          setSampleDocuments(filtered);
        }
      }
      loadSampleDocs();
    }
  }, [selectedIntent]);

  // Skip intent selection screen - we now go directly to editor

  // Profile Selection Screen
  if (!selectedProfile) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <Toaster position="top-right" />
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Lighthouse Insight Assistant</h1>

          {profiles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading profiles...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Select a Profile to Edit Resume</h2>
              {profiles.map(profile => (
                <div
                  key={profile.id}
                  className="bg-white rounded-lg shadow p-6 hover:shadow-lg hover:border-blue-500 border-2 border-transparent transition-all cursor-pointer"
                  onClick={() => handleProfileClick(profile)}
                >
                  <h3 className="text-lg font-semibold text-gray-900">{profile.name}</h3>
                  <p className="text-sm text-gray-600">{profile.email}</p>
                  {profile.jobs[0] && (
                    <p className="text-sm text-gray-500 mt-2">
                      {profile.jobs[0].role} at {profile.jobs[0].companyName}
                    </p>
                  )}
                  <p className="text-xs text-blue-600 mt-3">Click to load resume and start editing</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Editor Screen
  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" limit={1} />

      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {INTENT_OPTIONS.find(o => o.value === selectedIntent)?.label}
              </h1>
              <p className="text-sm text-gray-600">
                {selectedProfile.name} • {selectedProfile.jobs[0]?.role || 'No role'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleStopSession}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Stop Session
              </button>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 p-6 flex gap-6">
          {/* Insights Panel */}
          <div className="w-80 bg-white rounded-lg shadow flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Network Insights</h2>
              <p className="text-xs text-gray-500 mt-1">
                {insightHistory.length} insights from your network
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {insightHistory.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">
                  Start typing to receive insights from your network...
                </div>
              ) : (
                insightHistory.map((insight) => (
                  <div
                    key={insight.id}
                    className="bg-blue-50 rounded-lg p-3 border border-blue-100 relative group"
                  >
                    <button
                      onClick={() => setInsightHistory(prev => prev.filter(i => i.id !== insight.id))}
                      className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Dismiss insight"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    <div className="flex items-start justify-between mb-2 pr-6">
                      <span className="text-xs text-blue-600 font-medium">
                        {insight.timestamp.toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="mb-2 pb-2 border-b border-blue-200">
                      <p className="text-xs text-gray-500">Insight from:</p>
                      <p className="text-xs font-medium text-gray-700">
                        {insight.suggestedBy.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        {insight.suggestedBy.role} at {insight.suggestedBy.company}
                      </p>
                    </div>

                    <p className="text-sm text-gray-900 font-medium mb-2">
                      {insight.message}
                    </p>
                    <p className="text-xs text-gray-600 mb-2">
                      {insight.reasoning}
                    </p>
                    {insight.examples.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <p className="text-xs text-gray-500 mb-1">Examples:</p>
                        {insight.examples.map((ex, idx) => (
                          <p key={idx} className="text-xs text-gray-700 italic">
                            • {ex}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Text Editor */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 bg-white rounded-lg shadow">
              <textarea
                ref={textAreaRef}
                value={currentText}
                onChange={(e) => setCurrentText(e.target.value)}
                onSelect={handleTextSelect}
                onMouseUp={handleTextSelect}
                className="w-full h-full p-6 text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
                placeholder="Start typing or select text to receive insights from your network..."
              />
            </div>

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <div>
                {loading && <span className="text-blue-600">Getting insights...</span>}
                {!loading && selectedText && (
                  <span className="text-blue-600">{selectedText.length} characters selected</span>
                )}
                {!loading && !selectedText && debouncedText.length > 0 && (
                  <span>{debouncedText.length} characters</span>
                )}
              </div>
              <div className="text-xs text-gray-400">
                Session-only • Changes not saved
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
