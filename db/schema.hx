// ============================================================================
// Helix DB Schema for Lighthouse Journey Timeline
// Graph RAG Workflow Analysis
// ============================================================================

// ============================================================================
// VERTEX NODES
// ============================================================================

// User node
N::User {
    external_id: String,
    metadata: String
}

// Timeline node
N::TimelineNode {
    external_id: String,
    node_type: String,
    title: String,
    metadata: String
}

// Session node
N::Session {
    external_id: String,
    start_time: Date,
    end_time: Date,
    duration_seconds: I64,
    screenshot_count: I64,
    workflow_primary: String,
    workflow_secondary: String,
    workflow_confidence: F64,
    metadata: String
}

// Activity node
N::Activity {
    screenshot_external_id: String,
    workflow_tag: String,
    timestamp: Date,
    summary: String,
    confidence: F64,
    metadata: String
}

// Entity node
N::Entity {
    INDEX name: String,
    entity_type: String,
    metadata: String
}

// Concept node
N::Concept {
    INDEX name: String,
    category: String,
    relevance_score: F64
}

// WorkflowPattern node
N::WorkflowPattern {
    intent_category: String,
    occurrence_count: I64,
    metadata: String
}

// Block node
N::Block {
    canonical_slug: String,
    intent_label: String,
    primary_tool: String,
    occurrence_count: I64,
    metadata: String
}

// Tool node
N::Tool {
    INDEX canonical_name: String,
    category: String,
    metadata: String
}

// ============================================================================
// EDGE RELATIONSHIPS
// ============================================================================

E::UserOwnsNode {
    From: User,
    To: TimelineNode
}

E::UserOwnsSession {
    From: User,
    To: Session
}

E::SessionInNode {
    From: Session,
    To: TimelineNode
}

E::ActivityInSession {
    From: Activity,
    To: Session
}

E::ActivityMentionsEntity {
    From: Activity,
    To: Entity,
    Properties: {
        context: String
    }
}

E::ActivityRelatedToConcept {
    From: Activity,
    To: Concept,
    Properties: {
        relevance: F64
    }
}

E::UserHasPattern {
    From: User,
    To: WorkflowPattern
}

E::UserHasBlock {
    From: User,
    To: Block
}
