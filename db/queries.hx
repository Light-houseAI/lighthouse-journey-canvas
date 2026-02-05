// ============================================================================
// Helix DB Queries for Lighthouse Journey Timeline
// Graph RAG Workflow Analysis
// ============================================================================

// ============================================================================
// USER OPERATIONS
// ============================================================================

QUERY UpsertUser(external_id: String, metadata: String) =>
    existing <- N<User>::WHERE(_::{external_id}::EQ(external_id))
    user <- existing::UpsertN({external_id: external_id, metadata: metadata})
    RETURN user

QUERY GetUserByExternalId(external_id: String) =>
    user <- N<User>::WHERE(_::{external_id}::EQ(external_id))
    RETURN user

// ============================================================================
// TIMELINE NODE OPERATIONS
// ============================================================================

QUERY UpsertTimelineNode(external_id: String, user_key: String, node_type: String, title: String, metadata: String) =>
    existing <- N<TimelineNode>::WHERE(_::{external_id}::EQ(external_id))
    node <- existing::UpsertN({external_id: external_id, node_type: node_type, title: title, metadata: metadata})
    user <- N<User>::WHERE(_::{external_id}::EQ(user_key))
    AddE<UserOwnsNode>::From(user)::To(node)
    RETURN node

QUERY GetTimelineNodesByUser(user_key: String) =>
    nodes <- N<User>::WHERE(_::{external_id}::EQ(user_key))::Out<UserOwnsNode>
    RETURN nodes

QUERY GetTimelineNodeByExternalId(external_id: String) =>
    node <- N<TimelineNode>::WHERE(_::{external_id}::EQ(external_id))
    RETURN node

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

QUERY UpsertSession(external_id: String, user_key: String, node_key: String, start_time: Date, end_time: Date, duration_seconds: I64, screenshot_count: I64, workflow_primary: String, workflow_secondary: String, workflow_confidence: F64, metadata: String) =>
    existing <- N<Session>::WHERE(_::{external_id}::EQ(external_id))
    session <- existing::UpsertN({external_id: external_id, start_time: start_time, end_time: end_time, duration_seconds: duration_seconds, screenshot_count: screenshot_count, workflow_primary: workflow_primary, workflow_secondary: workflow_secondary, workflow_confidence: workflow_confidence, metadata: metadata})
    user <- N<User>::WHERE(_::{external_id}::EQ(user_key))
    AddE<UserOwnsSession>::From(user)::To(session)
    RETURN session

QUERY LinkSessionToNode(session_external_id: String, node_external_id: String) =>
    session <- N<Session>::WHERE(_::{external_id}::EQ(session_external_id))
    node <- N<TimelineNode>::WHERE(_::{external_id}::EQ(node_external_id))
    AddE<SessionInNode>::From(session)::To(node)
    RETURN "Success"

QUERY GetSessionsByUser(user_key: String, start: I64, end_range: I64) =>
    sessions <- N<User>::WHERE(_::{external_id}::EQ(user_key))::Out<UserOwnsSession>::RANGE(start, end_range)
    RETURN sessions

QUERY GetSessionsByNode(node_key: String) =>
    sessions <- N<TimelineNode>::WHERE(_::{external_id}::EQ(node_key))::In<SessionInNode>
    RETURN sessions

QUERY GetRelatedSessions(session_external_id: String) =>
    sessions <- N<Session>::WHERE(_::{external_id}::EQ(session_external_id))::Out<SessionInNode>::In<SessionInNode>
    RETURN sessions

// Get all sessions excluding a user (for peer analysis)
QUERY GetAllSessionsExcludingUser(exclude_user_key: String, start: I64, end_range: I64) =>
    sessions <- N<Session>::RANGE(start, end_range)
    RETURN sessions

// Aggregate sessions by workflow (returns full session data grouped by workflow_primary)
QUERY AggregateSessionsByWorkflow(user_key: String) =>
    sessions <- N<User>::WHERE(_::{external_id}::EQ(user_key))::Out<UserOwnsSession>
    RETURN sessions::AGGREGATE_BY(workflow_primary)

// ============================================================================
// ACTIVITY OPERATIONS
// ============================================================================

QUERY UpsertActivity(session_key: String, screenshot_external_id: String, workflow_tag: String, timestamp: Date, summary: String, confidence: F64, metadata: String) =>
    existing <- N<Activity>::WHERE(_::{screenshot_external_id}::EQ(screenshot_external_id))
    activity <- existing::UpsertN({screenshot_external_id: screenshot_external_id, workflow_tag: workflow_tag, timestamp: timestamp, summary: summary, confidence: confidence, metadata: metadata})
    RETURN activity

QUERY LinkActivityToSession(screenshot_external_id: String, session_external_id: String) =>
    activity <- N<Activity>::WHERE(_::{screenshot_external_id}::EQ(screenshot_external_id))
    session <- N<Session>::WHERE(_::{external_id}::EQ(session_external_id))
    AddE<ActivityInSession>::From(activity)::To(session)
    RETURN "Success"

QUERY GetActivitiesBySession(session_key: String) =>
    activities <- N<Session>::WHERE(_::{external_id}::EQ(session_key))::In<ActivityInSession>
    RETURN activities

// ============================================================================
// ENTITY OPERATIONS
// ============================================================================

QUERY UpsertEntity(name: String, entity_type: String, metadata: String) =>
    existing <- N<Entity>({name: name})
    entity <- existing::UpsertN({name: name, entity_type: entity_type, metadata: metadata})
    RETURN entity

QUERY LinkActivityToEntity(screenshot_external_id: String, entity_name: String, context: String) =>
    activity <- N<Activity>::WHERE(_::{screenshot_external_id}::EQ(screenshot_external_id))
    entity <- N<Entity>({name: entity_name})
    existing <- E<ActivityMentionsEntity>
    edge <- existing::UpsertE({context: context})::From(activity)::To(entity)
    RETURN edge

QUERY GetEntityOccurrences(entity_name: String) =>
    activities <- N<Entity>({name: entity_name})::In<ActivityMentionsEntity>
    RETURN activities

// ============================================================================
// CONCEPT OPERATIONS
// ============================================================================

QUERY UpsertConcept(name: String, category: String, relevance_score: F64) =>
    existing <- N<Concept>({name: name})
    concept <- existing::UpsertN({name: name, category: category, relevance_score: relevance_score})
    RETURN concept

QUERY LinkActivityToConcept(screenshot_external_id: String, concept_name: String, relevance: F64) =>
    activity <- N<Activity>::WHERE(_::{screenshot_external_id}::EQ(screenshot_external_id))
    concept <- N<Concept>({name: concept_name})
    existing <- E<ActivityRelatedToConcept>
    edge <- existing::UpsertE({relevance: relevance})::From(activity)::To(concept)
    RETURN edge

QUERY GetConceptsByCategory(category: String) =>
    concepts <- N<Concept>::WHERE(_::{category}::EQ(category))
    RETURN concepts

// ============================================================================
// CROSS-SESSION CONTEXT (Graph Traversals)
// ============================================================================

// Get entities via: User -> Sessions -> Activities -> Entities
QUERY GetCrossSessionContext(user_key: String) =>
    entities <- N<User>::WHERE(_::{external_id}::EQ(user_key))::Out<UserOwnsSession>::In<ActivityInSession>::Out<ActivityMentionsEntity>
    RETURN entities

// Get concepts via: User -> Sessions -> Activities -> Concepts
QUERY GetCrossSessionConcepts(user_key: String) =>
    concepts <- N<User>::WHERE(_::{external_id}::EQ(user_key))::Out<UserOwnsSession>::In<ActivityInSession>::Out<ActivityRelatedToConcept>
    RETURN concepts

// ============================================================================
// WORKFLOW PATTERN OPERATIONS
// ============================================================================

QUERY UpsertWorkflowPattern(user_id: String, intent_category: String, occurrence_count: I64, metadata: String) =>
    existing <- N<WorkflowPattern>::WHERE(_::{intent_category}::EQ(intent_category))
    pattern <- existing::UpsertN({intent_category: intent_category, occurrence_count: occurrence_count, metadata: metadata})
    user <- N<User>::WHERE(_::{external_id}::EQ(user_id))
    AddE<UserHasPattern>::From(user)::To(pattern)
    RETURN pattern

QUERY GetWorkflowPatterns(user_id: String) =>
    patterns <- N<User>::WHERE(_::{external_id}::EQ(user_id))::Out<UserHasPattern>
    RETURN patterns

QUERY GetPatternsByIntent(intent_category: String) =>
    patterns <- N<WorkflowPattern>::WHERE(_::{intent_category}::EQ(intent_category))
    RETURN patterns

// ============================================================================
// BLOCK OPERATIONS
// ============================================================================

QUERY UpsertBlock(user_id: String, canonical_slug: String, intent_label: String, primary_tool: String, occurrence_count: I64, metadata: String) =>
    existing <- N<Block>::WHERE(_::{canonical_slug}::EQ(canonical_slug))
    block <- existing::UpsertN({canonical_slug: canonical_slug, intent_label: intent_label, primary_tool: primary_tool, occurrence_count: occurrence_count, metadata: metadata})
    user <- N<User>::WHERE(_::{external_id}::EQ(user_id))
    AddE<UserHasBlock>::From(user)::To(block)
    RETURN block

QUERY GetBlocksByUser(user_id: String) =>
    blocks <- N<User>::WHERE(_::{external_id}::EQ(user_id))::Out<UserHasBlock>
    RETURN blocks

// ============================================================================
// TOOL OPERATIONS
// ============================================================================

QUERY UpsertTool(canonical_name: String, category: String, metadata: String) =>
    existing <- N<Tool>({canonical_name: canonical_name})
    tool <- existing::UpsertN({canonical_name: canonical_name, category: category, metadata: metadata})
    RETURN tool

// ============================================================================
// STATISTICS & BACKFILL
// ============================================================================

QUERY GetActivityCount() =>
    count <- N<Activity>::COUNT
    RETURN count

QUERY GetAllActivitiesForBackfill(start: I64, end_range: I64) =>
    activities <- N<Activity>::RANGE(start, end_range)
    RETURN activities

QUERY GetAllSessionsForBackfill(start: I64, end_range: I64) =>
    sessions <- N<Session>::RANGE(start, end_range)
    RETURN sessions

// ============================================================================
// HEALTH CHECK
// ============================================================================

QUERY HealthCheck() =>
    RETURN "OK"
