import Redis from 'ioredis';
import { ConversationSummarizer } from './conversation-summarizer';
import { profileVectorManager } from './profile-vector-manager';

// Memory hierarchy configuration
const SHORT_TERM_TTL = 60 * 60; // 1 hour in seconds
const CONVERSATION_CONTEXT_SIZE = 10; // Last 10 messages

export interface ShortTermMemory {
  userId: string;
  sessionId: string;
  recentMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  workingContext: {
    currentTopic?: string;
    activeProjects?: string[];
    pendingActions?: string[];
    sessionGoals?: string[];
  };
  interactionPatterns: {
    preferredCommunicationStyle?: string;
    frequentTopics?: string[];
    responsePreferences?: string[];
  };
  lastUpdated: number;
}

// Medium-term memory removed - keeping only short-term and long-term

export interface LongTermMemory {
  userId: string;
  careerJourney: {
    majorMilestones: Array<{
      id: string;
      title: string;
      type: string;
      date: string;
      significance: string;
    }>;
    skillEvolution: Array<{
      skill: string;
      progressTimeline: Array<{
        date: string;
        level: string;
        context: string;
      }>;
    }>;
    careerPatterns: {
      motivationFactors: string[];
      challengePatterns: string[];
      successIndicators: string[];
    };
  };
  personalityProfile: {
    communicationStyle: string;
    learningPreferences: string[];
    decisionMakingStyle: string;
    goalOrientationStyle: string;
  };
  relationshipMap: {
    mentors: string[];
    peers: string[];
    collaborators: string[];
  };
  lastUpdated: number;
}

export class MemoryHierarchy {
  private redis: Redis;
  private conversationSummarizer: ConversationSummarizer;

  constructor(redis: Redis) {
    this.redis = redis;
    this.conversationSummarizer = new ConversationSummarizer();
  }

  // === SHORT-TERM MEMORY OPERATIONS ===

  async getShortTermMemory(userId: string, sessionId: string): Promise<ShortTermMemory | null> {
    const key = `short_term:${userId}:${sessionId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async updateShortTermMemory(userId: string, sessionId: string, memory: Partial<ShortTermMemory>): Promise<void> {
    const key = `short_term:${userId}:${sessionId}`;
    const existing = await this.getShortTermMemory(userId, sessionId);
    
    const updated: ShortTermMemory = {
      userId,
      sessionId,
      recentMessages: memory.recentMessages || existing?.recentMessages || [],
      workingContext: { ...existing?.workingContext, ...memory.workingContext },
      interactionPatterns: { ...existing?.interactionPatterns, ...memory.interactionPatterns },
      lastUpdated: Date.now(),
    };

    // Limit recent messages to prevent memory bloat
    if (updated.recentMessages.length > CONVERSATION_CONTEXT_SIZE) {
      updated.recentMessages = updated.recentMessages.slice(-CONVERSATION_CONTEXT_SIZE);
    }

    await this.redis.setex(key, SHORT_TERM_TTL, JSON.stringify(updated));
  }

  async addMessageToShortTerm(
    userId: string, 
    sessionId: string, 
    role: 'user' | 'assistant', 
    content: string
  ): Promise<void> {
    const memory = await this.getShortTermMemory(userId, sessionId);
    const newMessage = {
      role,
      content,
      timestamp: Date.now(),
    };

    const recentMessages = memory?.recentMessages || [];
    recentMessages.push(newMessage);

    await this.updateShortTermMemory(userId, sessionId, { recentMessages });
  }

  // === INSIGHT PROMOTION ===

  async promoteInsightToLongTerm(userId: string, insight: {
    type: 'milestone' | 'skill' | 'goal' | 'challenge' | 'decision';
    content: string;
    context: string;
    importance: number; // 1-10 scale
  }): Promise<void> {
    try {
      // Only promote insights with importance >= 7
      if (insight.importance >= 7) {
        console.log(`📈 Promoting insight to long-term memory for user ${userId}:`, insight.content);
        
        // Store in vector database for semantic search
        await profileVectorManager.storeEntity(userId, {
          id: `insight_${Date.now()}_${Math.random()}`,
          title: `${insight.type}: ${insight.content}`,
          description: insight.context,
          type: insight.type,
          date: new Date().toISOString(),
          importance: insight.importance,
        }, 'conversation_summary');
      }
    } catch (error) {
      console.error('Failed to promote insight to long-term memory:', error);
    }
  }

  // === LONG-TERM MEMORY OPERATIONS ===

  async getLongTermMemory(userId: string): Promise<LongTermMemory | null> {
    // Long-term memory is stored in vector database for semantic search
    try {
      const searchResults = await profileVectorManager.searchProfileHistory(
        userId, 
        'career journey personality profile long term memory', 
        { 
          entityTypes: ['milestone', 'experience', 'education', 'conversation_summary'],
          limit: 20,
          threshold: 0.1 // Lower threshold to get more comprehensive history
        }
      );

      if (searchResults.length === 0) {
        return null;
      }

      // Synthesize long-term memory from search results
      return this.synthesizeLongTermMemory(userId, searchResults);
    } catch (error) {
      console.error('Failed to retrieve long-term memory:', error);
      return null;
    }
  }

  private async synthesizeLongTermMemory(userId: string, searchResults: any[]): Promise<LongTermMemory> {
    // Extract major milestones
    const majorMilestones = searchResults
      .filter(result => result.metadata?.entityType === 'milestone')
      .map(result => ({
        id: result.metadata.id || result.id,
        title: result.metadata.title || 'Career Event',
        type: result.metadata.type || 'milestone',
        date: result.metadata.date || result.metadata.startDate || 'Unknown',
        significance: result.content || 'Significant career milestone',
      }));

    // Extract skill evolution from experiences and conversation summaries
    const skillEvolution = this.extractSkillEvolution(searchResults);

    // Extract career patterns from conversation summaries
    const careerPatterns = this.extractCareerPatterns(searchResults);

    // Extract personality profile from interaction patterns
    const personalityProfile = this.extractPersonalityProfile(searchResults);

    return {
      userId,
      careerJourney: {
        majorMilestones,
        skillEvolution,
        careerPatterns,
      },
      personalityProfile,
      relationshipMap: {
        mentors: [],
        peers: [],
        collaborators: [],
      },
      lastUpdated: Date.now(),
    };
  }

  private extractSkillEvolution(searchResults: any[]): any[] {
    const skillMap = new Map();
    
    searchResults.forEach(result => {
      const skills = result.metadata?.skills || [];
      const date = result.metadata?.date || result.metadata?.startDate;
      
      skills.forEach((skill: string) => {
        if (!skillMap.has(skill)) {
          skillMap.set(skill, []);
        }
        skillMap.get(skill).push({
          date: date || 'Unknown',
          level: 'intermediate', // Could be enhanced with AI analysis
          context: result.content || 'Professional context',
        });
      });
    });

    return Array.from(skillMap.entries()).map(([skill, timeline]) => ({
      skill,
      progressTimeline: timeline.sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    }));
  }

  private extractCareerPatterns(searchResults: any[]): any {
    const summaries = searchResults
      .filter(result => result.metadata?.entityType === 'conversation_summary')
      .map(result => result.metadata?.extractedInsights || [])
      .flat();

    const challenges = summaries
      .filter((insight: any) => insight?.type === 'challenge')
      .map((insight: any) => insight.content);

    const decisions = summaries
      .filter((insight: any) => insight?.type === 'decision')
      .map((insight: any) => insight.content);

    const goals = summaries
      .filter((insight: any) => insight?.type === 'goal')
      .map((insight: any) => insight.content);

    return {
      motivationFactors: goals,
      challengePatterns: challenges,
      successIndicators: decisions,
    };
  }

  private extractPersonalityProfile(searchResults: any[]): any {
    // This would ideally be enhanced with AI analysis of communication patterns
    return {
      communicationStyle: 'collaborative', // Default, could be analyzed
      learningPreferences: ['hands-on', 'project-based'],
      decisionMakingStyle: 'analytical',
      goalOrientationStyle: 'achievement-focused',
    };
  }

  // === SIMPLE INSIGHT EXTRACTION ===

  extractInsightsFromMessage(message: string): Array<{
    type: 'milestone' | 'skill' | 'goal' | 'challenge' | 'decision';
    content: string;
    context: string;
    importance: number;
  }> {
    const insights: any[] = [];
    
    // Simple keyword-based extraction (could be enhanced with AI later)
    const lowerMessage = message.toLowerCase();
    
    // Goal detection - high importance career intentions
    const goalKeywords = ['want to', 'goal', 'planning to', 'hoping to', 'aiming to', 'objective', 'target', 'aspire'];
    if (goalKeywords.some(keyword => lowerMessage.includes(keyword))) {
      insights.push({
        type: 'goal',
        content: this.extractSentenceWithKeyword(message, goalKeywords),
        context: 'User expressed a goal or intention',
        importance: 8,
      });
    }
    
    // Challenge detection - problems and difficulties
    const challengeKeywords = ['struggling with', 'difficult', 'challenge', 'problem', 'stuck', 'frustrated', 'barrier', 'obstacle'];
    if (challengeKeywords.some(keyword => lowerMessage.includes(keyword))) {
      insights.push({
        type: 'challenge',
        content: this.extractSentenceWithKeyword(message, challengeKeywords),
        context: 'User mentioned a challenge or difficulty',
        importance: 7,
      });
    }
    
    // Decision detection - important choices made
    const decisionKeywords = ['decided to', 'choosing', 'decision', 'chose', 'picked', 'selected', 'committed to'];
    if (decisionKeywords.some(keyword => lowerMessage.includes(keyword))) {
      insights.push({
        type: 'decision',
        content: this.extractSentenceWithKeyword(message, decisionKeywords),
        context: 'User made or discussed a decision',
        importance: 8,
      });
    }
    
    // Skill detection - learning and development
    const skillKeywords = ['learning', 'studying', 'developing', 'skill', 'expertise', 'proficient', 'mastering', 'certification'];
    if (skillKeywords.some(keyword => lowerMessage.includes(keyword))) {
      insights.push({
        type: 'skill',
        content: this.extractSentenceWithKeyword(message, skillKeywords),
        context: 'User mentioned skill development or learning',
        importance: 7,
      });
    }
    
    // Milestone detection - achievements and significant events
    const milestoneKeywords = ['achieved', 'completed', 'finished', 'accomplished', 'success', 'promotion', 'started new', 'graduated'];
    if (milestoneKeywords.some(keyword => lowerMessage.includes(keyword))) {
      insights.push({
        type: 'milestone',
        content: this.extractSentenceWithKeyword(message, milestoneKeywords),
        context: 'User mentioned an achievement or milestone',
        importance: 9,
      });
    }
    
    return insights;
  }
  
  private extractSentenceWithKeyword(message: string, keywords: string[]): string {
    const sentences = message.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      if (keywords.some(keyword => lowerSentence.includes(keyword))) {
        return sentence.trim().substring(0, 150); // Limit to 150 characters
      }
    }
    
    // Fallback to first 100 characters if no sentence found
    return message.substring(0, 100);
  }

  // === CONTEXT RETRIEVAL ===

  async getContextForPrompt(userId: string, sessionId: string, query: string): Promise<{
    shortTerm: ShortTermMemory | null;
    longTerm: LongTermMemory | null;
    relevantHistory: any[];
  }> {
    const [shortTerm, longTerm, relevantHistory] = await Promise.all([
      this.getShortTermMemory(userId, sessionId),
      this.getLongTermMemory(userId),
      this.conversationSummarizer.searchConversationHistory(userId, query, 3),
    ]);

    return {
      shortTerm,
      longTerm,
      relevantHistory,
    };
  }

  // === CLEANUP ===

  async cleanupExpiredMemories(): Promise<void> {
    try {
      // Redis automatically handles TTL cleanup for short-term memories
      // Vector database manages long-term memory retention automatically
      console.log('✅ Memory cleanup: Redis TTL handles short-term, Vector DB persists long-term');
    } catch (error) {
      console.error('Memory cleanup error:', error);
    }
  }
}

// Initialize Redis and memory hierarchy
const redis = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    })
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

// Add error handling to prevent app crashes
redis.on('error', (err) => {
  console.warn('Redis connection error (non-critical):', err.message);
});

export const memoryHierarchy = new MemoryHierarchy(redis);