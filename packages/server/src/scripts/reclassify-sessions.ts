/**
 * Re-classify Sessions Script
 * 
 * This script intelligently consolidates fragmented work tracks by:
 * 1. Analyzing ALL sessions for a user to understand their work themes
 * 2. Creating broad thematic tracks based on actual work content
 * 3. Consolidating narrow tracks into these broader themes
 * 
 * The script discovers groupings dynamically based on session content.
 * 
 * Usage:
 *   pnpm dlx tsx packages/server/src/scripts/reclassify-sessions.ts [--user <userId>]
 * 
 * Options:
 *   --user <userId>  Process only a specific user
 *   --dry-run        Show what would be done without making changes
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, desc, count } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '@journey/schema';
import { timelineNodes, sessionMappings } from '@journey/schema';
import { TimelineNodeType, TrackTemplateType, WorkTrackArchetype } from '@journey/schema';

const { Pool } = pg;

// Configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/journey';

// Parse command line arguments
const args = process.argv.slice(2);
const targetUserId = args.includes('--user') ? parseInt(args[args.indexOf('--user') + 1]) : null;
const dryRun = args.includes('--dry-run');

// Similarity threshold for merging tracks (0-1, higher = more strict)
const SIMILARITY_THRESHOLD = 0.3; // Lowered to be more aggressive in grouping

interface WorkTrack {
  id: string;
  title: string;
  parentId: string | null;
  meta: Record<string, any>;
  userId: number;
  createdAt: Date;
  sessionCount?: number;
}

interface Session {
  id: string;
  nodeId: string | null;
  workflowName: string | null;
  highLevelSummary: string | null;
}

interface TrackCluster {
  primaryTrack: WorkTrack;
  relatedTracks: WorkTrack[];
  keywords: string[];
}

async function main() {
  console.log('🚀 Starting intelligent session reclassification...\n');
  console.log('This script will:');
  console.log('  1. Analyze ALL sessions to understand work themes');
  console.log('  2. Group sessions by their content similarity');
  console.log('  3. Create/update work tracks based on discovered themes');
  console.log('  4. Consolidate narrow tracks into broader thematic tracks\n');
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }
  
  if (targetUserId) {
    console.log(`🎯 Processing only user ID: ${targetUserId}\n`);
  }
  
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, { schema });

  try {
    // Get users to process
    let users: { id: number }[];
    if (targetUserId) {
      users = [{ id: targetUserId }];
    } else {
      users = await db.select({ id: schema.users.id }).from(schema.users);
    }
    console.log(`Found ${users.length} user(s) to process\n`);

    for (const user of users) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Processing user ID: ${user.id}`);
      console.log(`${'='.repeat(60)}`);

      await processUserV2(db, user.id);
    }

    console.log('\n✅ Reclassification complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * V2 processor - analyzes sessions content to find natural groupings
 */
async function processUserV2(db: any, userId: number) {
  // Step 1: Get ALL sessions for this user with their current mappings
  const allSessions = await db
    .select({
      id: sessionMappings.id,
      nodeId: sessionMappings.nodeId,
      workflowName: sessionMappings.workflowName,
      highLevelSummary: sessionMappings.highLevelSummary,
      startedAt: sessionMappings.startedAt,
    })
    .from(sessionMappings)
    .where(eq(sessionMappings.userId, userId))
    .orderBy(desc(sessionMappings.startedAt));

  console.log(`\n  📊 Found ${allSessions.length} sessions total`);

  if (allSessions.length === 0) {
    console.log('  No sessions to process');
    return;
  }

  // Step 2: Get the parent journey - prefer one that already has sessions mapped to it
  const journeys = await db
    .select()
    .from(timelineNodes)
    .where(
      and(
        eq(timelineNodes.userId, userId),
        eq(timelineNodes.type, TimelineNodeType.Job)
      )
    );

  if (journeys.length === 0) {
    console.log('  ⚠️ No journeys found, skipping user');
    return;
  }

  // Find the journey that has the most activity (sessions or child nodes)
  let primaryJourney = journeys[0];
  let maxActivity = 0;
  
  for (const journey of journeys) {
    // Check for existing work tracks under this journey
    const [trackCount] = await db
      .select({ count: count() })
      .from(timelineNodes)
      .where(
        and(
          eq(timelineNodes.parentId, journey.id),
          eq(timelineNodes.type, TimelineNodeType.Project)
        )
      );
    
    // Check for sessions mapped to this journey or its children
    const [sessionCount] = await db
      .select({ count: count() })
      .from(sessionMappings)
      .where(eq(sessionMappings.nodeId, journey.id));
    
    const activity = (trackCount?.count || 0) + (sessionCount?.count || 0);
    
    // Also give preference to "founder" role as it's typically the primary
    const isFounder = (journey.meta?.role || '').toLowerCase().includes('founder');
    const adjustedActivity = isFounder ? activity + 10 : activity;
    
    if (adjustedActivity > maxActivity) {
      maxActivity = adjustedActivity;
      primaryJourney = journey;
    }
  }
  
  console.log(`  Primary journey: ${primaryJourney.meta?.role || primaryJourney.meta?.title || 'Unknown'} (selected from ${journeys.length} journeys)`);

  // Step 3: Analyze session content to discover themes
  const sessionThemes = analyzeSessionThemes(allSessions);
  
  console.log('\n  📋 Discovered session themes:');
  for (const [theme, sessions] of sessionThemes.entries()) {
    console.log(`    • ${theme}: ${sessions.length} session(s)`);
    sessions.forEach(s => console.log(`      - "${s.workflowName}"`));
  }

  // Step 4: Get existing work tracks
  const existingTracks = await db
    .select()
    .from(timelineNodes)
    .where(
      and(
        eq(timelineNodes.userId, userId),
        eq(timelineNodes.type, TimelineNodeType.Project)
      )
    );

  // Step 5: For each discovered theme, create/find a work track and map sessions
  for (const [themeName, themeSessions] of sessionThemes.entries()) {
    console.log(`\n  🔄 Processing theme: "${themeName}" (${themeSessions.length} sessions)`);

    // Find or create a track for this theme
    let targetTrack = existingTracks.find((t: WorkTrack) => 
      t.meta?.title?.toLowerCase() === themeName.toLowerCase()
    );

    if (!targetTrack && !dryRun) {
      // Create a new track for this theme
      console.log(`    Creating new track: "${themeName}"`);
      
      // Determine archetype and template based on theme content
      const { archetype, template } = inferArchetypeAndTemplate(themeName, themeSessions);
      
      const [newTrack] = await db
        .insert(timelineNodes)
        .values({
          type: TimelineNodeType.Project,
          userId,
          parentId: primaryJourney.id,
          meta: {
            title: themeName,
            description: `Work related to ${themeName.toLowerCase()}`,
            workTrackArchetype: archetype,
            templateType: template,
            isWorkTrack: true,
            status: 'active',
          },
        })
        .returning();
      
      targetTrack = newTrack;
      existingTracks.push(newTrack); // Add to list for future reference
      console.log(`    ✅ Created track ID: ${targetTrack.id}`);
    } else if (targetTrack) {
      console.log(`    Using existing track: "${targetTrack.meta?.title}" (${targetTrack.id})`);
    }

    // Map sessions to this track
    if (targetTrack && !dryRun) {
      for (const session of themeSessions) {
        if (session.nodeId !== targetTrack.id) {
          await db
            .update(sessionMappings)
            .set({ nodeId: targetTrack.id })
            .where(eq(sessionMappings.id, session.id));
          console.log(`    📦 Mapped "${session.workflowName}" → "${targetTrack.meta?.title}"`);
        }
      }
    } else if (dryRun) {
      console.log(`    [DRY RUN] Would map ${themeSessions.length} sessions to "${themeName}"`);
    }
  }

  // Step 6: Clean up empty tracks
  if (!dryRun) {
    await cleanupEmptyTracks(db, userId, existingTracks);
  }
}

/**
 * Analyze sessions and group them by discovered themes
 */
function analyzeSessionThemes(sessions: Session[]): Map<string, Session[]> {
  const themes = new Map<string, Session[]>();
  
  // Theme detection patterns - these help identify the NATURE of work
  const themePatterns: Array<{
    name: string;
    patterns: RegExp[];
    apps?: string[];
  }> = [
    {
      name: 'Building the Product',
      patterns: [
        /mvp|product|build|develop|code|feature|implement|debug|fix|refactor|deploy/i,
        /cursor|vscode|terminal|github|desktop|app|api|frontend|backend/i,
        /requirements|spec|design|architecture/i,
      ],
    },
    {
      name: 'Growth & Research',
      patterns: [
        /research|analyze|strategy|growth|competitor|market|landing|review/i,
        /superme|ai growth|value prop|user research/i,
      ],
    },
    {
      name: 'Investor Relations',
      patterns: [
        /investor|fundraise|pitch|deck|update|vc|seed|series/i,
        /term sheet|cap table|due diligence/i,
      ],
    },
    {
      name: 'Marketing & Content',
      patterns: [
        /marketing|content|social|linkedin|twitter|brand|campaign|seo|blog/i,
      ],
    },
    {
      name: 'Operations',
      patterns: [
        /hire|hiring|recruit|team|onboard|hr|interview|candidate/i,
        /admin|operations|process|workflow/i,
      ],
    },
  ];

  // Analyze each session
  for (const session of sessions) {
    const content = `${session.workflowName || ''} ${session.highLevelSummary || ''}`.toLowerCase();
    
    let assignedTheme: string | null = null;
    let bestScore = 0;

    // Score against each theme pattern
    for (const theme of themePatterns) {
      let score = 0;
      for (const pattern of theme.patterns) {
        if (pattern.test(content)) {
          score += 1;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        assignedTheme = theme.name;
      }
    }

    // If no strong match, default based on session characteristics
    if (!assignedTheme || bestScore < 1) {
      // Check for common indicators
      if (content.includes('cursor') || content.includes('code') || content.includes('product')) {
        assignedTheme = 'Building the Product';
      } else if (content.includes('research') || content.includes('analyze')) {
        assignedTheme = 'Growth & Research';
      } else {
        assignedTheme = 'Building the Product'; // Default to product work
      }
    }

    // Add to theme group
    if (!themes.has(assignedTheme)) {
      themes.set(assignedTheme, []);
    }
    themes.get(assignedTheme)!.push(session);
  }

  return themes;
}

/**
 * Infer archetype and template based on theme and sessions
 */
function inferArchetypeAndTemplate(
  themeName: string, 
  sessions: Session[]
): { archetype: WorkTrackArchetype; template: TrackTemplateType } {
  const theme = themeName.toLowerCase();
  
  if (theme.includes('product') || theme.includes('build')) {
    return { 
      archetype: WorkTrackArchetype.BuildProduct, 
      template: TrackTemplateType.WorkflowApproach 
    };
  }
  if (theme.includes('research') || theme.includes('growth')) {
    return { 
      archetype: WorkTrackArchetype.GrowthMarketing, 
      template: TrackTemplateType.CaseStudyNarrative 
    };
  }
  if (theme.includes('investor') || theme.includes('fundrais')) {
    return { 
      archetype: WorkTrackArchetype.SalesFundraising, 
      template: TrackTemplateType.PipelineView 
    };
  }
  if (theme.includes('marketing') || theme.includes('content')) {
    return { 
      archetype: WorkTrackArchetype.GrowthMarketing, 
      template: TrackTemplateType.CaseStudyNarrative 
    };
  }
  if (theme.includes('operation') || theme.includes('hire')) {
    return { 
      archetype: WorkTrackArchetype.OperationsHiring, 
      template: TrackTemplateType.PipelineView 
    };
  }
  
  // Default
  return { 
    archetype: WorkTrackArchetype.BuildProduct, 
    template: TrackTemplateType.TimelineChronicle 
  };
}

/**
 * Remove empty tracks that no longer have any sessions
 */
async function cleanupEmptyTracks(db: any, userId: number, tracks: WorkTrack[]) {
  console.log('\n  🧹 Cleaning up empty tracks...');
  
  for (const track of tracks) {
    const [result] = await db
      .select({ count: count() })
      .from(sessionMappings)
      .where(eq(sessionMappings.nodeId, track.id));
    
    if (result?.count === 0) {
      console.log(`    🗑️ Deleting empty track: "${track.meta?.title}"`);
      await db
        .delete(timelineNodes)
        .where(eq(timelineNodes.id, track.id));
    }
  }
}

// Legacy processor - kept for reference
async function processUser(db: any, userId: number) {
  // Step 1: Get all work tracks with session counts
  const workTracks = await getWorkTracksWithSessionCounts(db, userId);
  console.log(`\n  📊 Found ${workTracks.length} work tracks`);
  
  if (workTracks.length === 0) {
    console.log('  No work tracks to process');
    return;
  }

  // Display current state
  console.log('\n  Current tracks:');
  for (const track of workTracks) {
    console.log(`    • "${track.meta?.title}" (${track.sessionCount || 0} sessions)`);
  }

  // Step 2: Get the parent journey
  const journeys = await db
    .select()
    .from(timelineNodes)
    .where(
      and(
        eq(timelineNodes.userId, userId),
        eq(timelineNodes.type, TimelineNodeType.Job)
      )
    );

  const primaryJourney = journeys[0];
  if (!primaryJourney) {
    console.log('  ⚠️ No primary journey found, skipping user');
    return;
  }
  console.log(`\n  Primary journey: ${primaryJourney.meta?.role || primaryJourney.meta?.title || 'Unknown'}`);

  // Step 3: Find similar tracks using keyword/semantic analysis
  const clusters = findTrackClusters(workTracks);
  
  if (clusters.length === 0) {
    console.log('\n  No track clusters found that need merging');
  } else {
    console.log(`\n  📦 Found ${clusters.length} track cluster(s) to merge:`);
    for (const cluster of clusters) {
      console.log(`\n    Primary: "${cluster.primaryTrack.meta?.title}" (${cluster.primaryTrack.sessionCount} sessions)`);
      console.log(`    Common keywords: ${cluster.keywords.join(', ')}`);
      console.log(`    Tracks to merge into it:`);
      for (const related of cluster.relatedTracks) {
        console.log(`      • "${related.meta?.title}" (${related.sessionCount} sessions)`);
      }
    }
  }

  // Step 4: Execute merges
  for (const cluster of clusters) {
    await mergeCluster(db, cluster, userId);
  }

  // Step 5: Re-map sessions that are on journey nodes (not work tracks)
  await remapJourneySessions(db, userId, workTracks, primaryJourney.id);
}

async function getWorkTracksWithSessionCounts(db: any, userId: number): Promise<WorkTrack[]> {
  // Get all project nodes (work tracks)
  const tracks = await db
    .select()
    .from(timelineNodes)
    .where(
      and(
        eq(timelineNodes.userId, userId),
        eq(timelineNodes.type, TimelineNodeType.Project)
      )
    )
    .orderBy(desc(timelineNodes.createdAt));

  // Get session counts for each track
  const tracksWithCounts: WorkTrack[] = [];
  
  for (const track of tracks) {
    const [result] = await db
      .select({ count: count() })
      .from(sessionMappings)
      .where(eq(sessionMappings.nodeId, track.id));
    
    tracksWithCounts.push({
      ...track,
      title: track.meta?.title || 'Untitled',
      sessionCount: result?.count || 0,
    });
  }

  // Sort by session count descending (most used tracks first)
  return tracksWithCounts.sort((a, b) => (b.sessionCount || 0) - (a.sessionCount || 0));
}

/**
 * Find clusters of related tracks using keyword extraction and similarity
 */
function findTrackClusters(tracks: WorkTrack[]): TrackCluster[] {
  const clusters: TrackCluster[] = [];
  const processedTrackIds = new Set<string>();

  // Extract keywords from each track
  const trackKeywords = new Map<string, string[]>();
  for (const track of tracks) {
    const keywords = extractKeywords(track.meta?.title || '', track.meta?.description || '');
    trackKeywords.set(track.id, keywords);
  }

  // Find similar tracks
  for (const track of tracks) {
    if (processedTrackIds.has(track.id)) continue;
    
    const keywords = trackKeywords.get(track.id) || [];
    const relatedTracks: WorkTrack[] = [];
    const commonKeywords = new Set<string>(keywords);

    // Find other tracks with overlapping keywords
    for (const otherTrack of tracks) {
      if (otherTrack.id === track.id || processedTrackIds.has(otherTrack.id)) continue;

      const otherKeywords = trackKeywords.get(otherTrack.id) || [];
      const similarity = calculateKeywordSimilarity(keywords, otherKeywords);

      if (similarity >= SIMILARITY_THRESHOLD) {
        relatedTracks.push(otherTrack);
        processedTrackIds.add(otherTrack.id);
        
        // Find common keywords
        for (const kw of otherKeywords) {
          if (keywords.some(k => k.includes(kw) || kw.includes(k))) {
            commonKeywords.add(kw);
          }
        }
      }
    }

    // Only create a cluster if there are related tracks to merge
    if (relatedTracks.length > 0) {
      processedTrackIds.add(track.id);
      
      // The primary track should be the one with most sessions
      const allTracks = [track, ...relatedTracks];
      allTracks.sort((a, b) => (b.sessionCount || 0) - (a.sessionCount || 0));
      
      clusters.push({
        primaryTrack: allTracks[0],
        relatedTracks: allTracks.slice(1),
        keywords: Array.from(commonKeywords).slice(0, 5),
      });
    }
  }

  return clusters;
}

/**
 * Extract meaningful keywords from track title and description
 */
function extractKeywords(title: string, description: string): string[] {
  const combined = `${title} ${description}`.toLowerCase();
  
  // Remove common words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'work', 'working', 'session', 'sessions', 'track', 'core', 'general'
  ]);

  // Extract words
  const words = combined
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Return unique keywords
  return [...new Set(words)];
}

/**
 * Calculate similarity between two keyword sets using Jaccard similarity
 */
function calculateKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  // Check for partial matches (e.g., "product" matches "products")
  let matches = 0;
  for (const kw1 of keywords1) {
    for (const kw2 of keywords2) {
      if (kw1 === kw2 || kw1.includes(kw2) || kw2.includes(kw1)) {
        matches++;
        break;
      }
    }
  }

  // Jaccard-like similarity
  const union = new Set([...keywords1, ...keywords2]).size;
  return matches / Math.max(keywords1.length, keywords2.length);
}

/**
 * Merge a cluster of tracks into the primary track
 */
async function mergeCluster(db: any, cluster: TrackCluster, userId: number) {
  const primaryTrack = cluster.primaryTrack;
  
  console.log(`\n  🔄 Merging into "${primaryTrack.meta?.title}"...`);

  for (const relatedTrack of cluster.relatedTracks) {
    console.log(`    📦 Moving sessions from "${relatedTrack.meta?.title}"...`);

    // Update all sessions from this track to point to the primary track
    await db
      .update(sessionMappings)
      .set({ nodeId: primaryTrack.id })
      .where(eq(sessionMappings.nodeId, relatedTrack.id));

    // Delete the now-empty track
    await db
      .delete(timelineNodes)
      .where(eq(timelineNodes.id, relatedTrack.id));

    console.log(`      ✅ Merged and deleted "${relatedTrack.meta?.title}"`);
  }

  // Update the primary track's description to reflect the merge
  const mergedTitles = cluster.relatedTracks.map(t => t.meta?.title).join(', ');
  const currentDesc = primaryTrack.meta?.description || '';
  const newDesc = currentDesc 
    ? `${currentDesc}\n\nIncludes work from: ${mergedTitles}`
    : `Includes work from: ${mergedTitles}`;

  await db
    .update(timelineNodes)
    .set({ 
      meta: { 
        ...primaryTrack.meta, 
        description: newDesc,
        mergedFrom: cluster.relatedTracks.map(t => t.meta?.title),
      } 
    })
    .where(eq(timelineNodes.id, primaryTrack.id));

  console.log(`    ✅ Updated primary track description`);
}

/**
 * Re-map sessions that are incorrectly mapped to journey nodes
 */
async function remapJourneySessions(
  db: any, 
  userId: number, 
  workTracks: WorkTrack[],
  journeyId: string
) {
  // Get all sessions for this user
  const sessions = await db
    .select({
      id: sessionMappings.id,
      nodeId: sessionMappings.nodeId,
      workflowName: sessionMappings.workflowName,
      highLevelSummary: sessionMappings.highLevelSummary,
    })
    .from(sessionMappings)
    .where(eq(sessionMappings.userId, userId));

  console.log(`\n  🔍 Checking ${sessions.length} sessions for misplaced mappings...`);

  let remappedCount = 0;

  for (const session of sessions) {
    if (!session.nodeId) continue;

    // Check if this session is mapped to a journey node (not a work track)
    const [node] = await db
      .select()
      .from(timelineNodes)
      .where(eq(timelineNodes.id, session.nodeId))
      .limit(1);

    if (!node) continue;

    const isJourneyNode = [
      TimelineNodeType.Job,
      TimelineNodeType.Education,
      TimelineNodeType.CareerTransition
    ].includes(node.type);

    if (isJourneyNode) {
      // Find the best matching work track based on session content
      const bestTrack = findBestMatchingTrack(session, workTracks);
      
      if (bestTrack) {
        await db
          .update(sessionMappings)
          .set({ nodeId: bestTrack.id })
          .where(eq(sessionMappings.id, session.id));
        
        console.log(`    📦 Moved "${session.workflowName}" → "${bestTrack.meta?.title}"`);
        remappedCount++;
      }
    }
  }

  if (remappedCount > 0) {
    console.log(`    ✅ Remapped ${remappedCount} sessions from journey to work tracks`);
  } else {
    console.log(`    ✅ No sessions needed remapping`);
  }
}

/**
 * Find the best matching work track for a session based on content similarity
 */
function findBestMatchingTrack(session: Session, workTracks: WorkTrack[]): WorkTrack | null {
  if (workTracks.length === 0) return null;

  const sessionKeywords = extractKeywords(
    session.workflowName || '', 
    session.highLevelSummary || ''
  );

  let bestMatch: WorkTrack | null = null;
  let bestScore = 0;

  for (const track of workTracks) {
    const trackKeywords = extractKeywords(
      track.meta?.title || '', 
      track.meta?.description || ''
    );

    const similarity = calculateKeywordSimilarity(sessionKeywords, trackKeywords);
    
    // Also consider session count (prefer tracks with more sessions)
    const popularityBonus = Math.min((track.sessionCount || 0) / 10, 0.2);
    const score = similarity + popularityBonus;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = track;
    }
  }

  // Only return a match if we have reasonable confidence
  if (bestScore >= 0.2) {
    return bestMatch;
  }

  // Default to the most used track if no good match
  return workTracks[0];
}

// Run the script
main().catch(console.error);

