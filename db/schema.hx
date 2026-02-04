// ============================================================================
// Helix DB Schema for Lighthouse Journey Timeline
// Graph RAG Workflow Analysis
// ============================================================================

// ============================================================================
// VERTEX NODES
// ============================================================================

N::User {
  UNIQUE INDEX external_id: String,
  created_at: String,
  metadata: String
}

N::TimelineNode {
  UNIQUE INDEX external_id: String,
  INDEX user_key: String,
  node_type: String,
  title: String,
  created_at: String,
  metadata: String
}

N::Session {
  UNIQUE INDEX external_id: String,
  INDEX user_key: String,
  INDEX node_key: String,
  start_time: String,
  end_time: String,
  duration_seconds: U32,
  screenshot_count: U32,
  workflow_primary: String,
  workflow_secondary: String,
  workflow_confidence: F32,
  metadata: String
}

N::Activity {
  INDEX session_key: String,
  UNIQUE INDEX screenshot_external_id: String,
  INDEX workflow_tag: String,
  timestamp: String,
  summary: String,
  confidence: F32,
  metadata: String
}

N::Entity {
  UNIQUE INDEX name: String,
  INDEX entity_type: String,
  frequency: U32,
  metadata: String
}

N::Concept {
  UNIQUE INDEX name: String,
  INDEX category: String,
  relevance_score: F32
}

N::WorkflowPattern {
  INDEX user_id: String,
  INDEX intent_category: String,
  occurrence_count: U32,
  last_seen_at: String,
  metadata: String
}

N::Block {
  INDEX user_id: String,
  UNIQUE INDEX canonical_slug: String,
  INDEX intent_label: String,
  INDEX primary_tool: String,
  occurrence_count: U32,
  metadata: String
}

N::Step {
  INDEX session_id: String,
  INDEX action_type: String,
  order_in_block: U32,
  timestamp: String,
  metadata: String
}

N::Tool {
  UNIQUE INDEX canonical_name: String,
  INDEX category: String,
  metadata: String
}

// ============================================================================
// EDGE RELATIONSHIPS
// ============================================================================

E::BelongsTo {
  From: Session,
  To: TimelineNode,
  Properties: {
    created_at: String
  }
}

E::Follows {
  From: Session,
  To: Session,
  Properties: {
    gap_seconds: U32
  }
}

E::Uses {
  From: Activity,
  To: Entity,
  Properties: {
    context: String
  }
}

E::RelatesTo {
  From: Activity,
  To: Concept,
  Properties: {
    relevance: F32
  }
}

E::Contains {
  From: TimelineNode,
  To: Session,
  Properties: {}
}

E::SwitchesTo {
  From: Activity,
  To: Activity,
  Properties: {
    switch_type: String
  }
}

E::ActivityInSession {
  From: Activity,
  To: Session,
  Properties: {}
}

E::DependsOn {
  From: TimelineNode,
  To: TimelineNode,
  Properties: {
    dependency_type: String
  }
}

E::PatternContainsBlock {
  From: WorkflowPattern,
  To: Block,
  Properties: {
    order: U32
  }
}

E::NextBlock {
  From: Block,
  To: Block,
  Properties: {
    INDEX frequency: U32,
    probability: F32
  }
}

E::BlockContainsStep {
  From: Block,
  To: Step,
  Properties: {
    order: U32
  }
}

E::NextStep {
  From: Step,
  To: Step,
  Properties: {
    gap_ms: U32
  }
}

E::BlockUsesTool {
  From: Block,
  To: Tool,
  Properties: {}
}

E::BlockRelatesConcept {
  From: Block,
  To: Concept,
  Properties: {
    relevance: F32
  }
}

E::PatternOccursInSession {
  From: WorkflowPattern,
  To: Session,
  Properties: {
    occurred_at: String
  }
}

E::StepEvidencedBy {
  From: Step,
  To: Activity,
  Properties: {
    screenshot_id: String
  }
}

// ============================================================================
// VECTOR EMBEDDINGS
// ============================================================================

V::ActivityEmbedding {
  activity_id: String,
  summary: String
}

V::ConceptEmbedding {
  concept_id: String,
  description: String
}

V::SessionEmbedding {
  session_id: String,
  summary: String
}
