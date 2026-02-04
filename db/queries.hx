// ============================================================================
// Helix DB Queries for Lighthouse Journey Timeline
// Graph RAG Workflow Analysis
// ============================================================================

// ============================================================================
// USER OPERATIONS
// ============================================================================

QUERY UpsertUser(external_id: String, created_at: String, metadata: String) =>
    existing <- N<User>::WHERE(_::{external_id}::EQ(external_id))
    user <- existing::UpsertN({
        external_id: external_id,
        created_at: created_at,
        metadata: metadata
    })
    RETURN user

QUERY GetUserByExternalId(external_id: String) =>
    user <- N<User>({external_id: external_id})
    RETURN user

QUERY GetUserByKey(user_key: String) =>
    user <- N<User>::WHERE(_::{external_id}::EQ(user_key))
    RETURN user

// ============================================================================
// TIMELINE NODE OPERATIONS
// ============================================================================

QUERY UpsertTimelineNode(
    external_id: String,
    user_key: String,
    node_type: String,
    title: String,
    created_at: String,
    metadata: String
) =>
    existing <- N<TimelineNode>::WHERE(_::{external_id}::EQ(external_id))
    node <- existing::UpsertN({
        external_id: external_id,
        user_key: user_key,
        node_type: node_type,
        title: title,
        created_at: created_at,
        metadata: metadata
    })
    RETURN node

QUERY GetTimelineNodeByExternalId(external_id: String) =>
    node <- N<TimelineNode>({external_id: external_id})
    RETURN node

QUERY GetTimelineNodesByUser(user_key: String) =>
    nodes <- N<TimelineNode>::WHERE(_::{user_key}::EQ(user_key))
    RETURN nodes

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

QUERY UpsertSession(
    external_id: String,
    user_key: String,
    node_key: String,
    start_time: String,
    end_time: String,
    duration_seconds: U32,
    screenshot_count: U32,
    workflow_primary: String,
    workflow_secondary: String,
    workflow_confidence: F32,
    metadata: String
) =>
    existing <- N<Session>::WHERE(_::{external_id}::EQ(external_id))
    session <- existing::UpsertN({
        external_id: external_id,
        user_key: user_key,
        node_key: node_key,
        start_time: start_time,
        end_time: end_time,
        duration_seconds: duration_seconds,
        screenshot_count: screenshot_count,
        workflow_primary: workflow_primary,
        workflow_secondary: workflow_secondary,
        workflow_confidence: workflow_confidence,
        metadata: metadata
    })
    RETURN session

QUERY GetSessionByExternalId(external_id: String) =>
    session <- N<Session>({external_id: external_id})
    RETURN session

QUERY GetSessionsByUser(user_key: String, start: U32, end_range: U32) =>
    sessions <- N<Session>::WHERE(_::{user_key}::EQ(user_key))::ORDER<Desc>(_::{start_time})::RANGE(start, end_range)
    RETURN sessions

QUERY GetSessionsByNode(node_key: String) =>
    sessions <- N<Session>::WHERE(_::{node_key}::EQ(node_key))
    RETURN sessions

// Link session to timeline node (edge creation)
QUERY LinkSessionToNode(session_external_id: String, node_external_id: String, created_at: String) =>
    session <- N<Session>({external_id: session_external_id})
    node <- N<TimelineNode>({external_id: node_external_id})
    edge <- AddE<BelongsTo>({created_at: created_at})::From(session)::To(node)
    RETURN edge

// Link sessions in sequence
QUERY LinkSessionSequence(from_external_id: String, to_external_id: String, gap_seconds: U32) =>
    from_session <- N<Session>({external_id: from_external_id})
    to_session <- N<Session>({external_id: to_external_id})
    edge <- AddE<Follows>({gap_seconds: gap_seconds})::From(from_session)::To(to_session)
    RETURN edge

// ============================================================================
// ACTIVITY OPERATIONS
// ============================================================================

QUERY UpsertActivity(
    session_key: String,
    screenshot_external_id: String,
    workflow_tag: String,
    timestamp: String,
    summary: String,
    confidence: F32,
    metadata: String
) =>
    existing <- N<Activity>::WHERE(_::{screenshot_external_id}::EQ(screenshot_external_id))
    activity <- existing::UpsertN({
        session_key: session_key,
        screenshot_external_id: screenshot_external_id,
        workflow_tag: workflow_tag,
        timestamp: timestamp,
        summary: summary,
        confidence: confidence,
        metadata: metadata
    })
    RETURN activity

QUERY GetActivityByScreenshotId(screenshot_external_id: String) =>
    activity <- N<Activity>({screenshot_external_id: screenshot_external_id})
    RETURN activity

QUERY GetActivitiesBySession(session_key: String) =>
    activities <- N<Activity>::WHERE(_::{session_key}::EQ(session_key))
    RETURN activities

QUERY GetActivitiesByWorkflowTag(workflow_tag: String) =>
    activities <- N<Activity>::WHERE(_::{workflow_tag}::EQ(workflow_tag))
    RETURN activities

// ============================================================================
// ENTITY OPERATIONS
// ============================================================================

QUERY UpsertEntity(name: String, entity_type: String, metadata: String) =>
    existing <- N<Entity>::WHERE(_::{name}::EQ(name))
    entity <- existing::UpsertN({
        name: name,
        entity_type: entity_type,
        frequency: 1,
        metadata: metadata
    })
    RETURN entity

QUERY GetEntityByName(name: String) =>
    entity <- N<Entity>({name: name})
    RETURN entity

QUERY GetEntitiesByType(entity_type: String) =>
    entities <- N<Entity>::WHERE(_::{entity_type}::EQ(entity_type))
    RETURN entities

// Link activity to entity
QUERY LinkActivityToEntity(screenshot_external_id: String, entity_name: String, context: String) =>
    activity <- N<Activity>({screenshot_external_id: screenshot_external_id})
    entity <- N<Entity>({name: entity_name})
    edge <- AddE<Uses>({context: context})::From(activity)::To(entity)
    RETURN edge

// ============================================================================
// CONCEPT OPERATIONS
// ============================================================================

QUERY UpsertConcept(name: String, category: String, relevance_score: F32) =>
    existing <- N<Concept>::WHERE(_::{name}::EQ(name))
    concept <- existing::UpsertN({
        name: name,
        category: category,
        relevance_score: relevance_score
    })
    RETURN concept

QUERY GetConceptByName(name: String) =>
    concept <- N<Concept>({name: name})
    RETURN concept

QUERY GetConceptsByCategory(category: String) =>
    concepts <- N<Concept>::WHERE(_::{category}::EQ(category))
    RETURN concepts

// Link activity to concept
QUERY LinkActivityToConcept(screenshot_external_id: String, concept_name: String, relevance: F32) =>
    activity <- N<Activity>({screenshot_external_id: screenshot_external_id})
    concept <- N<Concept>({name: concept_name})
    edge <- AddE<RelatesTo>({relevance: relevance})::From(activity)::To(concept)
    RETURN edge

// ============================================================================
// GRAPH TRAVERSALS
// ============================================================================

// Get sessions related to a session (via shared timeline node)
QUERY GetRelatedSessions(session_external_id: String) =>
    session <- N<Session>({external_id: session_external_id})
    node <- session::Out<BelongsTo>
    related <- node::In<BelongsTo>::RANGE(0, 50)
    RETURN related

// Get cross-session context for user
QUERY GetCrossSessionContext(user_key: String) =>
    sessions <- N<Session>::WHERE(_::{user_key}::EQ(user_key))
    activities <- sessions::In<ActivityInSession>
    entities <- activities::Out<Uses>
    RETURN entities

// Get entity occurrences across sessions
QUERY GetEntityOccurrences(entity_name: String) =>
    entity <- N<Entity>({name: entity_name})
    activities <- entity::In<Uses>
    sessions <- activities::Out<ActivityInSession>
    RETURN sessions

// Get concept connections across sessions
QUERY GetConceptConnections(concept_name: String) =>
    concept <- N<Concept>({name: concept_name})
    activities <- concept::In<RelatesTo>
    sessions <- activities::Out<ActivityInSession>
    RETURN sessions

// ============================================================================
// WORKFLOW PATTERN OPERATIONS
// ============================================================================

QUERY UpsertWorkflowPattern(
    user_id: String,
    intent_category: String,
    occurrence_count: U32,
    last_seen_at: String,
    metadata: String
) =>
    existing <- N<WorkflowPattern>::WHERE(_::{user_id}::EQ(user_id))::WHERE(_::{intent_category}::EQ(intent_category))
    pattern <- existing::UpsertN({
        user_id: user_id,
        intent_category: intent_category,
        occurrence_count: occurrence_count,
        last_seen_at: last_seen_at,
        metadata: metadata
    })
    RETURN pattern

QUERY GetWorkflowPatterns(user_id: String) =>
    patterns <- N<WorkflowPattern>::WHERE(_::{user_id}::EQ(user_id))
    RETURN patterns

QUERY GetPatternsByIntent(intent_category: String) =>
    patterns <- N<WorkflowPattern>::WHERE(_::{intent_category}::EQ(intent_category))
    RETURN patterns

// ============================================================================
// BLOCK OPERATIONS
// ============================================================================

QUERY UpsertBlock(
    user_id: String,
    canonical_slug: String,
    intent_label: String,
    primary_tool: String,
    occurrence_count: U32,
    metadata: String
) =>
    existing <- N<Block>::WHERE(_::{canonical_slug}::EQ(canonical_slug))
    block <- existing::UpsertN({
        user_id: user_id,
        canonical_slug: canonical_slug,
        intent_label: intent_label,
        primary_tool: primary_tool,
        occurrence_count: occurrence_count,
        metadata: metadata
    })
    RETURN block

QUERY GetBlockBySlug(canonical_slug: String) =>
    block <- N<Block>({canonical_slug: canonical_slug})
    RETURN block

QUERY GetBlocksByUser(user_id: String) =>
    blocks <- N<Block>::WHERE(_::{user_id}::EQ(user_id))
    RETURN blocks

QUERY GetBlocksByTool(primary_tool: String) =>
    blocks <- N<Block>::WHERE(_::{primary_tool}::EQ(primary_tool))
    RETURN blocks

// Link blocks in sequence
QUERY LinkBlockSequence(from_slug: String, to_slug: String, frequency: U32, probability: F32) =>
    from_block <- N<Block>({canonical_slug: from_slug})
    to_block <- N<Block>({canonical_slug: to_slug})
    edge <- AddE<NextBlock>({frequency: frequency, probability: probability})::From(from_block)::To(to_block)
    RETURN edge

// ============================================================================
// STEP OPERATIONS
// ============================================================================

QUERY CreateStep(
    session_id: String,
    action_type: String,
    order_in_block: U32,
    timestamp: String,
    metadata: String
) =>
    step <- AddN<Step>({
        session_id: session_id,
        action_type: action_type,
        order_in_block: order_in_block,
        timestamp: timestamp,
        metadata: metadata
    })
    RETURN step

QUERY GetStepsBySession(session_id: String) =>
    steps <- N<Step>::WHERE(_::{session_id}::EQ(session_id))
    RETURN steps

QUERY GetStepsByActionType(action_type: String) =>
    steps <- N<Step>::WHERE(_::{action_type}::EQ(action_type))
    RETURN steps

// ============================================================================
// TOOL OPERATIONS
// ============================================================================

QUERY UpsertTool(canonical_name: String, category: String, metadata: String) =>
    existing <- N<Tool>::WHERE(_::{canonical_name}::EQ(canonical_name))
    tool <- existing::UpsertN({
        canonical_name: canonical_name,
        category: category,
        metadata: metadata
    })
    RETURN tool

QUERY GetToolByName(canonical_name: String) =>
    tool <- N<Tool>({canonical_name: canonical_name})
    RETURN tool

QUERY GetToolsByCategory(category: String) =>
    tools <- N<Tool>::WHERE(_::{category}::EQ(category))
    RETURN tools

// Link block to tool
QUERY LinkBlockToTool(block_slug: String, tool_name: String) =>
    block <- N<Block>({canonical_slug: block_slug})
    tool <- N<Tool>({canonical_name: tool_name})
    edge <- AddE<BlockUsesTool>()::From(block)::To(tool)
    RETURN edge

// ============================================================================
// VECTOR SEARCH
// ============================================================================

QUERY SearchSimilarActivities(query_embedding: [F64], limit: I64) =>
    results <- SearchV<ActivityEmbedding>(query_embedding, limit)
    RETURN results

QUERY SearchSimilarConcepts(query_embedding: [F64], limit: I64) =>
    results <- SearchV<ConceptEmbedding>(query_embedding, limit)
    RETURN results

QUERY SearchSimilarSessions(query_embedding: [F64], limit: I64) =>
    results <- SearchV<SessionEmbedding>(query_embedding, limit)
    RETURN results

// ============================================================================
// STATISTICS
// ============================================================================

QUERY GetUserCount() =>
    count <- N<User>::COUNT
    RETURN count

QUERY GetSessionCount() =>
    count <- N<Session>::COUNT
    RETURN count

// ============================================================================
// HEALTH CHECK (simple query for connection testing)
// ============================================================================

QUERY HealthCheck(dummy: String) =>
    users <- N<User>::RANGE(0, 1)
    RETURN users
