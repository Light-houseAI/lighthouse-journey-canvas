
// DEFAULT CODE
// use helix_db::helix_engine::traversal_core::config::Config;

// pub fn config() -> Option<Config> {
//     None
// }



use bumpalo::Bump;
use heed3::RoTxn;
use helix_macros::{handler, tool_call, mcp_handler, migration};
use helix_db::{
    helix_engine::{
        reranker::{
            RerankAdapter,
            fusion::{RRFReranker, MMRReranker, DistanceMethod},
        },
        traversal_core::{
            config::{Config, GraphConfig, VectorConfig},
            ops::{
                bm25::search_bm25::SearchBM25Adapter,
                g::G,
                in_::{in_::InAdapter, in_e::InEdgesAdapter, to_n::ToNAdapter, to_v::ToVAdapter},
                out::{
                    from_n::FromNAdapter, from_v::FromVAdapter, out::OutAdapter, out_e::OutEdgesAdapter,
                },
                source::{
                    add_e::AddEAdapter,
                    add_n::AddNAdapter,
                    e_from_id::EFromIdAdapter,
                    e_from_type::EFromTypeAdapter,
                    n_from_id::NFromIdAdapter,
                    n_from_index::NFromIndexAdapter,
                    n_from_type::NFromTypeAdapter,
                    v_from_id::VFromIdAdapter,
                    v_from_type::VFromTypeAdapter
                },
                util::{
                    dedup::DedupAdapter, drop::Drop, exist::Exist, filter_mut::FilterMut,
                    filter_ref::FilterRefAdapter, map::MapAdapter, paths::{PathAlgorithm, ShortestPathAdapter},
                    range::RangeAdapter, update::UpdateAdapter, order::OrderByAdapter,
                    aggregate::AggregateAdapter, group_by::GroupByAdapter, count::CountAdapter,
                    upsert::UpsertAdapter,
                },
                vectors::{
                    brute_force_search::BruteForceSearchVAdapter, insert::InsertVAdapter,
                    search::SearchVAdapter,
                },
            },
            traversal_value::TraversalValue,
        },
        types::{GraphError, SecondaryIndex},
        vector_core::vector::HVector,
    },
    helix_gateway::{
        embedding_providers::{EmbeddingModel, get_embedding_model},
        router::router::{HandlerInput, IoContFn},
        mcp::mcp::{MCPHandlerSubmission, MCPToolInput, MCPHandler}
    },
    node_matches, props, embed, embed_async,
    field_addition_from_old_field, field_type_cast, field_addition_from_value,
    protocol::{
        response::Response,
        value::{casting::{cast, CastType}, Value},
        format::Format,
    },
    utils::{
        id::{ID, uuid_str},
        items::{Edge, Node},
        properties::ImmutablePropertiesMap,
    },
};
use sonic_rs::{Deserialize, Serialize, json};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Instant;
use chrono::{DateTime, Utc};

// Re-export scalar types for generated code
type I8 = i8;
type I16 = i16;
type I32 = i32;
type I64 = i64;
type U8 = u8;
type U16 = u16;
type U32 = u32;
type U64 = u64;
type U128 = u128;
type F32 = f32;
type F64 = f64;
    
pub fn config() -> Option<Config> {
return Some(Config {
vector_config: Some(VectorConfig {
m: Some(16),
ef_construction: Some(128),
ef_search: Some(768),
}),
graph_config: Some(GraphConfig {
secondary_indices: Some(vec![SecondaryIndex::Unique("external_id".to_string()), SecondaryIndex::Index("user_key".to_string()), SecondaryIndex::Unique("external_id".to_string()), SecondaryIndex::Index("user_key".to_string()), SecondaryIndex::Index("node_key".to_string()), SecondaryIndex::Index("session_key".to_string()), SecondaryIndex::Unique("screenshot_external_id".to_string()), SecondaryIndex::Index("workflow_tag".to_string()), SecondaryIndex::Unique("name".to_string()), SecondaryIndex::Index("entity_type".to_string()), SecondaryIndex::Unique("name".to_string()), SecondaryIndex::Index("category".to_string()), SecondaryIndex::Index("user_id".to_string()), SecondaryIndex::Index("intent_category".to_string()), SecondaryIndex::Index("user_id".to_string()), SecondaryIndex::Unique("canonical_slug".to_string()), SecondaryIndex::Index("intent_label".to_string()), SecondaryIndex::Index("primary_tool".to_string()), SecondaryIndex::Index("session_id".to_string()), SecondaryIndex::Index("action_type".to_string()), SecondaryIndex::Unique("canonical_name".to_string()), SecondaryIndex::Index("category".to_string())]),
}),
db_max_size_gb: Some(20),
mcp: Some(true),
bm25: Some(true),
schema: Some(r#"{
  "schema": {
    "nodes": [
      {
        "name": "Concept",
        "properties": {
          "relevance_score": "F32",
          "label": "String",
          "id": "ID",
          "name": "String",
          "category": "String"
        }
      },
      {
        "name": "Activity",
        "properties": {
          "timestamp": "String",
          "label": "String",
          "confidence": "F32",
          "summary": "String",
          "workflow_tag": "String",
          "session_key": "String",
          "id": "ID",
          "screenshot_external_id": "String",
          "metadata": "String"
        }
      },
      {
        "name": "TimelineNode",
        "properties": {
          "metadata": "String",
          "title": "String",
          "id": "ID",
          "label": "String",
          "created_at": "String",
          "external_id": "String",
          "user_key": "String",
          "node_type": "String"
        }
      },
      {
        "name": "Step",
        "properties": {
          "metadata": "String",
          "order_in_block": "U32",
          "id": "ID",
          "label": "String",
          "action_type": "String",
          "session_id": "String",
          "timestamp": "String"
        }
      },
      {
        "name": "Tool",
        "properties": {
          "id": "ID",
          "metadata": "String",
          "category": "String",
          "canonical_name": "String",
          "label": "String"
        }
      },
      {
        "name": "Session",
        "properties": {
          "metadata": "String",
          "user_key": "String",
          "id": "ID",
          "workflow_confidence": "F32",
          "duration_seconds": "U32",
          "external_id": "String",
          "workflow_primary": "String",
          "screenshot_count": "U32",
          "node_key": "String",
          "label": "String",
          "end_time": "String",
          "workflow_secondary": "String",
          "start_time": "String"
        }
      },
      {
        "name": "Entity",
        "properties": {
          "entity_type": "String",
          "name": "String",
          "id": "ID",
          "metadata": "String",
          "frequency": "U32",
          "label": "String"
        }
      },
      {
        "name": "WorkflowPattern",
        "properties": {
          "metadata": "String",
          "occurrence_count": "U32",
          "label": "String",
          "last_seen_at": "String",
          "intent_category": "String",
          "user_id": "String",
          "id": "ID"
        }
      },
      {
        "name": "Block",
        "properties": {
          "metadata": "String",
          "id": "ID",
          "label": "String",
          "canonical_slug": "String",
          "intent_label": "String",
          "user_id": "String",
          "primary_tool": "String",
          "occurrence_count": "U32"
        }
      },
      {
        "name": "User",
        "properties": {
          "id": "ID",
          "label": "String",
          "metadata": "String",
          "created_at": "String",
          "external_id": "String"
        }
      }
    ],
    "vectors": [
      {
        "name": "SessionEmbedding",
        "properties": {
          "data": "Array(F64)",
          "id": "ID",
          "session_id": "String",
          "summary": "String",
          "score": "F64",
          "label": "String"
        }
      },
      {
        "name": "ConceptEmbedding",
        "properties": {
          "description": "String",
          "id": "ID",
          "data": "Array(F64)",
          "score": "F64",
          "label": "String",
          "concept_id": "String"
        }
      },
      {
        "name": "ActivityEmbedding",
        "properties": {
          "score": "F64",
          "id": "ID",
          "activity_id": "String",
          "data": "Array(F64)",
          "label": "String",
          "summary": "String"
        }
      }
    ],
    "edges": [
      {
        "name": "RelatesTo",
        "from": "Activity",
        "to": "Concept",
        "properties": {
          "relevance": "F32"
        }
      },
      {
        "name": "Contains",
        "from": "TimelineNode",
        "to": "Session",
        "properties": {}
      },
      {
        "name": "NextBlock",
        "from": "Block",
        "to": "Block",
        "properties": {
          "probability": "F32",
          "frequency": "U32"
        }
      },
      {
        "name": "BlockUsesTool",
        "from": "Block",
        "to": "Tool",
        "properties": {}
      },
      {
        "name": "NextStep",
        "from": "Step",
        "to": "Step",
        "properties": {
          "gap_ms": "U32"
        }
      },
      {
        "name": "PatternOccursInSession",
        "from": "WorkflowPattern",
        "to": "Session",
        "properties": {
          "occurred_at": "String"
        }
      },
      {
        "name": "StepEvidencedBy",
        "from": "Step",
        "to": "Activity",
        "properties": {
          "screenshot_id": "String"
        }
      },
      {
        "name": "ActivityInSession",
        "from": "Activity",
        "to": "Session",
        "properties": {}
      },
      {
        "name": "Uses",
        "from": "Activity",
        "to": "Entity",
        "properties": {
          "context": "String"
        }
      },
      {
        "name": "BelongsTo",
        "from": "Session",
        "to": "TimelineNode",
        "properties": {
          "created_at": "String"
        }
      },
      {
        "name": "Follows",
        "from": "Session",
        "to": "Session",
        "properties": {
          "gap_seconds": "U32"
        }
      },
      {
        "name": "SwitchesTo",
        "from": "Activity",
        "to": "Activity",
        "properties": {
          "switch_type": "String"
        }
      },
      {
        "name": "PatternContainsBlock",
        "from": "WorkflowPattern",
        "to": "Block",
        "properties": {
          "order": "U32"
        }
      },
      {
        "name": "BlockContainsStep",
        "from": "Block",
        "to": "Step",
        "properties": {
          "order": "U32"
        }
      },
      {
        "name": "DependsOn",
        "from": "TimelineNode",
        "to": "TimelineNode",
        "properties": {
          "dependency_type": "String"
        }
      },
      {
        "name": "BlockRelatesConcept",
        "from": "Block",
        "to": "Concept",
        "properties": {
          "relevance": "F32"
        }
      }
    ]
  },
  "queries": [
    {
      "name": "GetBlocksByUser",
      "parameters": {
        "user_id": "String"
      },
      "returns": [
        "blocks"
      ]
    },
    {
      "name": "GetActivitiesBySession",
      "parameters": {
        "session_key": "String"
      },
      "returns": [
        "activities"
      ]
    },
    {
      "name": "UpsertEntity",
      "parameters": {
        "metadata": "String",
        "name": "String",
        "entity_type": "String"
      },
      "returns": [
        "entity"
      ]
    },
    {
      "name": "UpsertWorkflowPattern",
      "parameters": {
        "last_seen_at": "String",
        "occurrence_count": "U32",
        "metadata": "String",
        "user_id": "String",
        "intent_category": "String"
      },
      "returns": [
        "pattern"
      ]
    },
    {
      "name": "UpsertTimelineNode",
      "parameters": {
        "external_id": "String",
        "title": "String",
        "created_at": "String",
        "user_key": "String",
        "metadata": "String",
        "node_type": "String"
      },
      "returns": [
        "node"
      ]
    },
    {
      "name": "GetActivityByScreenshotId",
      "parameters": {
        "screenshot_external_id": "String"
      },
      "returns": [
        "activity"
      ]
    },
    {
      "name": "UpsertConcept",
      "parameters": {
        "category": "String",
        "relevance_score": "F32",
        "name": "String"
      },
      "returns": [
        "concept"
      ]
    },
    {
      "name": "LinkBlockSequence",
      "parameters": {
        "to_slug": "String",
        "from_slug": "String",
        "frequency": "U32",
        "probability": "F32"
      },
      "returns": [
        "edge"
      ]
    },
    {
      "name": "GetActivitiesByWorkflowTag",
      "parameters": {
        "workflow_tag": "String"
      },
      "returns": [
        "activities"
      ]
    },
    {
      "name": "GetTimelineNodesByUser",
      "parameters": {
        "user_key": "String"
      },
      "returns": [
        "nodes"
      ]
    },
    {
      "name": "GetSessionCount",
      "parameters": {},
      "returns": [
        "count"
      ]
    },
    {
      "name": "GetTimelineNodeByExternalId",
      "parameters": {
        "external_id": "String"
      },
      "returns": [
        "node"
      ]
    },
    {
      "name": "GetSessionsByUser",
      "parameters": {
        "user_key": "String",
        "start": "U32",
        "end_range": "U32"
      },
      "returns": [
        "sessions"
      ]
    },
    {
      "name": "GetEntitiesByType",
      "parameters": {
        "entity_type": "String"
      },
      "returns": [
        "entities"
      ]
    },
    {
      "name": "GetConceptsByCategory",
      "parameters": {
        "category": "String"
      },
      "returns": [
        "concepts"
      ]
    },
    {
      "name": "GetUserByKey",
      "parameters": {
        "user_key": "String"
      },
      "returns": [
        "user"
      ]
    },
    {
      "name": "GetSessionByExternalId",
      "parameters": {
        "external_id": "String"
      },
      "returns": [
        "session"
      ]
    },
    {
      "name": "GetConceptByName",
      "parameters": {
        "name": "String"
      },
      "returns": [
        "concept"
      ]
    },
    {
      "name": "GetPatternsByIntent",
      "parameters": {
        "intent_category": "String"
      },
      "returns": [
        "patterns"
      ]
    },
    {
      "name": "CreateStep",
      "parameters": {
        "metadata": "String",
        "session_id": "String",
        "action_type": "String",
        "timestamp": "String",
        "order_in_block": "U32"
      },
      "returns": [
        "step"
      ]
    },
    {
      "name": "GetStepsByActionType",
      "parameters": {
        "action_type": "String"
      },
      "returns": [
        "steps"
      ]
    },
    {
      "name": "SearchSimilarConcepts",
      "parameters": {
        "query_embedding": "Array(F64)",
        "limit": "I64"
      },
      "returns": [
        "results"
      ]
    },
    {
      "name": "GetBlocksByTool",
      "parameters": {
        "primary_tool": "String"
      },
      "returns": [
        "blocks"
      ]
    },
    {
      "name": "GetToolByName",
      "parameters": {
        "canonical_name": "String"
      },
      "returns": [
        "tool"
      ]
    },
    {
      "name": "GetUserCount",
      "parameters": {},
      "returns": [
        "count"
      ]
    },
    {
      "name": "LinkActivityToEntity",
      "parameters": {
        "entity_name": "String",
        "screenshot_external_id": "String",
        "context": "String"
      },
      "returns": [
        "edge"
      ]
    },
    {
      "name": "UpsertBlock",
      "parameters": {
        "canonical_slug": "String",
        "occurrence_count": "U32",
        "intent_label": "String",
        "user_id": "String",
        "primary_tool": "String",
        "metadata": "String"
      },
      "returns": [
        "block"
      ]
    },
    {
      "name": "LinkBlockToTool",
      "parameters": {
        "block_slug": "String",
        "tool_name": "String"
      },
      "returns": [
        "edge"
      ]
    },
    {
      "name": "GetConceptConnections",
      "parameters": {
        "concept_name": "String"
      },
      "returns": [
        "sessions"
      ]
    },
    {
      "name": "UpsertActivity",
      "parameters": {
        "summary": "String",
        "metadata": "String",
        "timestamp": "String",
        "workflow_tag": "String",
        "session_key": "String",
        "confidence": "F32",
        "screenshot_external_id": "String"
      },
      "returns": [
        "activity"
      ]
    },
    {
      "name": "LinkSessionSequence",
      "parameters": {
        "gap_seconds": "U32",
        "to_external_id": "String",
        "from_external_id": "String"
      },
      "returns": [
        "edge"
      ]
    },
    {
      "name": "GetUserByExternalId",
      "parameters": {
        "external_id": "String"
      },
      "returns": [
        "user"
      ]
    },
    {
      "name": "GetEntityOccurrences",
      "parameters": {
        "entity_name": "String"
      },
      "returns": [
        "sessions"
      ]
    },
    {
      "name": "GetWorkflowPatterns",
      "parameters": {
        "user_id": "String"
      },
      "returns": [
        "patterns"
      ]
    },
    {
      "name": "GetStepsBySession",
      "parameters": {
        "session_id": "String"
      },
      "returns": [
        "steps"
      ]
    },
    {
      "name": "GetToolsByCategory",
      "parameters": {
        "category": "String"
      },
      "returns": [
        "tools"
      ]
    },
    {
      "name": "GetEntityByName",
      "parameters": {
        "name": "String"
      },
      "returns": [
        "entity"
      ]
    },
    {
      "name": "HealthCheck",
      "parameters": {
        "dummy": "String"
      },
      "returns": [
        "users"
      ]
    },
    {
      "name": "UpsertUser",
      "parameters": {
        "metadata": "String",
        "external_id": "String",
        "created_at": "String"
      },
      "returns": [
        "user"
      ]
    },
    {
      "name": "GetRelatedSessions",
      "parameters": {
        "session_external_id": "String"
      },
      "returns": [
        "related"
      ]
    },
    {
      "name": "GetBlockBySlug",
      "parameters": {
        "canonical_slug": "String"
      },
      "returns": [
        "block"
      ]
    },
    {
      "name": "LinkActivityToConcept",
      "parameters": {
        "concept_name": "String",
        "relevance": "F32",
        "screenshot_external_id": "String"
      },
      "returns": [
        "edge"
      ]
    },
    {
      "name": "GetSessionsByNode",
      "parameters": {
        "node_key": "String"
      },
      "returns": [
        "sessions"
      ]
    },
    {
      "name": "GetCrossSessionContext",
      "parameters": {
        "user_key": "String"
      },
      "returns": [
        "entities"
      ]
    },
    {
      "name": "UpsertSession",
      "parameters": {
        "workflow_confidence": "F32",
        "external_id": "String",
        "start_time": "String",
        "duration_seconds": "U32",
        "screenshot_count": "U32",
        "workflow_primary": "String",
        "end_time": "String",
        "node_key": "String",
        "metadata": "String",
        "user_key": "String",
        "workflow_secondary": "String"
      },
      "returns": [
        "session"
      ]
    },
    {
      "name": "SearchSimilarSessions",
      "parameters": {
        "limit": "I64",
        "query_embedding": "Array(F64)"
      },
      "returns": [
        "results"
      ]
    },
    {
      "name": "SearchSimilarActivities",
      "parameters": {
        "query_embedding": "Array(F64)",
        "limit": "I64"
      },
      "returns": [
        "results"
      ]
    },
    {
      "name": "UpsertTool",
      "parameters": {
        "metadata": "String",
        "canonical_name": "String",
        "category": "String"
      },
      "returns": [
        "tool"
      ]
    },
    {
      "name": "LinkSessionToNode",
      "parameters": {
        "node_external_id": "String",
        "created_at": "String",
        "session_external_id": "String"
      },
      "returns": [
        "edge"
      ]
    }
  ]
}"#.to_string()),
embedding_model: Some("text-embedding-ada-002".to_string()),
graphvis_node_label: None,
})
}
pub struct User {
    pub external_id: String,
    pub created_at: String,
    pub metadata: String,
}

pub struct TimelineNode {
    pub external_id: String,
    pub user_key: String,
    pub node_type: String,
    pub title: String,
    pub created_at: String,
    pub metadata: String,
}

pub struct Session {
    pub external_id: String,
    pub user_key: String,
    pub node_key: String,
    pub start_time: String,
    pub end_time: String,
    pub duration_seconds: u32,
    pub screenshot_count: u32,
    pub workflow_primary: String,
    pub workflow_secondary: String,
    pub workflow_confidence: f32,
    pub metadata: String,
}

pub struct Activity {
    pub session_key: String,
    pub screenshot_external_id: String,
    pub workflow_tag: String,
    pub timestamp: String,
    pub summary: String,
    pub confidence: f32,
    pub metadata: String,
}

pub struct Entity {
    pub name: String,
    pub entity_type: String,
    pub frequency: u32,
    pub metadata: String,
}

pub struct Concept {
    pub name: String,
    pub category: String,
    pub relevance_score: f32,
}

pub struct WorkflowPattern {
    pub user_id: String,
    pub intent_category: String,
    pub occurrence_count: u32,
    pub last_seen_at: String,
    pub metadata: String,
}

pub struct Block {
    pub user_id: String,
    pub canonical_slug: String,
    pub intent_label: String,
    pub primary_tool: String,
    pub occurrence_count: u32,
    pub metadata: String,
}

pub struct Step {
    pub session_id: String,
    pub action_type: String,
    pub order_in_block: u32,
    pub timestamp: String,
    pub metadata: String,
}

pub struct Tool {
    pub canonical_name: String,
    pub category: String,
    pub metadata: String,
}

pub struct BelongsTo {
    pub from: Session,
    pub to: TimelineNode,
    pub created_at: String,
}

pub struct Follows {
    pub from: Session,
    pub to: Session,
    pub gap_seconds: u32,
}

pub struct Uses {
    pub from: Activity,
    pub to: Entity,
    pub context: String,
}

pub struct RelatesTo {
    pub from: Activity,
    pub to: Concept,
    pub relevance: f32,
}

pub struct Contains {
    pub from: TimelineNode,
    pub to: Session,
}

pub struct SwitchesTo {
    pub from: Activity,
    pub to: Activity,
    pub switch_type: String,
}

pub struct ActivityInSession {
    pub from: Activity,
    pub to: Session,
}

pub struct DependsOn {
    pub from: TimelineNode,
    pub to: TimelineNode,
    pub dependency_type: String,
}

pub struct PatternContainsBlock {
    pub from: WorkflowPattern,
    pub to: Block,
    pub order: u32,
}

pub struct NextBlock {
    pub from: Block,
    pub to: Block,
    pub frequency: u32,
    pub probability: f32,
}

pub struct BlockContainsStep {
    pub from: Block,
    pub to: Step,
    pub order: u32,
}

pub struct NextStep {
    pub from: Step,
    pub to: Step,
    pub gap_ms: u32,
}

pub struct BlockUsesTool {
    pub from: Block,
    pub to: Tool,
}

pub struct BlockRelatesConcept {
    pub from: Block,
    pub to: Concept,
    pub relevance: f32,
}

pub struct PatternOccursInSession {
    pub from: WorkflowPattern,
    pub to: Session,
    pub occurred_at: String,
}

pub struct StepEvidencedBy {
    pub from: Step,
    pub to: Activity,
    pub screenshot_id: String,
}

pub struct ActivityEmbedding {
    pub activity_id: String,
    pub summary: String,
}

pub struct ConceptEmbedding {
    pub concept_id: String,
    pub description: String,
}

pub struct SessionEmbedding {
    pub session_id: String,
    pub summary: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetBlocksByUserInput {

pub user_id: String
}
#[derive(Serialize, Default)]
pub struct GetBlocksByUserBlocksReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub canonical_slug: Option<&'a Value>,
    pub primary_tool: Option<&'a Value>,
    pub intent_label: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub user_id: Option<&'a Value>,
    pub occurrence_count: Option<&'a Value>,
}

#[handler]
pub fn GetBlocksByUser (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetBlocksByUserInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let blocks = G::new(&db, &txn, &arena)
.n_from_type("Block")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("user_id")
                    .map_or(false, |v| *v == data.user_id.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "blocks": blocks.iter().map(|block| GetBlocksByUserBlocksReturnType {
        id: uuid_str(block.id(), &arena),
        label: block.label(),
        canonical_slug: block.get_property("canonical_slug"),
        primary_tool: block.get_property("primary_tool"),
        intent_label: block.get_property("intent_label"),
        metadata: block.get_property("metadata"),
        user_id: block.get_property("user_id"),
        occurrence_count: block.get_property("occurrence_count"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetActivitiesBySessionInput {

pub session_key: String
}
#[derive(Serialize, Default)]
pub struct GetActivitiesBySessionActivitiesReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub metadata: Option<&'a Value>,
    pub screenshot_external_id: Option<&'a Value>,
    pub timestamp: Option<&'a Value>,
    pub workflow_tag: Option<&'a Value>,
    pub session_key: Option<&'a Value>,
    pub confidence: Option<&'a Value>,
    pub summary: Option<&'a Value>,
}

#[handler]
pub fn GetActivitiesBySession (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetActivitiesBySessionInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let activities = G::new(&db, &txn, &arena)
.n_from_type("Activity")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("session_key")
                    .map_or(false, |v| *v == data.session_key.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "activities": activities.iter().map(|activitie| GetActivitiesBySessionActivitiesReturnType {
        id: uuid_str(activitie.id(), &arena),
        label: activitie.label(),
        metadata: activitie.get_property("metadata"),
        screenshot_external_id: activitie.get_property("screenshot_external_id"),
        timestamp: activitie.get_property("timestamp"),
        workflow_tag: activitie.get_property("workflow_tag"),
        session_key: activitie.get_property("session_key"),
        confidence: activitie.get_property("confidence"),
        summary: activitie.get_property("summary"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpsertEntityInput {

pub name: String,
pub entity_type: String,
pub metadata: String
}
#[derive(Serialize, Default)]
pub struct UpsertEntityEntityReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub metadata: Option<&'a Value>,
    pub frequency: Option<&'a Value>,
    pub name: Option<&'a Value>,
    pub entity_type: Option<&'a Value>,
}

#[handler(is_write)]
pub fn UpsertEntity (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<UpsertEntityInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let existing = G::new(&db, &txn, &arena)
.n_from_type("Entity")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("name")
                    .map_or(false, |v| *v == data.name.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
    let entity = G::new_mut_from_iter(&db, &mut txn, existing.iter().cloned(), &arena)
    .upsert_n("Entity", &[("name", Value::from(&data.name)), ("entity_type", Value::from(&data.entity_type)), ("frequency", Value::from(1)), ("metadata", Value::from(&data.metadata))])
    .collect_to_obj()?;
let response = json!({
    "entity": UpsertEntityEntityReturnType {
        id: uuid_str(entity.id(), &arena),
        label: entity.label(),
        metadata: entity.get_property("metadata"),
        frequency: entity.get_property("frequency"),
        name: entity.get_property("name"),
        entity_type: entity.get_property("entity_type"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpsertWorkflowPatternInput {

pub user_id: String,
pub intent_category: String,
pub occurrence_count: u32,
pub last_seen_at: String,
pub metadata: String
}
#[derive(Serialize, Default)]
pub struct UpsertWorkflowPatternPatternReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub intent_category: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub occurrence_count: Option<&'a Value>,
    pub last_seen_at: Option<&'a Value>,
    pub user_id: Option<&'a Value>,
}

#[handler(is_write)]
pub fn UpsertWorkflowPattern (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<UpsertWorkflowPatternInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let existing = G::new(&db, &txn, &arena)
.n_from_type("WorkflowPattern")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("user_id")
                    .map_or(false, |v| *v == data.user_id.clone()))
                } else {
                    Ok(false)
                }
            })

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("intent_category")
                    .map_or(false, |v| *v == data.intent_category.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
    let pattern = G::new_mut_from_iter(&db, &mut txn, existing.iter().cloned(), &arena)
    .upsert_n("WorkflowPattern", &[("user_id", Value::from(&data.user_id)), ("intent_category", Value::from(&data.intent_category)), ("occurrence_count", Value::from(&data.occurrence_count)), ("last_seen_at", Value::from(&data.last_seen_at)), ("metadata", Value::from(&data.metadata))])
    .collect_to_obj()?;
let response = json!({
    "pattern": UpsertWorkflowPatternPatternReturnType {
        id: uuid_str(pattern.id(), &arena),
        label: pattern.label(),
        intent_category: pattern.get_property("intent_category"),
        metadata: pattern.get_property("metadata"),
        occurrence_count: pattern.get_property("occurrence_count"),
        last_seen_at: pattern.get_property("last_seen_at"),
        user_id: pattern.get_property("user_id"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpsertTimelineNodeInput {

pub external_id: String,
pub user_key: String,
pub node_type: String,
pub title: String,
pub created_at: String,
pub metadata: String
}
#[derive(Serialize, Default)]
pub struct UpsertTimelineNodeNodeReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub external_id: Option<&'a Value>,
    pub node_type: Option<&'a Value>,
    pub user_key: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub created_at: Option<&'a Value>,
    pub title: Option<&'a Value>,
}

#[handler(is_write)]
pub fn UpsertTimelineNode (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<UpsertTimelineNodeInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let existing = G::new(&db, &txn, &arena)
.n_from_type("TimelineNode")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.external_id.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
    let node = G::new_mut_from_iter(&db, &mut txn, existing.iter().cloned(), &arena)
    .upsert_n("TimelineNode", &[("external_id", Value::from(&data.external_id)), ("user_key", Value::from(&data.user_key)), ("node_type", Value::from(&data.node_type)), ("title", Value::from(&data.title)), ("created_at", Value::from(&data.created_at)), ("metadata", Value::from(&data.metadata))])
    .collect_to_obj()?;
let response = json!({
    "node": UpsertTimelineNodeNodeReturnType {
        id: uuid_str(node.id(), &arena),
        label: node.label(),
        external_id: node.get_property("external_id"),
        node_type: node.get_property("node_type"),
        user_key: node.get_property("user_key"),
        metadata: node.get_property("metadata"),
        created_at: node.get_property("created_at"),
        title: node.get_property("title"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetActivityByScreenshotIdInput {

pub screenshot_external_id: String
}
#[derive(Serialize, Default)]
pub struct GetActivityByScreenshotIdActivityReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub metadata: Option<&'a Value>,
    pub screenshot_external_id: Option<&'a Value>,
    pub timestamp: Option<&'a Value>,
    pub workflow_tag: Option<&'a Value>,
    pub session_key: Option<&'a Value>,
    pub confidence: Option<&'a Value>,
    pub summary: Option<&'a Value>,
}

#[handler]
pub fn GetActivityByScreenshotId (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetActivityByScreenshotIdInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let activity = G::new(&db, &txn, &arena)
.n_from_index("Activity", "screenshot_external_id", &data.screenshot_external_id).collect_to_obj()?;
let response = json!({
    "activity": GetActivityByScreenshotIdActivityReturnType {
        id: uuid_str(activity.id(), &arena),
        label: activity.label(),
        metadata: activity.get_property("metadata"),
        screenshot_external_id: activity.get_property("screenshot_external_id"),
        timestamp: activity.get_property("timestamp"),
        workflow_tag: activity.get_property("workflow_tag"),
        session_key: activity.get_property("session_key"),
        confidence: activity.get_property("confidence"),
        summary: activity.get_property("summary"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpsertConceptInput {

pub name: String,
pub category: String,
pub relevance_score: f32
}
#[derive(Serialize, Default)]
pub struct UpsertConceptConceptReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub category: Option<&'a Value>,
    pub relevance_score: Option<&'a Value>,
    pub name: Option<&'a Value>,
}

#[handler(is_write)]
pub fn UpsertConcept (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<UpsertConceptInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let existing = G::new(&db, &txn, &arena)
.n_from_type("Concept")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("name")
                    .map_or(false, |v| *v == data.name.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
    let concept = G::new_mut_from_iter(&db, &mut txn, existing.iter().cloned(), &arena)
    .upsert_n("Concept", &[("name", Value::from(&data.name)), ("category", Value::from(&data.category)), ("relevance_score", Value::from(&data.relevance_score))])
    .collect_to_obj()?;
let response = json!({
    "concept": UpsertConceptConceptReturnType {
        id: uuid_str(concept.id(), &arena),
        label: concept.label(),
        category: concept.get_property("category"),
        relevance_score: concept.get_property("relevance_score"),
        name: concept.get_property("name"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LinkBlockSequenceInput {

pub from_slug: String,
pub to_slug: String,
pub frequency: u32,
pub probability: f32
}
#[derive(Serialize, Default)]
pub struct LinkBlockSequenceEdgeReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub from_node: &'a str,
    pub to_node: &'a str,
    pub probability: Option<&'a Value>,
    pub frequency: Option<&'a Value>,
}

#[handler(is_write)]
pub fn LinkBlockSequence (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<LinkBlockSequenceInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let from_block = G::new(&db, &txn, &arena)
.n_from_index("Block", "canonical_slug", &data.from_slug).collect_to_obj()?;
    let to_block = G::new(&db, &txn, &arena)
.n_from_index("Block", "canonical_slug", &data.to_slug).collect_to_obj()?;
    let edge = G::new_mut(&db, &arena, &mut txn)
.add_edge("NextBlock", Some(ImmutablePropertiesMap::new(2, vec![("probability", Value::from(data.probability.clone())), ("frequency", Value::from(data.frequency.clone()))].into_iter(), &arena)), from_block.id(), to_block.id(), false, false).collect_to_obj()?;
let response = json!({
    "edge": LinkBlockSequenceEdgeReturnType {
        id: uuid_str(edge.id(), &arena),
        label: edge.label(),
        from_node: uuid_str(edge.from_node(), &arena),
        to_node: uuid_str(edge.to_node(), &arena),
        probability: edge.get_property("probability"),
        frequency: edge.get_property("frequency"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetActivitiesByWorkflowTagInput {

pub workflow_tag: String
}
#[derive(Serialize, Default)]
pub struct GetActivitiesByWorkflowTagActivitiesReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub metadata: Option<&'a Value>,
    pub screenshot_external_id: Option<&'a Value>,
    pub timestamp: Option<&'a Value>,
    pub workflow_tag: Option<&'a Value>,
    pub session_key: Option<&'a Value>,
    pub confidence: Option<&'a Value>,
    pub summary: Option<&'a Value>,
}

#[handler]
pub fn GetActivitiesByWorkflowTag (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetActivitiesByWorkflowTagInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let activities = G::new(&db, &txn, &arena)
.n_from_type("Activity")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("workflow_tag")
                    .map_or(false, |v| *v == data.workflow_tag.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "activities": activities.iter().map(|activitie| GetActivitiesByWorkflowTagActivitiesReturnType {
        id: uuid_str(activitie.id(), &arena),
        label: activitie.label(),
        metadata: activitie.get_property("metadata"),
        screenshot_external_id: activitie.get_property("screenshot_external_id"),
        timestamp: activitie.get_property("timestamp"),
        workflow_tag: activitie.get_property("workflow_tag"),
        session_key: activitie.get_property("session_key"),
        confidence: activitie.get_property("confidence"),
        summary: activitie.get_property("summary"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetTimelineNodesByUserInput {

pub user_key: String
}
#[derive(Serialize, Default)]
pub struct GetTimelineNodesByUserNodesReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub external_id: Option<&'a Value>,
    pub node_type: Option<&'a Value>,
    pub user_key: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub created_at: Option<&'a Value>,
    pub title: Option<&'a Value>,
}

#[handler]
pub fn GetTimelineNodesByUser (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetTimelineNodesByUserInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let nodes = G::new(&db, &txn, &arena)
.n_from_type("TimelineNode")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("user_key")
                    .map_or(false, |v| *v == data.user_key.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "nodes": nodes.iter().map(|node| GetTimelineNodesByUserNodesReturnType {
        id: uuid_str(node.id(), &arena),
        label: node.label(),
        external_id: node.get_property("external_id"),
        node_type: node.get_property("node_type"),
        user_key: node.get_property("user_key"),
        metadata: node.get_property("metadata"),
        created_at: node.get_property("created_at"),
        title: node.get_property("title"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[handler]
pub fn GetSessionCount (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let count = G::new(&db, &txn, &arena)
.n_from_type("Session")

.count_to_val();
let response = json!({
    "count": count
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetTimelineNodeByExternalIdInput {

pub external_id: String
}
#[derive(Serialize, Default)]
pub struct GetTimelineNodeByExternalIdNodeReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub external_id: Option<&'a Value>,
    pub node_type: Option<&'a Value>,
    pub user_key: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub created_at: Option<&'a Value>,
    pub title: Option<&'a Value>,
}

#[handler]
pub fn GetTimelineNodeByExternalId (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetTimelineNodeByExternalIdInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let node = G::new(&db, &txn, &arena)
.n_from_index("TimelineNode", "external_id", &data.external_id).collect_to_obj()?;
let response = json!({
    "node": GetTimelineNodeByExternalIdNodeReturnType {
        id: uuid_str(node.id(), &arena),
        label: node.label(),
        external_id: node.get_property("external_id"),
        node_type: node.get_property("node_type"),
        user_key: node.get_property("user_key"),
        metadata: node.get_property("metadata"),
        created_at: node.get_property("created_at"),
        title: node.get_property("title"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetSessionsByUserInput {

pub user_key: String,
pub start: u32,
pub end_range: u32
}
#[derive(Serialize, Default)]
pub struct GetSessionsByUserSessionsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub workflow_primary: Option<&'a Value>,
    pub end_time: Option<&'a Value>,
    pub workflow_confidence: Option<&'a Value>,
    pub screenshot_count: Option<&'a Value>,
    pub node_key: Option<&'a Value>,
    pub external_id: Option<&'a Value>,
    pub workflow_secondary: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub start_time: Option<&'a Value>,
    pub user_key: Option<&'a Value>,
    pub duration_seconds: Option<&'a Value>,
}

#[handler]
pub fn GetSessionsByUser (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetSessionsByUserInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let sessions = G::new(&db, &txn, &arena)
.n_from_type("Session")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("user_key")
                    .map_or(false, |v| *v == data.user_key.clone()))
                } else {
                    Ok(false)
                }
            })

.order_by_desc(|val| val.get_property("start_time").cloned().unwrap_or(Value::Empty))

.range(data.start.clone(), data.end_range.clone()).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "sessions": sessions.iter().map(|session| GetSessionsByUserSessionsReturnType {
        id: uuid_str(session.id(), &arena),
        label: session.label(),
        workflow_primary: session.get_property("workflow_primary"),
        end_time: session.get_property("end_time"),
        workflow_confidence: session.get_property("workflow_confidence"),
        screenshot_count: session.get_property("screenshot_count"),
        node_key: session.get_property("node_key"),
        external_id: session.get_property("external_id"),
        workflow_secondary: session.get_property("workflow_secondary"),
        metadata: session.get_property("metadata"),
        start_time: session.get_property("start_time"),
        user_key: session.get_property("user_key"),
        duration_seconds: session.get_property("duration_seconds"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetEntitiesByTypeInput {

pub entity_type: String
}
#[derive(Serialize, Default)]
pub struct GetEntitiesByTypeEntitiesReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub metadata: Option<&'a Value>,
    pub frequency: Option<&'a Value>,
    pub name: Option<&'a Value>,
    pub entity_type: Option<&'a Value>,
}

#[handler]
pub fn GetEntitiesByType (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetEntitiesByTypeInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let entities = G::new(&db, &txn, &arena)
.n_from_type("Entity")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("entity_type")
                    .map_or(false, |v| *v == data.entity_type.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "entities": entities.iter().map(|entitie| GetEntitiesByTypeEntitiesReturnType {
        id: uuid_str(entitie.id(), &arena),
        label: entitie.label(),
        metadata: entitie.get_property("metadata"),
        frequency: entitie.get_property("frequency"),
        name: entitie.get_property("name"),
        entity_type: entitie.get_property("entity_type"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetConceptsByCategoryInput {

pub category: String
}
#[derive(Serialize, Default)]
pub struct GetConceptsByCategoryConceptsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub category: Option<&'a Value>,
    pub relevance_score: Option<&'a Value>,
    pub name: Option<&'a Value>,
}

#[handler]
pub fn GetConceptsByCategory (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetConceptsByCategoryInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let concepts = G::new(&db, &txn, &arena)
.n_from_type("Concept")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("category")
                    .map_or(false, |v| *v == data.category.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "concepts": concepts.iter().map(|concept| GetConceptsByCategoryConceptsReturnType {
        id: uuid_str(concept.id(), &arena),
        label: concept.label(),
        category: concept.get_property("category"),
        relevance_score: concept.get_property("relevance_score"),
        name: concept.get_property("name"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetUserByKeyInput {

pub user_key: String
}
#[derive(Serialize, Default)]
pub struct GetUserByKeyUserReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub metadata: Option<&'a Value>,
    pub external_id: Option<&'a Value>,
    pub created_at: Option<&'a Value>,
}

#[handler]
pub fn GetUserByKey (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetUserByKeyInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let user = G::new(&db, &txn, &arena)
.n_from_type("User")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.user_key.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "user": user.iter().map(|user| GetUserByKeyUserReturnType {
        id: uuid_str(user.id(), &arena),
        label: user.label(),
        metadata: user.get_property("metadata"),
        external_id: user.get_property("external_id"),
        created_at: user.get_property("created_at"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetSessionByExternalIdInput {

pub external_id: String
}
#[derive(Serialize, Default)]
pub struct GetSessionByExternalIdSessionReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub workflow_primary: Option<&'a Value>,
    pub end_time: Option<&'a Value>,
    pub workflow_confidence: Option<&'a Value>,
    pub screenshot_count: Option<&'a Value>,
    pub node_key: Option<&'a Value>,
    pub external_id: Option<&'a Value>,
    pub workflow_secondary: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub start_time: Option<&'a Value>,
    pub user_key: Option<&'a Value>,
    pub duration_seconds: Option<&'a Value>,
}

#[handler]
pub fn GetSessionByExternalId (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetSessionByExternalIdInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let session = G::new(&db, &txn, &arena)
.n_from_index("Session", "external_id", &data.external_id).collect_to_obj()?;
let response = json!({
    "session": GetSessionByExternalIdSessionReturnType {
        id: uuid_str(session.id(), &arena),
        label: session.label(),
        workflow_primary: session.get_property("workflow_primary"),
        end_time: session.get_property("end_time"),
        workflow_confidence: session.get_property("workflow_confidence"),
        screenshot_count: session.get_property("screenshot_count"),
        node_key: session.get_property("node_key"),
        external_id: session.get_property("external_id"),
        workflow_secondary: session.get_property("workflow_secondary"),
        metadata: session.get_property("metadata"),
        start_time: session.get_property("start_time"),
        user_key: session.get_property("user_key"),
        duration_seconds: session.get_property("duration_seconds"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetConceptByNameInput {

pub name: String
}
#[derive(Serialize, Default)]
pub struct GetConceptByNameConceptReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub category: Option<&'a Value>,
    pub relevance_score: Option<&'a Value>,
    pub name: Option<&'a Value>,
}

#[handler]
pub fn GetConceptByName (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetConceptByNameInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let concept = G::new(&db, &txn, &arena)
.n_from_index("Concept", "name", &data.name).collect_to_obj()?;
let response = json!({
    "concept": GetConceptByNameConceptReturnType {
        id: uuid_str(concept.id(), &arena),
        label: concept.label(),
        category: concept.get_property("category"),
        relevance_score: concept.get_property("relevance_score"),
        name: concept.get_property("name"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetPatternsByIntentInput {

pub intent_category: String
}
#[derive(Serialize, Default)]
pub struct GetPatternsByIntentPatternsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub intent_category: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub occurrence_count: Option<&'a Value>,
    pub last_seen_at: Option<&'a Value>,
    pub user_id: Option<&'a Value>,
}

#[handler]
pub fn GetPatternsByIntent (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetPatternsByIntentInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let patterns = G::new(&db, &txn, &arena)
.n_from_type("WorkflowPattern")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("intent_category")
                    .map_or(false, |v| *v == data.intent_category.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "patterns": patterns.iter().map(|pattern| GetPatternsByIntentPatternsReturnType {
        id: uuid_str(pattern.id(), &arena),
        label: pattern.label(),
        intent_category: pattern.get_property("intent_category"),
        metadata: pattern.get_property("metadata"),
        occurrence_count: pattern.get_property("occurrence_count"),
        last_seen_at: pattern.get_property("last_seen_at"),
        user_id: pattern.get_property("user_id"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CreateStepInput {

pub session_id: String,
pub action_type: String,
pub order_in_block: u32,
pub timestamp: String,
pub metadata: String
}
#[derive(Serialize, Default)]
pub struct CreateStepStepReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub session_id: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub timestamp: Option<&'a Value>,
    pub order_in_block: Option<&'a Value>,
    pub action_type: Option<&'a Value>,
}

#[handler(is_write)]
pub fn CreateStep (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<CreateStepInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let step = G::new_mut(&db, &arena, &mut txn)
.add_n("Step", Some(ImmutablePropertiesMap::new(5, vec![("session_id", Value::from(&data.session_id)), ("action_type", Value::from(&data.action_type)), ("metadata", Value::from(&data.metadata)), ("timestamp", Value::from(&data.timestamp)), ("order_in_block", Value::from(&data.order_in_block))].into_iter(), &arena)), Some(&["session_id", "action_type"])).collect_to_obj()?;
let response = json!({
    "step": CreateStepStepReturnType {
        id: uuid_str(step.id(), &arena),
        label: step.label(),
        session_id: step.get_property("session_id"),
        metadata: step.get_property("metadata"),
        timestamp: step.get_property("timestamp"),
        order_in_block: step.get_property("order_in_block"),
        action_type: step.get_property("action_type"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetStepsByActionTypeInput {

pub action_type: String
}
#[derive(Serialize, Default)]
pub struct GetStepsByActionTypeStepsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub session_id: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub timestamp: Option<&'a Value>,
    pub order_in_block: Option<&'a Value>,
    pub action_type: Option<&'a Value>,
}

#[handler]
pub fn GetStepsByActionType (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetStepsByActionTypeInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let steps = G::new(&db, &txn, &arena)
.n_from_type("Step")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("action_type")
                    .map_or(false, |v| *v == data.action_type.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "steps": steps.iter().map(|step| GetStepsByActionTypeStepsReturnType {
        id: uuid_str(step.id(), &arena),
        label: step.label(),
        session_id: step.get_property("session_id"),
        metadata: step.get_property("metadata"),
        timestamp: step.get_property("timestamp"),
        order_in_block: step.get_property("order_in_block"),
        action_type: step.get_property("action_type"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SearchSimilarConceptsInput {

pub query_embedding: Vec<f64>,
pub limit: i64
}
#[derive(Serialize, Default)]
pub struct SearchSimilarConceptsResultsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub data: &'a [f64],
    pub score: f64,
    pub description: Option<&'a Value>,
    pub concept_id: Option<&'a Value>,
}

#[handler]
pub fn SearchSimilarConcepts (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<SearchSimilarConceptsInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let results = G::new(&db, &txn, &arena)
.search_v::<fn(&HVector, &RoTxn) -> bool, _>(&data.query_embedding, data.limit.clone(), "ConceptEmbedding", None).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "results": results.iter().map(|result| SearchSimilarConceptsResultsReturnType {
        id: uuid_str(result.id(), &arena),
        label: result.label(),
        data: result.data(),
        score: result.score(),
        description: result.get_property("description"),
        concept_id: result.get_property("concept_id"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetBlocksByToolInput {

pub primary_tool: String
}
#[derive(Serialize, Default)]
pub struct GetBlocksByToolBlocksReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub canonical_slug: Option<&'a Value>,
    pub primary_tool: Option<&'a Value>,
    pub intent_label: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub user_id: Option<&'a Value>,
    pub occurrence_count: Option<&'a Value>,
}

#[handler]
pub fn GetBlocksByTool (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetBlocksByToolInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let blocks = G::new(&db, &txn, &arena)
.n_from_type("Block")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("primary_tool")
                    .map_or(false, |v| *v == data.primary_tool.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "blocks": blocks.iter().map(|block| GetBlocksByToolBlocksReturnType {
        id: uuid_str(block.id(), &arena),
        label: block.label(),
        canonical_slug: block.get_property("canonical_slug"),
        primary_tool: block.get_property("primary_tool"),
        intent_label: block.get_property("intent_label"),
        metadata: block.get_property("metadata"),
        user_id: block.get_property("user_id"),
        occurrence_count: block.get_property("occurrence_count"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetToolByNameInput {

pub canonical_name: String
}
#[derive(Serialize, Default)]
pub struct GetToolByNameToolReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub canonical_name: Option<&'a Value>,
    pub category: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler]
pub fn GetToolByName (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetToolByNameInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let tool = G::new(&db, &txn, &arena)
.n_from_index("Tool", "canonical_name", &data.canonical_name).collect_to_obj()?;
let response = json!({
    "tool": GetToolByNameToolReturnType {
        id: uuid_str(tool.id(), &arena),
        label: tool.label(),
        canonical_name: tool.get_property("canonical_name"),
        category: tool.get_property("category"),
        metadata: tool.get_property("metadata"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[handler]
pub fn GetUserCount (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let count = G::new(&db, &txn, &arena)
.n_from_type("User")

.count_to_val();
let response = json!({
    "count": count
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LinkActivityToEntityInput {

pub screenshot_external_id: String,
pub entity_name: String,
pub context: String
}
#[derive(Serialize, Default)]
pub struct LinkActivityToEntityEdgeReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub from_node: &'a str,
    pub to_node: &'a str,
    pub context: Option<&'a Value>,
}

#[handler(is_write)]
pub fn LinkActivityToEntity (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<LinkActivityToEntityInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let activity = G::new(&db, &txn, &arena)
.n_from_index("Activity", "screenshot_external_id", &data.screenshot_external_id).collect_to_obj()?;
    let entity = G::new(&db, &txn, &arena)
.n_from_index("Entity", "name", &data.entity_name).collect_to_obj()?;
    let edge = G::new_mut(&db, &arena, &mut txn)
.add_edge("Uses", Some(ImmutablePropertiesMap::new(1, vec![("context", Value::from(data.context.clone()))].into_iter(), &arena)), activity.id(), entity.id(), false, false).collect_to_obj()?;
let response = json!({
    "edge": LinkActivityToEntityEdgeReturnType {
        id: uuid_str(edge.id(), &arena),
        label: edge.label(),
        from_node: uuid_str(edge.from_node(), &arena),
        to_node: uuid_str(edge.to_node(), &arena),
        context: edge.get_property("context"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpsertBlockInput {

pub user_id: String,
pub canonical_slug: String,
pub intent_label: String,
pub primary_tool: String,
pub occurrence_count: u32,
pub metadata: String
}
#[derive(Serialize, Default)]
pub struct UpsertBlockBlockReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub canonical_slug: Option<&'a Value>,
    pub primary_tool: Option<&'a Value>,
    pub intent_label: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub user_id: Option<&'a Value>,
    pub occurrence_count: Option<&'a Value>,
}

#[handler(is_write)]
pub fn UpsertBlock (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<UpsertBlockInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let existing = G::new(&db, &txn, &arena)
.n_from_type("Block")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("canonical_slug")
                    .map_or(false, |v| *v == data.canonical_slug.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
    let block = G::new_mut_from_iter(&db, &mut txn, existing.iter().cloned(), &arena)
    .upsert_n("Block", &[("user_id", Value::from(&data.user_id)), ("canonical_slug", Value::from(&data.canonical_slug)), ("intent_label", Value::from(&data.intent_label)), ("primary_tool", Value::from(&data.primary_tool)), ("occurrence_count", Value::from(&data.occurrence_count)), ("metadata", Value::from(&data.metadata))])
    .collect_to_obj()?;
let response = json!({
    "block": UpsertBlockBlockReturnType {
        id: uuid_str(block.id(), &arena),
        label: block.label(),
        canonical_slug: block.get_property("canonical_slug"),
        primary_tool: block.get_property("primary_tool"),
        intent_label: block.get_property("intent_label"),
        metadata: block.get_property("metadata"),
        user_id: block.get_property("user_id"),
        occurrence_count: block.get_property("occurrence_count"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LinkBlockToToolInput {

pub block_slug: String,
pub tool_name: String
}
#[derive(Serialize, Default)]
pub struct LinkBlockToToolEdgeReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub from_node: &'a str,
    pub to_node: &'a str,
}

#[handler(is_write)]
pub fn LinkBlockToTool (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<LinkBlockToToolInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let block = G::new(&db, &txn, &arena)
.n_from_index("Block", "canonical_slug", &data.block_slug).collect_to_obj()?;
    let tool = G::new(&db, &txn, &arena)
.n_from_index("Tool", "canonical_name", &data.tool_name).collect_to_obj()?;
    let edge = G::new_mut(&db, &arena, &mut txn)
.add_edge("BlockUsesTool", None, block.id(), tool.id(), false, false).collect_to_obj()?;
let response = json!({
    "edge": LinkBlockToToolEdgeReturnType {
        id: uuid_str(edge.id(), &arena),
        label: edge.label(),
        from_node: uuid_str(edge.from_node(), &arena),
        to_node: uuid_str(edge.to_node(), &arena),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetConceptConnectionsInput {

pub concept_name: String
}
#[derive(Serialize, Default)]
pub struct GetConceptConnectionsSessionsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub workflow_primary: Option<&'a Value>,
    pub end_time: Option<&'a Value>,
    pub workflow_confidence: Option<&'a Value>,
    pub screenshot_count: Option<&'a Value>,
    pub node_key: Option<&'a Value>,
    pub external_id: Option<&'a Value>,
    pub workflow_secondary: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub start_time: Option<&'a Value>,
    pub user_key: Option<&'a Value>,
    pub duration_seconds: Option<&'a Value>,
}

#[handler]
pub fn GetConceptConnections (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetConceptConnectionsInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let concept = G::new(&db, &txn, &arena)
.n_from_index("Concept", "name", &data.concept_name).collect_to_obj()?;
    let activities = G::from_iter(&db, &txn, std::iter::once(concept.clone()), &arena)

.in_node("RelatesTo").collect::<Result<Vec<_>, _>>()?;
    let sessions = G::from_iter(&db, &txn, activities.iter().cloned(), &arena)

.out_node("ActivityInSession").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "sessions": sessions.iter().map(|session| GetConceptConnectionsSessionsReturnType {
        id: uuid_str(session.id(), &arena),
        label: session.label(),
        workflow_primary: session.get_property("workflow_primary"),
        end_time: session.get_property("end_time"),
        workflow_confidence: session.get_property("workflow_confidence"),
        screenshot_count: session.get_property("screenshot_count"),
        node_key: session.get_property("node_key"),
        external_id: session.get_property("external_id"),
        workflow_secondary: session.get_property("workflow_secondary"),
        metadata: session.get_property("metadata"),
        start_time: session.get_property("start_time"),
        user_key: session.get_property("user_key"),
        duration_seconds: session.get_property("duration_seconds"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpsertActivityInput {

pub session_key: String,
pub screenshot_external_id: String,
pub workflow_tag: String,
pub timestamp: String,
pub summary: String,
pub confidence: f32,
pub metadata: String
}
#[derive(Serialize, Default)]
pub struct UpsertActivityActivityReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub metadata: Option<&'a Value>,
    pub screenshot_external_id: Option<&'a Value>,
    pub timestamp: Option<&'a Value>,
    pub workflow_tag: Option<&'a Value>,
    pub session_key: Option<&'a Value>,
    pub confidence: Option<&'a Value>,
    pub summary: Option<&'a Value>,
}

#[handler(is_write)]
pub fn UpsertActivity (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<UpsertActivityInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let existing = G::new(&db, &txn, &arena)
.n_from_type("Activity")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("screenshot_external_id")
                    .map_or(false, |v| *v == data.screenshot_external_id.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
    let activity = G::new_mut_from_iter(&db, &mut txn, existing.iter().cloned(), &arena)
    .upsert_n("Activity", &[("session_key", Value::from(&data.session_key)), ("screenshot_external_id", Value::from(&data.screenshot_external_id)), ("workflow_tag", Value::from(&data.workflow_tag)), ("timestamp", Value::from(&data.timestamp)), ("summary", Value::from(&data.summary)), ("confidence", Value::from(&data.confidence)), ("metadata", Value::from(&data.metadata))])
    .collect_to_obj()?;
let response = json!({
    "activity": UpsertActivityActivityReturnType {
        id: uuid_str(activity.id(), &arena),
        label: activity.label(),
        metadata: activity.get_property("metadata"),
        screenshot_external_id: activity.get_property("screenshot_external_id"),
        timestamp: activity.get_property("timestamp"),
        workflow_tag: activity.get_property("workflow_tag"),
        session_key: activity.get_property("session_key"),
        confidence: activity.get_property("confidence"),
        summary: activity.get_property("summary"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LinkSessionSequenceInput {

pub from_external_id: String,
pub to_external_id: String,
pub gap_seconds: u32
}
#[derive(Serialize, Default)]
pub struct LinkSessionSequenceEdgeReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub from_node: &'a str,
    pub to_node: &'a str,
    pub gap_seconds: Option<&'a Value>,
}

#[handler(is_write)]
pub fn LinkSessionSequence (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<LinkSessionSequenceInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let from_session = G::new(&db, &txn, &arena)
.n_from_index("Session", "external_id", &data.from_external_id).collect_to_obj()?;
    let to_session = G::new(&db, &txn, &arena)
.n_from_index("Session", "external_id", &data.to_external_id).collect_to_obj()?;
    let edge = G::new_mut(&db, &arena, &mut txn)
.add_edge("Follows", Some(ImmutablePropertiesMap::new(1, vec![("gap_seconds", Value::from(data.gap_seconds.clone()))].into_iter(), &arena)), from_session.id(), to_session.id(), false, false).collect_to_obj()?;
let response = json!({
    "edge": LinkSessionSequenceEdgeReturnType {
        id: uuid_str(edge.id(), &arena),
        label: edge.label(),
        from_node: uuid_str(edge.from_node(), &arena),
        to_node: uuid_str(edge.to_node(), &arena),
        gap_seconds: edge.get_property("gap_seconds"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetUserByExternalIdInput {

pub external_id: String
}
#[derive(Serialize, Default)]
pub struct GetUserByExternalIdUserReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub metadata: Option<&'a Value>,
    pub external_id: Option<&'a Value>,
    pub created_at: Option<&'a Value>,
}

#[handler]
pub fn GetUserByExternalId (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetUserByExternalIdInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let user = G::new(&db, &txn, &arena)
.n_from_index("User", "external_id", &data.external_id).collect_to_obj()?;
let response = json!({
    "user": GetUserByExternalIdUserReturnType {
        id: uuid_str(user.id(), &arena),
        label: user.label(),
        metadata: user.get_property("metadata"),
        external_id: user.get_property("external_id"),
        created_at: user.get_property("created_at"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetEntityOccurrencesInput {

pub entity_name: String
}
#[derive(Serialize, Default)]
pub struct GetEntityOccurrencesSessionsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub workflow_primary: Option<&'a Value>,
    pub end_time: Option<&'a Value>,
    pub workflow_confidence: Option<&'a Value>,
    pub screenshot_count: Option<&'a Value>,
    pub node_key: Option<&'a Value>,
    pub external_id: Option<&'a Value>,
    pub workflow_secondary: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub start_time: Option<&'a Value>,
    pub user_key: Option<&'a Value>,
    pub duration_seconds: Option<&'a Value>,
}

#[handler]
pub fn GetEntityOccurrences (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetEntityOccurrencesInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let entity = G::new(&db, &txn, &arena)
.n_from_index("Entity", "name", &data.entity_name).collect_to_obj()?;
    let activities = G::from_iter(&db, &txn, std::iter::once(entity.clone()), &arena)

.in_node("Uses").collect::<Result<Vec<_>, _>>()?;
    let sessions = G::from_iter(&db, &txn, activities.iter().cloned(), &arena)

.out_node("ActivityInSession").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "sessions": sessions.iter().map(|session| GetEntityOccurrencesSessionsReturnType {
        id: uuid_str(session.id(), &arena),
        label: session.label(),
        workflow_primary: session.get_property("workflow_primary"),
        end_time: session.get_property("end_time"),
        workflow_confidence: session.get_property("workflow_confidence"),
        screenshot_count: session.get_property("screenshot_count"),
        node_key: session.get_property("node_key"),
        external_id: session.get_property("external_id"),
        workflow_secondary: session.get_property("workflow_secondary"),
        metadata: session.get_property("metadata"),
        start_time: session.get_property("start_time"),
        user_key: session.get_property("user_key"),
        duration_seconds: session.get_property("duration_seconds"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetWorkflowPatternsInput {

pub user_id: String
}
#[derive(Serialize, Default)]
pub struct GetWorkflowPatternsPatternsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub intent_category: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub occurrence_count: Option<&'a Value>,
    pub last_seen_at: Option<&'a Value>,
    pub user_id: Option<&'a Value>,
}

#[handler]
pub fn GetWorkflowPatterns (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetWorkflowPatternsInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let patterns = G::new(&db, &txn, &arena)
.n_from_type("WorkflowPattern")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("user_id")
                    .map_or(false, |v| *v == data.user_id.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "patterns": patterns.iter().map(|pattern| GetWorkflowPatternsPatternsReturnType {
        id: uuid_str(pattern.id(), &arena),
        label: pattern.label(),
        intent_category: pattern.get_property("intent_category"),
        metadata: pattern.get_property("metadata"),
        occurrence_count: pattern.get_property("occurrence_count"),
        last_seen_at: pattern.get_property("last_seen_at"),
        user_id: pattern.get_property("user_id"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetStepsBySessionInput {

pub session_id: String
}
#[derive(Serialize, Default)]
pub struct GetStepsBySessionStepsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub session_id: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub timestamp: Option<&'a Value>,
    pub order_in_block: Option<&'a Value>,
    pub action_type: Option<&'a Value>,
}

#[handler]
pub fn GetStepsBySession (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetStepsBySessionInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let steps = G::new(&db, &txn, &arena)
.n_from_type("Step")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("session_id")
                    .map_or(false, |v| *v == data.session_id.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "steps": steps.iter().map(|step| GetStepsBySessionStepsReturnType {
        id: uuid_str(step.id(), &arena),
        label: step.label(),
        session_id: step.get_property("session_id"),
        metadata: step.get_property("metadata"),
        timestamp: step.get_property("timestamp"),
        order_in_block: step.get_property("order_in_block"),
        action_type: step.get_property("action_type"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetToolsByCategoryInput {

pub category: String
}
#[derive(Serialize, Default)]
pub struct GetToolsByCategoryToolsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub canonical_name: Option<&'a Value>,
    pub category: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler]
pub fn GetToolsByCategory (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetToolsByCategoryInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let tools = G::new(&db, &txn, &arena)
.n_from_type("Tool")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("category")
                    .map_or(false, |v| *v == data.category.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "tools": tools.iter().map(|tool| GetToolsByCategoryToolsReturnType {
        id: uuid_str(tool.id(), &arena),
        label: tool.label(),
        canonical_name: tool.get_property("canonical_name"),
        category: tool.get_property("category"),
        metadata: tool.get_property("metadata"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetEntityByNameInput {

pub name: String
}
#[derive(Serialize, Default)]
pub struct GetEntityByNameEntityReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub metadata: Option<&'a Value>,
    pub frequency: Option<&'a Value>,
    pub name: Option<&'a Value>,
    pub entity_type: Option<&'a Value>,
}

#[handler]
pub fn GetEntityByName (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetEntityByNameInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let entity = G::new(&db, &txn, &arena)
.n_from_index("Entity", "name", &data.name).collect_to_obj()?;
let response = json!({
    "entity": GetEntityByNameEntityReturnType {
        id: uuid_str(entity.id(), &arena),
        label: entity.label(),
        metadata: entity.get_property("metadata"),
        frequency: entity.get_property("frequency"),
        name: entity.get_property("name"),
        entity_type: entity.get_property("entity_type"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HealthCheckInput {

pub dummy: String
}
#[derive(Serialize, Default)]
pub struct HealthCheckUsersReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub metadata: Option<&'a Value>,
    pub external_id: Option<&'a Value>,
    pub created_at: Option<&'a Value>,
}

#[handler]
pub fn HealthCheck (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<HealthCheckInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let users = G::new(&db, &txn, &arena)
.n_from_type("User")

.range(0, 1).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "users": users.iter().map(|user| HealthCheckUsersReturnType {
        id: uuid_str(user.id(), &arena),
        label: user.label(),
        metadata: user.get_property("metadata"),
        external_id: user.get_property("external_id"),
        created_at: user.get_property("created_at"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpsertUserInput {

pub external_id: String,
pub created_at: String,
pub metadata: String
}
#[derive(Serialize, Default)]
pub struct UpsertUserUserReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub metadata: Option<&'a Value>,
    pub external_id: Option<&'a Value>,
    pub created_at: Option<&'a Value>,
}

#[handler(is_write)]
pub fn UpsertUser (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<UpsertUserInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let existing = G::new(&db, &txn, &arena)
.n_from_type("User")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.external_id.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
    let user = G::new_mut_from_iter(&db, &mut txn, existing.iter().cloned(), &arena)
    .upsert_n("User", &[("external_id", Value::from(&data.external_id)), ("created_at", Value::from(&data.created_at)), ("metadata", Value::from(&data.metadata))])
    .collect_to_obj()?;
let response = json!({
    "user": UpsertUserUserReturnType {
        id: uuid_str(user.id(), &arena),
        label: user.label(),
        metadata: user.get_property("metadata"),
        external_id: user.get_property("external_id"),
        created_at: user.get_property("created_at"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetRelatedSessionsInput {

pub session_external_id: String
}
#[derive(Serialize, Default)]
pub struct GetRelatedSessionsRelatedReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub workflow_primary: Option<&'a Value>,
    pub end_time: Option<&'a Value>,
    pub workflow_confidence: Option<&'a Value>,
    pub screenshot_count: Option<&'a Value>,
    pub node_key: Option<&'a Value>,
    pub external_id: Option<&'a Value>,
    pub workflow_secondary: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub start_time: Option<&'a Value>,
    pub user_key: Option<&'a Value>,
    pub duration_seconds: Option<&'a Value>,
}

#[handler]
pub fn GetRelatedSessions (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetRelatedSessionsInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let session = G::new(&db, &txn, &arena)
.n_from_index("Session", "external_id", &data.session_external_id).collect_to_obj()?;
    let node = G::from_iter(&db, &txn, std::iter::once(session.clone()), &arena)

.out_node("BelongsTo").collect::<Result<Vec<_>, _>>()?;
    let related = G::from_iter(&db, &txn, node.iter().cloned(), &arena)

.in_node("BelongsTo")

.range(0, 50).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "related": related.iter().map(|related| GetRelatedSessionsRelatedReturnType {
        id: uuid_str(related.id(), &arena),
        label: related.label(),
        workflow_primary: related.get_property("workflow_primary"),
        end_time: related.get_property("end_time"),
        workflow_confidence: related.get_property("workflow_confidence"),
        screenshot_count: related.get_property("screenshot_count"),
        node_key: related.get_property("node_key"),
        external_id: related.get_property("external_id"),
        workflow_secondary: related.get_property("workflow_secondary"),
        metadata: related.get_property("metadata"),
        start_time: related.get_property("start_time"),
        user_key: related.get_property("user_key"),
        duration_seconds: related.get_property("duration_seconds"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetBlockBySlugInput {

pub canonical_slug: String
}
#[derive(Serialize, Default)]
pub struct GetBlockBySlugBlockReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub canonical_slug: Option<&'a Value>,
    pub primary_tool: Option<&'a Value>,
    pub intent_label: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub user_id: Option<&'a Value>,
    pub occurrence_count: Option<&'a Value>,
}

#[handler]
pub fn GetBlockBySlug (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetBlockBySlugInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let block = G::new(&db, &txn, &arena)
.n_from_index("Block", "canonical_slug", &data.canonical_slug).collect_to_obj()?;
let response = json!({
    "block": GetBlockBySlugBlockReturnType {
        id: uuid_str(block.id(), &arena),
        label: block.label(),
        canonical_slug: block.get_property("canonical_slug"),
        primary_tool: block.get_property("primary_tool"),
        intent_label: block.get_property("intent_label"),
        metadata: block.get_property("metadata"),
        user_id: block.get_property("user_id"),
        occurrence_count: block.get_property("occurrence_count"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LinkActivityToConceptInput {

pub screenshot_external_id: String,
pub concept_name: String,
pub relevance: f32
}
#[derive(Serialize, Default)]
pub struct LinkActivityToConceptEdgeReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub from_node: &'a str,
    pub to_node: &'a str,
    pub relevance: Option<&'a Value>,
}

#[handler(is_write)]
pub fn LinkActivityToConcept (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<LinkActivityToConceptInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let activity = G::new(&db, &txn, &arena)
.n_from_index("Activity", "screenshot_external_id", &data.screenshot_external_id).collect_to_obj()?;
    let concept = G::new(&db, &txn, &arena)
.n_from_index("Concept", "name", &data.concept_name).collect_to_obj()?;
    let edge = G::new_mut(&db, &arena, &mut txn)
.add_edge("RelatesTo", Some(ImmutablePropertiesMap::new(1, vec![("relevance", Value::from(data.relevance.clone()))].into_iter(), &arena)), activity.id(), concept.id(), false, false).collect_to_obj()?;
let response = json!({
    "edge": LinkActivityToConceptEdgeReturnType {
        id: uuid_str(edge.id(), &arena),
        label: edge.label(),
        from_node: uuid_str(edge.from_node(), &arena),
        to_node: uuid_str(edge.to_node(), &arena),
        relevance: edge.get_property("relevance"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetSessionsByNodeInput {

pub node_key: String
}
#[derive(Serialize, Default)]
pub struct GetSessionsByNodeSessionsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub workflow_primary: Option<&'a Value>,
    pub end_time: Option<&'a Value>,
    pub workflow_confidence: Option<&'a Value>,
    pub screenshot_count: Option<&'a Value>,
    pub node_key: Option<&'a Value>,
    pub external_id: Option<&'a Value>,
    pub workflow_secondary: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub start_time: Option<&'a Value>,
    pub user_key: Option<&'a Value>,
    pub duration_seconds: Option<&'a Value>,
}

#[handler]
pub fn GetSessionsByNode (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetSessionsByNodeInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let sessions = G::new(&db, &txn, &arena)
.n_from_type("Session")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("node_key")
                    .map_or(false, |v| *v == data.node_key.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "sessions": sessions.iter().map(|session| GetSessionsByNodeSessionsReturnType {
        id: uuid_str(session.id(), &arena),
        label: session.label(),
        workflow_primary: session.get_property("workflow_primary"),
        end_time: session.get_property("end_time"),
        workflow_confidence: session.get_property("workflow_confidence"),
        screenshot_count: session.get_property("screenshot_count"),
        node_key: session.get_property("node_key"),
        external_id: session.get_property("external_id"),
        workflow_secondary: session.get_property("workflow_secondary"),
        metadata: session.get_property("metadata"),
        start_time: session.get_property("start_time"),
        user_key: session.get_property("user_key"),
        duration_seconds: session.get_property("duration_seconds"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetCrossSessionContextInput {

pub user_key: String
}
#[derive(Serialize, Default)]
pub struct GetCrossSessionContextEntitiesReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub metadata: Option<&'a Value>,
    pub frequency: Option<&'a Value>,
    pub name: Option<&'a Value>,
    pub entity_type: Option<&'a Value>,
}

#[handler]
pub fn GetCrossSessionContext (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetCrossSessionContextInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let sessions = G::new(&db, &txn, &arena)
.n_from_type("Session")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("user_key")
                    .map_or(false, |v| *v == data.user_key.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
    let activities = G::from_iter(&db, &txn, sessions.iter().cloned(), &arena)

.in_node("ActivityInSession").collect::<Result<Vec<_>, _>>()?;
    let entities = G::from_iter(&db, &txn, activities.iter().cloned(), &arena)

.out_node("Uses").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "entities": entities.iter().map(|entitie| GetCrossSessionContextEntitiesReturnType {
        id: uuid_str(entitie.id(), &arena),
        label: entitie.label(),
        metadata: entitie.get_property("metadata"),
        frequency: entitie.get_property("frequency"),
        name: entitie.get_property("name"),
        entity_type: entitie.get_property("entity_type"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpsertSessionInput {

pub external_id: String,
pub user_key: String,
pub node_key: String,
pub start_time: String,
pub end_time: String,
pub duration_seconds: u32,
pub screenshot_count: u32,
pub workflow_primary: String,
pub workflow_secondary: String,
pub workflow_confidence: f32,
pub metadata: String
}
#[derive(Serialize, Default)]
pub struct UpsertSessionSessionReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub workflow_primary: Option<&'a Value>,
    pub end_time: Option<&'a Value>,
    pub workflow_confidence: Option<&'a Value>,
    pub screenshot_count: Option<&'a Value>,
    pub node_key: Option<&'a Value>,
    pub external_id: Option<&'a Value>,
    pub workflow_secondary: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
    pub start_time: Option<&'a Value>,
    pub user_key: Option<&'a Value>,
    pub duration_seconds: Option<&'a Value>,
}

#[handler(is_write)]
pub fn UpsertSession (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<UpsertSessionInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let existing = G::new(&db, &txn, &arena)
.n_from_type("Session")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.external_id.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
    let session = G::new_mut_from_iter(&db, &mut txn, existing.iter().cloned(), &arena)
    .upsert_n("Session", &[("external_id", Value::from(&data.external_id)), ("user_key", Value::from(&data.user_key)), ("node_key", Value::from(&data.node_key)), ("start_time", Value::from(&data.start_time)), ("end_time", Value::from(&data.end_time)), ("duration_seconds", Value::from(&data.duration_seconds)), ("screenshot_count", Value::from(&data.screenshot_count)), ("workflow_primary", Value::from(&data.workflow_primary)), ("workflow_secondary", Value::from(&data.workflow_secondary)), ("workflow_confidence", Value::from(&data.workflow_confidence)), ("metadata", Value::from(&data.metadata))])
    .collect_to_obj()?;
let response = json!({
    "session": UpsertSessionSessionReturnType {
        id: uuid_str(session.id(), &arena),
        label: session.label(),
        workflow_primary: session.get_property("workflow_primary"),
        end_time: session.get_property("end_time"),
        workflow_confidence: session.get_property("workflow_confidence"),
        screenshot_count: session.get_property("screenshot_count"),
        node_key: session.get_property("node_key"),
        external_id: session.get_property("external_id"),
        workflow_secondary: session.get_property("workflow_secondary"),
        metadata: session.get_property("metadata"),
        start_time: session.get_property("start_time"),
        user_key: session.get_property("user_key"),
        duration_seconds: session.get_property("duration_seconds"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SearchSimilarSessionsInput {

pub query_embedding: Vec<f64>,
pub limit: i64
}
#[derive(Serialize, Default)]
pub struct SearchSimilarSessionsResultsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub data: &'a [f64],
    pub score: f64,
    pub summary: Option<&'a Value>,
    pub session_id: Option<&'a Value>,
}

#[handler]
pub fn SearchSimilarSessions (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<SearchSimilarSessionsInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let results = G::new(&db, &txn, &arena)
.search_v::<fn(&HVector, &RoTxn) -> bool, _>(&data.query_embedding, data.limit.clone(), "SessionEmbedding", None).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "results": results.iter().map(|result| SearchSimilarSessionsResultsReturnType {
        id: uuid_str(result.id(), &arena),
        label: result.label(),
        data: result.data(),
        score: result.score(),
        summary: result.get_property("summary"),
        session_id: result.get_property("session_id"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SearchSimilarActivitiesInput {

pub query_embedding: Vec<f64>,
pub limit: i64
}
#[derive(Serialize, Default)]
pub struct SearchSimilarActivitiesResultsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub data: &'a [f64],
    pub score: f64,
    pub summary: Option<&'a Value>,
    pub activity_id: Option<&'a Value>,
}

#[handler]
pub fn SearchSimilarActivities (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<SearchSimilarActivitiesInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let results = G::new(&db, &txn, &arena)
.search_v::<fn(&HVector, &RoTxn) -> bool, _>(&data.query_embedding, data.limit.clone(), "ActivityEmbedding", None).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "results": results.iter().map(|result| SearchSimilarActivitiesResultsReturnType {
        id: uuid_str(result.id(), &arena),
        label: result.label(),
        data: result.data(),
        score: result.score(),
        summary: result.get_property("summary"),
        activity_id: result.get_property("activity_id"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpsertToolInput {

pub canonical_name: String,
pub category: String,
pub metadata: String
}
#[derive(Serialize, Default)]
pub struct UpsertToolToolReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub canonical_name: Option<&'a Value>,
    pub category: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler(is_write)]
pub fn UpsertTool (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<UpsertToolInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let existing = G::new(&db, &txn, &arena)
.n_from_type("Tool")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("canonical_name")
                    .map_or(false, |v| *v == data.canonical_name.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
    let tool = G::new_mut_from_iter(&db, &mut txn, existing.iter().cloned(), &arena)
    .upsert_n("Tool", &[("canonical_name", Value::from(&data.canonical_name)), ("category", Value::from(&data.category)), ("metadata", Value::from(&data.metadata))])
    .collect_to_obj()?;
let response = json!({
    "tool": UpsertToolToolReturnType {
        id: uuid_str(tool.id(), &arena),
        label: tool.label(),
        canonical_name: tool.get_property("canonical_name"),
        category: tool.get_property("category"),
        metadata: tool.get_property("metadata"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LinkSessionToNodeInput {

pub session_external_id: String,
pub node_external_id: String,
pub created_at: String
}
#[derive(Serialize, Default)]
pub struct LinkSessionToNodeEdgeReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub from_node: &'a str,
    pub to_node: &'a str,
    pub created_at: Option<&'a Value>,
}

#[handler(is_write)]
pub fn LinkSessionToNode (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<LinkSessionToNodeInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let session = G::new(&db, &txn, &arena)
.n_from_index("Session", "external_id", &data.session_external_id).collect_to_obj()?;
    let node = G::new(&db, &txn, &arena)
.n_from_index("TimelineNode", "external_id", &data.node_external_id).collect_to_obj()?;
    let edge = G::new_mut(&db, &arena, &mut txn)
.add_edge("BelongsTo", Some(ImmutablePropertiesMap::new(1, vec![("created_at", Value::from(data.created_at.clone()))].into_iter(), &arena)), session.id(), node.id(), false, false).collect_to_obj()?;
let response = json!({
    "edge": LinkSessionToNodeEdgeReturnType {
        id: uuid_str(edge.id(), &arena),
        label: edge.label(),
        from_node: uuid_str(edge.from_node(), &arena),
        to_node: uuid_str(edge.to_node(), &arena),
        created_at: edge.get_property("created_at"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}


