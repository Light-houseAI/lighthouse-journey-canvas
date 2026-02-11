
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
secondary_indices: Some(vec![SecondaryIndex::Index("name".to_string()), SecondaryIndex::Index("canonical_name".to_string())]),
}),
db_max_size_gb: Some(10),
mcp: Some(true),
bm25: Some(true),
schema: Some(r#"{
  "schema": {
    "nodes": [
      {
        "name": "User",
        "properties": {
          "id": "ID",
          "label": "String",
          "external_id": "String",
          "metadata": "String"
        }
      },
      {
        "name": "TimelineNode",
        "properties": {
          "label": "String",
          "external_id": "String",
          "title": "String",
          "metadata": "String",
          "id": "ID",
          "node_type": "String"
        }
      },
      {
        "name": "Session",
        "properties": {
          "external_id": "String",
          "workflow_primary": "String",
          "duration_seconds": "I64",
          "start_time": "Date",
          "id": "ID",
          "end_time": "Date",
          "screenshot_count": "I64",
          "label": "String",
          "workflow_secondary": "String",
          "workflow_confidence": "F64",
          "metadata": "String"
        }
      },
      {
        "name": "Activity",
        "properties": {
          "workflow_tag": "String",
          "metadata": "String",
          "screenshot_external_id": "String",
          "label": "String",
          "confidence": "F64",
          "id": "ID",
          "timestamp": "Date",
          "summary": "String"
        }
      },
      {
        "name": "Entity",
        "properties": {
          "name": "String",
          "label": "String",
          "metadata": "String",
          "id": "ID",
          "entity_type": "String"
        }
      },
      {
        "name": "Concept",
        "properties": {
          "label": "String",
          "category": "String",
          "relevance_score": "F64",
          "name": "String",
          "id": "ID"
        }
      },
      {
        "name": "WorkflowPattern",
        "properties": {
          "label": "String",
          "id": "ID",
          "occurrence_count": "I64",
          "metadata": "String",
          "intent_category": "String"
        }
      },
      {
        "name": "Block",
        "properties": {
          "canonical_slug": "String",
          "metadata": "String",
          "primary_tool": "String",
          "id": "ID",
          "label": "String",
          "occurrence_count": "I64",
          "intent_label": "String"
        }
      },
      {
        "name": "Tool",
        "properties": {
          "id": "ID",
          "canonical_name": "String",
          "label": "String",
          "category": "String",
          "metadata": "String"
        }
      }
    ],
    "vectors": [],
    "edges": [
      {
        "name": "UserOwnsNode",
        "from": "User",
        "to": "TimelineNode",
        "properties": {}
      },
      {
        "name": "UserHasPattern",
        "from": "User",
        "to": "WorkflowPattern",
        "properties": {}
      },
      {
        "name": "SessionInNode",
        "from": "Session",
        "to": "TimelineNode",
        "properties": {}
      },
      {
        "name": "ActivityRelatedToConcept",
        "from": "Activity",
        "to": "Concept",
        "properties": {
          "relevance": "F64"
        }
      },
      {
        "name": "UserOwnsSession",
        "from": "User",
        "to": "Session",
        "properties": {}
      },
      {
        "name": "UserHasBlock",
        "from": "User",
        "to": "Block",
        "properties": {}
      },
      {
        "name": "ActivityMentionsEntity",
        "from": "Activity",
        "to": "Entity",
        "properties": {
          "context": "String"
        }
      },
      {
        "name": "ActivityInSession",
        "from": "Activity",
        "to": "Session",
        "properties": {}
      }
    ]
  },
  "queries": [
    {
      "name": "LinkSessionToNode",
      "parameters": {
        "node_external_id": "String",
        "session_external_id": "String"
      },
      "returns": []
    },
    {
      "name": "UpsertWorkflowPattern",
      "parameters": {
        "intent_category": "String",
        "metadata": "String",
        "user_id": "String",
        "occurrence_count": "I64"
      },
      "returns": [
        "pattern"
      ]
    },
    {
      "name": "LinkActivityToSession",
      "parameters": {
        "screenshot_external_id": "String",
        "session_external_id": "String"
      },
      "returns": []
    },
    {
      "name": "LinkActivityToConcept",
      "parameters": {
        "screenshot_external_id": "String",
        "concept_name": "String",
        "relevance": "F64"
      },
      "returns": []
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
      "name": "UpsertTool",
      "parameters": {
        "canonical_name": "String",
        "category": "String",
        "metadata": "String"
      },
      "returns": [
        "tool"
      ]
    },
    {
      "name": "GetAllActivitiesForBackfill",
      "parameters": {
        "end_range": "I64",
        "start": "I64"
      },
      "returns": [
        "activities"
      ]
    },
    {
      "name": "AggregateSessionsByWorkflow",
      "parameters": {
        "user_key": "String"
      },
      "returns": [
        "sessions"
      ]
    },
    {
      "name": "UpsertUser",
      "parameters": {
        "metadata": "String",
        "external_id": "String"
      },
      "returns": [
        "user"
      ]
    },
    {
      "name": "UpsertConcept",
      "parameters": {
        "relevance_score": "F64",
        "category": "String",
        "name": "String"
      },
      "returns": [
        "concept"
      ]
    },
    {
      "name": "GetSessionsByUser",
      "parameters": {
        "end_range": "I64",
        "user_key": "String",
        "start": "I64"
      },
      "returns": [
        "sessions"
      ]
    },
    {
      "name": "GetActivityCount",
      "parameters": {},
      "returns": [
        "count"
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
      "name": "GetBlocksByUser",
      "parameters": {
        "user_id": "String"
      },
      "returns": [
        "blocks"
      ]
    },
    {
      "name": "GetCrossSessionConcepts",
      "parameters": {
        "user_key": "String"
      },
      "returns": [
        "concepts"
      ]
    },
    {
      "name": "UpsertTimelineNode",
      "parameters": {
        "metadata": "String",
        "external_id": "String",
        "user_key": "String",
        "node_type": "String",
        "title": "String"
      },
      "returns": [
        "node"
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
      "name": "GetWorkflowPatterns",
      "parameters": {
        "user_id": "String"
      },
      "returns": [
        "patterns"
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
      "name": "GetSessionsByNode",
      "parameters": {
        "node_key": "String"
      },
      "returns": [
        "sessions"
      ]
    },
    {
      "name": "GetEntityOccurrences",
      "parameters": {
        "entity_name": "String"
      },
      "returns": [
        "activities"
      ]
    },
    {
      "name": "UpsertActivity",
      "parameters": {
        "metadata": "String",
        "screenshot_external_id": "String",
        "session_key": "String",
        "summary": "String",
        "confidence": "F64",
        "workflow_tag": "String",
        "timestamp": "Date"
      },
      "returns": [
        "activity"
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
      "name": "GetPatternsByIntent",
      "parameters": {
        "intent_category": "String"
      },
      "returns": [
        "patterns"
      ]
    },
    {
      "name": "GetAllSessionsExcludingUser",
      "parameters": {
        "start": "I64",
        "end_range": "I64",
        "exclude_user_key": "String"
      },
      "returns": [
        "sessions"
      ]
    },
    {
      "name": "LinkActivityToEntity",
      "parameters": {
        "screenshot_external_id": "String",
        "context": "String",
        "entity_name": "String"
      },
      "returns": []
    },
    {
      "name": "HealthCheck",
      "parameters": {},
      "returns": []
    },
    {
      "name": "GetRelatedSessions",
      "parameters": {
        "session_external_id": "String"
      },
      "returns": [
        "sessions"
      ]
    },
    {
      "name": "UpsertEntity",
      "parameters": {
        "metadata": "String",
        "entity_type": "String",
        "name": "String"
      },
      "returns": [
        "entity"
      ]
    },
    {
      "name": "UpsertBlock",
      "parameters": {
        "user_id": "String",
        "canonical_slug": "String",
        "intent_label": "String",
        "metadata": "String",
        "primary_tool": "String",
        "occurrence_count": "I64"
      },
      "returns": [
        "block"
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
      "name": "UpsertSession",
      "parameters": {
        "end_time": "Date",
        "workflow_primary": "String",
        "external_id": "String",
        "user_key": "String",
        "duration_seconds": "I64",
        "workflow_confidence": "F64",
        "metadata": "String",
        "node_key": "String",
        "workflow_secondary": "String",
        "screenshot_count": "I64",
        "start_time": "Date"
      },
      "returns": [
        "session"
      ]
    },
    {
      "name": "GetAllSessionsForBackfill",
      "parameters": {
        "start": "I64",
        "end_range": "I64"
      },
      "returns": [
        "sessions"
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
    pub metadata: String,
}

pub struct TimelineNode {
    pub external_id: String,
    pub node_type: String,
    pub title: String,
    pub metadata: String,
}

pub struct Session {
    pub external_id: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub duration_seconds: i64,
    pub screenshot_count: i64,
    pub workflow_primary: String,
    pub workflow_secondary: String,
    pub workflow_confidence: f64,
    pub metadata: String,
}

pub struct Activity {
    pub screenshot_external_id: String,
    pub workflow_tag: String,
    pub timestamp: DateTime<Utc>,
    pub summary: String,
    pub confidence: f64,
    pub metadata: String,
}

pub struct Entity {
    pub name: String,
    pub entity_type: String,
    pub metadata: String,
}

pub struct Concept {
    pub name: String,
    pub category: String,
    pub relevance_score: f64,
}

pub struct WorkflowPattern {
    pub intent_category: String,
    pub occurrence_count: i64,
    pub metadata: String,
}

pub struct Block {
    pub canonical_slug: String,
    pub intent_label: String,
    pub primary_tool: String,
    pub occurrence_count: i64,
    pub metadata: String,
}

pub struct Tool {
    pub canonical_name: String,
    pub category: String,
    pub metadata: String,
}

pub struct UserOwnsNode {
    pub from: User,
    pub to: TimelineNode,
}

pub struct UserOwnsSession {
    pub from: User,
    pub to: Session,
}

pub struct SessionInNode {
    pub from: Session,
    pub to: TimelineNode,
}

pub struct ActivityInSession {
    pub from: Activity,
    pub to: Session,
}

pub struct ActivityMentionsEntity {
    pub from: Activity,
    pub to: Entity,
    pub context: String,
}

pub struct ActivityRelatedToConcept {
    pub from: Activity,
    pub to: Concept,
    pub relevance: f64,
}

pub struct UserHasPattern {
    pub from: User,
    pub to: WorkflowPattern,
}

pub struct UserHasBlock {
    pub from: User,
    pub to: Block,
}


#[derive(Serialize, Deserialize, Clone)]
pub struct LinkSessionToNodeInput {

pub session_external_id: String,
pub node_external_id: String
}
#[handler(is_write)]
pub fn LinkSessionToNode (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<LinkSessionToNodeInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let session = G::new(&db, &txn, &arena)
.n_from_type("Session")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.session_external_id.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
    let node = G::new(&db, &txn, &arena)
.n_from_type("TimelineNode")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.node_external_id.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
    {
    let mut edge = Vec::new();
    for from_val in session.iter() {
        for to_val in node.iter() {
            let e = G::new_mut(&db, &arena, &mut txn)
                .add_edge("SessionInNode", None, from_val.id(), to_val.id(), false, false)
                .collect_to_obj()?;
            edge.push(e);
        }
    }
    edge
};
let response = json!({
    "data": "Success"
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpsertWorkflowPatternInput {

pub user_id: String,
pub intent_category: String,
pub occurrence_count: i64,
pub metadata: String
}
#[derive(Serialize, Default)]
pub struct UpsertWorkflowPatternPatternReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub intent_category: Option<&'a Value>,
    pub occurrence_count: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
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
                    .get_property("intent_category")
                    .map_or(false, |v| *v == data.intent_category.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
    let pattern = G::new_mut_from_iter(&db, &mut txn, existing.iter().cloned(), &arena)
    .upsert_n("WorkflowPattern", &[("intent_category", Value::from(&data.intent_category)), ("occurrence_count", Value::from(&data.occurrence_count)), ("metadata", Value::from(&data.metadata))])
    .collect_to_obj()?;
    let user = G::new(&db, &txn, &arena)
.n_from_type("User")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.user_id.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
    {
    let mut edge = Vec::new();
    for from_val in user.iter() {
        let e = G::new_mut(&db, &arena, &mut txn)
            .add_edge("UserHasPattern", None, from_val.id(), pattern.id(), false, false)
            .collect_to_obj()?;
        edge.push(e);
    }
    edge
};
let response = json!({
    "pattern": UpsertWorkflowPatternPatternReturnType {
        id: uuid_str(pattern.id(), &arena),
        label: pattern.label(),
        intent_category: pattern.get_property("intent_category"),
        occurrence_count: pattern.get_property("occurrence_count"),
        metadata: pattern.get_property("metadata"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LinkActivityToSessionInput {

pub screenshot_external_id: String,
pub session_external_id: String
}
#[handler(is_write)]
pub fn LinkActivityToSession (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<LinkActivityToSessionInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let activity = G::new(&db, &txn, &arena)
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
    let session = G::new(&db, &txn, &arena)
.n_from_type("Session")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.session_external_id.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
    {
    let mut edge = Vec::new();
    for from_val in activity.iter() {
        for to_val in session.iter() {
            let e = G::new_mut(&db, &arena, &mut txn)
                .add_edge("ActivityInSession", None, from_val.id(), to_val.id(), false, false)
                .collect_to_obj()?;
            edge.push(e);
        }
    }
    edge
};
let response = json!({
    "data": "Success"
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LinkActivityToConceptInput {

pub screenshot_external_id: String,
pub concept_name: String,
pub relevance: f64
}
#[handler(is_write)]
pub fn LinkActivityToConcept (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<LinkActivityToConceptInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let activity = G::new(&db, &txn, &arena)
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
    let concept = G::new(&db, &txn, &arena)
.n_from_index("Concept", "name", &data.concept_name).collect_to_obj()?;
    {
    let mut edge = Vec::new();
    for from_val in activity.iter() {
        let e = G::new_mut(&db, &arena, &mut txn)
            .add_edge("ActivityRelatedToConcept", None, from_val.id(), concept.id(), false, false)
            .collect_to_obj()?;
        edge.push(e);
    }
    edge
};
let response = json!({
    "data": "Success"
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
    pub name: Option<&'a Value>,
    pub category: Option<&'a Value>,
    pub relevance_score: Option<&'a Value>,
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
        name: concept.get_property("name"),
        category: concept.get_property("category"),
        relevance_score: concept.get_property("relevance_score"),
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
.n_from_index("Tool", "canonical_name", &data.canonical_name).collect_to_obj()?;
    let tool = G::new_mut_from(&db, &mut txn, existing.clone(), &arena)
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
pub struct GetAllActivitiesForBackfillInput {

pub start: i64,
pub end_range: i64
}
#[derive(Serialize, Default)]
pub struct GetAllActivitiesForBackfillActivitiesReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub screenshot_external_id: Option<&'a Value>,
    pub workflow_tag: Option<&'a Value>,
    pub timestamp: Option<&'a Value>,
    pub summary: Option<&'a Value>,
    pub confidence: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler]
pub fn GetAllActivitiesForBackfill (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetAllActivitiesForBackfillInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let activities = G::new(&db, &txn, &arena)
.n_from_type("Activity")

.range(data.start.clone(), data.end_range.clone()).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "activities": activities.iter().map(|activitie| GetAllActivitiesForBackfillActivitiesReturnType {
        id: uuid_str(activitie.id(), &arena),
        label: activitie.label(),
        screenshot_external_id: activitie.get_property("screenshot_external_id"),
        workflow_tag: activitie.get_property("workflow_tag"),
        timestamp: activitie.get_property("timestamp"),
        summary: activitie.get_property("summary"),
        confidence: activitie.get_property("confidence"),
        metadata: activitie.get_property("metadata"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AggregateSessionsByWorkflowInput {

pub user_key: String
}
#[derive(Serialize, Default)]
pub struct AggregateSessionsByWorkflowSessionsItemsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub external_id: Option<&'a Value>,
    pub start_time: Option<&'a Value>,
    pub end_time: Option<&'a Value>,
    pub duration_seconds: Option<&'a Value>,
    pub screenshot_count: Option<&'a Value>,
    pub workflow_primary: Option<&'a Value>,
    pub workflow_secondary: Option<&'a Value>,
    pub workflow_confidence: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}


#[derive(Serialize, Default)]
pub struct AggregateSessionsByWorkflowSessionsReturnType<'a> {
    pub key: String,
    pub workflow_primary: Option<&'a Value>,
    pub count: i32,
    pub items: Vec<AggregateSessionsByWorkflowSessionsItemsReturnType<'a>>,
}

#[handler]
pub fn AggregateSessionsByWorkflow (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<AggregateSessionsByWorkflowInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let sessions = G::new(&db, &txn, &arena)
.n_from_type("User")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.user_key.clone()))
                } else {
                    Ok(false)
                }
            })

.out_node("UserOwnsSession").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "sessions": sessions

});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpsertUserInput {

pub external_id: String,
pub metadata: String
}
#[derive(Serialize, Default)]
pub struct UpsertUserUserReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub external_id: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
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
    .upsert_n("User", &[("external_id", Value::from(&data.external_id)), ("metadata", Value::from(&data.metadata))])
    .collect_to_obj()?;
let response = json!({
    "user": UpsertUserUserReturnType {
        id: uuid_str(user.id(), &arena),
        label: user.label(),
        external_id: user.get_property("external_id"),
        metadata: user.get_property("metadata"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpsertConceptInput {

pub name: String,
pub category: String,
pub relevance_score: f64
}
#[derive(Serialize, Default)]
pub struct UpsertConceptConceptReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub name: Option<&'a Value>,
    pub category: Option<&'a Value>,
    pub relevance_score: Option<&'a Value>,
}

#[handler(is_write)]
pub fn UpsertConcept (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<UpsertConceptInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let existing = G::new(&db, &txn, &arena)
.n_from_index("Concept", "name", &data.name).collect_to_obj()?;
    let concept = G::new_mut_from(&db, &mut txn, existing.clone(), &arena)
    .upsert_n("Concept", &[("name", Value::from(&data.name)), ("category", Value::from(&data.category)), ("relevance_score", Value::from(&data.relevance_score))])
    .collect_to_obj()?;
let response = json!({
    "concept": UpsertConceptConceptReturnType {
        id: uuid_str(concept.id(), &arena),
        label: concept.label(),
        name: concept.get_property("name"),
        category: concept.get_property("category"),
        relevance_score: concept.get_property("relevance_score"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetSessionsByUserInput {

pub user_key: String,
pub start: i64,
pub end_range: i64
}
#[derive(Serialize, Default)]
pub struct GetSessionsByUserSessionsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub external_id: Option<&'a Value>,
    pub start_time: Option<&'a Value>,
    pub end_time: Option<&'a Value>,
    pub duration_seconds: Option<&'a Value>,
    pub screenshot_count: Option<&'a Value>,
    pub workflow_primary: Option<&'a Value>,
    pub workflow_secondary: Option<&'a Value>,
    pub workflow_confidence: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler]
pub fn GetSessionsByUser (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetSessionsByUserInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let sessions = G::new(&db, &txn, &arena)
.n_from_type("User")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.user_key.clone()))
                } else {
                    Ok(false)
                }
            })

.out_node("UserOwnsSession")

.range(data.start.clone(), data.end_range.clone()).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "sessions": sessions.iter().map(|session| GetSessionsByUserSessionsReturnType {
        id: uuid_str(session.id(), &arena),
        label: session.label(),
        external_id: session.get_property("external_id"),
        start_time: session.get_property("start_time"),
        end_time: session.get_property("end_time"),
        duration_seconds: session.get_property("duration_seconds"),
        screenshot_count: session.get_property("screenshot_count"),
        workflow_primary: session.get_property("workflow_primary"),
        workflow_secondary: session.get_property("workflow_secondary"),
        workflow_confidence: session.get_property("workflow_confidence"),
        metadata: session.get_property("metadata"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[handler]
pub fn GetActivityCount (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let count = G::new(&db, &txn, &arena)
.n_from_type("Activity")

.count_to_val();
let response = json!({
    "count": count

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
    pub title: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler]
pub fn GetTimelineNodesByUser (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetTimelineNodesByUserInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let nodes = G::new(&db, &txn, &arena)
.n_from_type("User")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.user_key.clone()))
                } else {
                    Ok(false)
                }
            })

.out_node("UserOwnsNode").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "nodes": nodes.iter().map(|node| GetTimelineNodesByUserNodesReturnType {
        id: uuid_str(node.id(), &arena),
        label: node.label(),
        external_id: node.get_property("external_id"),
        node_type: node.get_property("node_type"),
        title: node.get_property("title"),
        metadata: node.get_property("metadata"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
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
    pub intent_label: Option<&'a Value>,
    pub primary_tool: Option<&'a Value>,
    pub occurrence_count: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler]
pub fn GetBlocksByUser (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetBlocksByUserInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let blocks = G::new(&db, &txn, &arena)
.n_from_type("User")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.user_id.clone()))
                } else {
                    Ok(false)
                }
            })

.out_node("UserHasBlock").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "blocks": blocks.iter().map(|block| GetBlocksByUserBlocksReturnType {
        id: uuid_str(block.id(), &arena),
        label: block.label(),
        canonical_slug: block.get_property("canonical_slug"),
        intent_label: block.get_property("intent_label"),
        primary_tool: block.get_property("primary_tool"),
        occurrence_count: block.get_property("occurrence_count"),
        metadata: block.get_property("metadata"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetCrossSessionConceptsInput {

pub user_key: String
}
#[derive(Serialize, Default)]
pub struct GetCrossSessionConceptsConceptsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub name: Option<&'a Value>,
    pub category: Option<&'a Value>,
    pub relevance_score: Option<&'a Value>,
}

#[handler]
pub fn GetCrossSessionConcepts (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetCrossSessionConceptsInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let concepts = G::new(&db, &txn, &arena)
.n_from_type("User")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.user_key.clone()))
                } else {
                    Ok(false)
                }
            })

.out_node("UserOwnsSession")

.in_node("ActivityInSession")

.out_node("ActivityRelatedToConcept").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "concepts": concepts.iter().map(|concept| GetCrossSessionConceptsConceptsReturnType {
        id: uuid_str(concept.id(), &arena),
        label: concept.label(),
        name: concept.get_property("name"),
        category: concept.get_property("category"),
        relevance_score: concept.get_property("relevance_score"),
    }).collect::<Vec<_>>()
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
pub metadata: String
}
#[derive(Serialize, Default)]
pub struct UpsertTimelineNodeNodeReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub external_id: Option<&'a Value>,
    pub node_type: Option<&'a Value>,
    pub title: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
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
    .upsert_n("TimelineNode", &[("external_id", Value::from(&data.external_id)), ("node_type", Value::from(&data.node_type)), ("title", Value::from(&data.title)), ("metadata", Value::from(&data.metadata))])
    .collect_to_obj()?;
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
    {
    let mut edge = Vec::new();
    for from_val in user.iter() {
        let e = G::new_mut(&db, &arena, &mut txn)
            .add_edge("UserOwnsNode", None, from_val.id(), node.id(), false, false)
            .collect_to_obj()?;
        edge.push(e);
    }
    edge
};
let response = json!({
    "node": UpsertTimelineNodeNodeReturnType {
        id: uuid_str(node.id(), &arena),
        label: node.label(),
        external_id: node.get_property("external_id"),
        node_type: node.get_property("node_type"),
        title: node.get_property("title"),
        metadata: node.get_property("metadata"),
    }
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
    pub name: Option<&'a Value>,
    pub entity_type: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler]
pub fn GetCrossSessionContext (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetCrossSessionContextInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let entities = G::new(&db, &txn, &arena)
.n_from_type("User")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.user_key.clone()))
                } else {
                    Ok(false)
                }
            })

.out_node("UserOwnsSession")

.in_node("ActivityInSession")

.out_node("ActivityMentionsEntity").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "entities": entities.iter().map(|entitie| GetCrossSessionContextEntitiesReturnType {
        id: uuid_str(entitie.id(), &arena),
        label: entitie.label(),
        name: entitie.get_property("name"),
        entity_type: entitie.get_property("entity_type"),
        metadata: entitie.get_property("metadata"),
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
    pub occurrence_count: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler]
pub fn GetWorkflowPatterns (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetWorkflowPatternsInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let patterns = G::new(&db, &txn, &arena)
.n_from_type("User")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.user_id.clone()))
                } else {
                    Ok(false)
                }
            })

.out_node("UserHasPattern").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "patterns": patterns.iter().map(|pattern| GetWorkflowPatternsPatternsReturnType {
        id: uuid_str(pattern.id(), &arena),
        label: pattern.label(),
        intent_category: pattern.get_property("intent_category"),
        occurrence_count: pattern.get_property("occurrence_count"),
        metadata: pattern.get_property("metadata"),
    }).collect::<Vec<_>>()
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
    pub external_id: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler]
pub fn GetUserByExternalId (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetUserByExternalIdInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let user = G::new(&db, &txn, &arena)
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
let response = json!({
    "user": user.iter().map(|user| GetUserByExternalIdUserReturnType {
        id: uuid_str(user.id(), &arena),
        label: user.label(),
        external_id: user.get_property("external_id"),
        metadata: user.get_property("metadata"),
    }).collect::<Vec<_>>()
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
    pub external_id: Option<&'a Value>,
    pub start_time: Option<&'a Value>,
    pub end_time: Option<&'a Value>,
    pub duration_seconds: Option<&'a Value>,
    pub screenshot_count: Option<&'a Value>,
    pub workflow_primary: Option<&'a Value>,
    pub workflow_secondary: Option<&'a Value>,
    pub workflow_confidence: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler]
pub fn GetSessionsByNode (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetSessionsByNodeInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let sessions = G::new(&db, &txn, &arena)
.n_from_type("TimelineNode")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.node_key.clone()))
                } else {
                    Ok(false)
                }
            })

.in_node("SessionInNode").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "sessions": sessions.iter().map(|session| GetSessionsByNodeSessionsReturnType {
        id: uuid_str(session.id(), &arena),
        label: session.label(),
        external_id: session.get_property("external_id"),
        start_time: session.get_property("start_time"),
        end_time: session.get_property("end_time"),
        duration_seconds: session.get_property("duration_seconds"),
        screenshot_count: session.get_property("screenshot_count"),
        workflow_primary: session.get_property("workflow_primary"),
        workflow_secondary: session.get_property("workflow_secondary"),
        workflow_confidence: session.get_property("workflow_confidence"),
        metadata: session.get_property("metadata"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetEntityOccurrencesInput {

pub entity_name: String
}
#[derive(Serialize, Default)]
pub struct GetEntityOccurrencesActivitiesReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub screenshot_external_id: Option<&'a Value>,
    pub workflow_tag: Option<&'a Value>,
    pub timestamp: Option<&'a Value>,
    pub summary: Option<&'a Value>,
    pub confidence: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler]
pub fn GetEntityOccurrences (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetEntityOccurrencesInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let activities = G::new(&db, &txn, &arena)
.n_from_index("Entity", "name", &data.entity_name)

.in_node("ActivityMentionsEntity").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "activities": activities.iter().map(|activitie| GetEntityOccurrencesActivitiesReturnType {
        id: uuid_str(activitie.id(), &arena),
        label: activitie.label(),
        screenshot_external_id: activitie.get_property("screenshot_external_id"),
        workflow_tag: activitie.get_property("workflow_tag"),
        timestamp: activitie.get_property("timestamp"),
        summary: activitie.get_property("summary"),
        confidence: activitie.get_property("confidence"),
        metadata: activitie.get_property("metadata"),
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
pub timestamp: DateTime<Utc>,
pub summary: String,
pub confidence: f64,
pub metadata: String
}
#[derive(Serialize, Default)]
pub struct UpsertActivityActivityReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub screenshot_external_id: Option<&'a Value>,
    pub workflow_tag: Option<&'a Value>,
    pub timestamp: Option<&'a Value>,
    pub summary: Option<&'a Value>,
    pub confidence: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
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
    .upsert_n("Activity", &[("screenshot_external_id", Value::from(&data.screenshot_external_id)), ("workflow_tag", Value::from(&data.workflow_tag)), ("timestamp", Value::from(&data.timestamp)), ("summary", Value::from(&data.summary)), ("confidence", Value::from(&data.confidence)), ("metadata", Value::from(&data.metadata))])
    .collect_to_obj()?;
let response = json!({
    "activity": UpsertActivityActivityReturnType {
        id: uuid_str(activity.id(), &arena),
        label: activity.label(),
        screenshot_external_id: activity.get_property("screenshot_external_id"),
        workflow_tag: activity.get_property("workflow_tag"),
        timestamp: activity.get_property("timestamp"),
        summary: activity.get_property("summary"),
        confidence: activity.get_property("confidence"),
        metadata: activity.get_property("metadata"),
    }
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
    pub screenshot_external_id: Option<&'a Value>,
    pub workflow_tag: Option<&'a Value>,
    pub timestamp: Option<&'a Value>,
    pub summary: Option<&'a Value>,
    pub confidence: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler]
pub fn GetActivitiesBySession (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetActivitiesBySessionInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let activities = G::new(&db, &txn, &arena)
.n_from_type("Session")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.session_key.clone()))
                } else {
                    Ok(false)
                }
            })

.in_node("ActivityInSession").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "activities": activities.iter().map(|activitie| GetActivitiesBySessionActivitiesReturnType {
        id: uuid_str(activitie.id(), &arena),
        label: activitie.label(),
        screenshot_external_id: activitie.get_property("screenshot_external_id"),
        workflow_tag: activitie.get_property("workflow_tag"),
        timestamp: activitie.get_property("timestamp"),
        summary: activitie.get_property("summary"),
        confidence: activitie.get_property("confidence"),
        metadata: activitie.get_property("metadata"),
    }).collect::<Vec<_>>()
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
    pub occurrence_count: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
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
        occurrence_count: pattern.get_property("occurrence_count"),
        metadata: pattern.get_property("metadata"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetAllSessionsExcludingUserInput {

pub exclude_user_key: String,
pub start: i64,
pub end_range: i64
}
#[derive(Serialize, Default)]
pub struct GetAllSessionsExcludingUserSessionsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub external_id: Option<&'a Value>,
    pub start_time: Option<&'a Value>,
    pub end_time: Option<&'a Value>,
    pub duration_seconds: Option<&'a Value>,
    pub screenshot_count: Option<&'a Value>,
    pub workflow_primary: Option<&'a Value>,
    pub workflow_secondary: Option<&'a Value>,
    pub workflow_confidence: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler]
pub fn GetAllSessionsExcludingUser (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetAllSessionsExcludingUserInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let sessions = G::new(&db, &txn, &arena)
.n_from_type("Session")

.range(data.start.clone(), data.end_range.clone()).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "sessions": sessions.iter().map(|session| GetAllSessionsExcludingUserSessionsReturnType {
        id: uuid_str(session.id(), &arena),
        label: session.label(),
        external_id: session.get_property("external_id"),
        start_time: session.get_property("start_time"),
        end_time: session.get_property("end_time"),
        duration_seconds: session.get_property("duration_seconds"),
        screenshot_count: session.get_property("screenshot_count"),
        workflow_primary: session.get_property("workflow_primary"),
        workflow_secondary: session.get_property("workflow_secondary"),
        workflow_confidence: session.get_property("workflow_confidence"),
        metadata: session.get_property("metadata"),
    }).collect::<Vec<_>>()
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
#[handler(is_write)]
pub fn LinkActivityToEntity (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<LinkActivityToEntityInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let activity = G::new(&db, &txn, &arena)
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
    let entity = G::new(&db, &txn, &arena)
.n_from_index("Entity", "name", &data.entity_name).collect_to_obj()?;
    {
    let mut edge = Vec::new();
    for from_val in activity.iter() {
        let e = G::new_mut(&db, &arena, &mut txn)
            .add_edge("ActivityMentionsEntity", None, from_val.id(), entity.id(), false, false)
            .collect_to_obj()?;
        edge.push(e);
    }
    edge
};
let response = json!({
    "data": "Success"
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[handler]
pub fn HealthCheck (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
let response = json!({
    "data": "OK"
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetRelatedSessionsInput {

pub session_external_id: String
}
#[derive(Serialize, Default)]
pub struct GetRelatedSessionsSessionsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub external_id: Option<&'a Value>,
    pub start_time: Option<&'a Value>,
    pub end_time: Option<&'a Value>,
    pub duration_seconds: Option<&'a Value>,
    pub screenshot_count: Option<&'a Value>,
    pub workflow_primary: Option<&'a Value>,
    pub workflow_secondary: Option<&'a Value>,
    pub workflow_confidence: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler]
pub fn GetRelatedSessions (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetRelatedSessionsInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let sessions = G::new(&db, &txn, &arena)
.n_from_type("Session")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.session_external_id.clone()))
                } else {
                    Ok(false)
                }
            })

.out_node("SessionInNode")

.in_node("SessionInNode").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "sessions": sessions.iter().map(|session| GetRelatedSessionsSessionsReturnType {
        id: uuid_str(session.id(), &arena),
        label: session.label(),
        external_id: session.get_property("external_id"),
        start_time: session.get_property("start_time"),
        end_time: session.get_property("end_time"),
        duration_seconds: session.get_property("duration_seconds"),
        screenshot_count: session.get_property("screenshot_count"),
        workflow_primary: session.get_property("workflow_primary"),
        workflow_secondary: session.get_property("workflow_secondary"),
        workflow_confidence: session.get_property("workflow_confidence"),
        metadata: session.get_property("metadata"),
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
    pub name: Option<&'a Value>,
    pub entity_type: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler(is_write)]
pub fn UpsertEntity (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<UpsertEntityInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let existing = G::new(&db, &txn, &arena)
.n_from_index("Entity", "name", &data.name).collect_to_obj()?;
    let entity = G::new_mut_from(&db, &mut txn, existing.clone(), &arena)
    .upsert_n("Entity", &[("name", Value::from(&data.name)), ("entity_type", Value::from(&data.entity_type)), ("metadata", Value::from(&data.metadata))])
    .collect_to_obj()?;
let response = json!({
    "entity": UpsertEntityEntityReturnType {
        id: uuid_str(entity.id(), &arena),
        label: entity.label(),
        name: entity.get_property("name"),
        entity_type: entity.get_property("entity_type"),
        metadata: entity.get_property("metadata"),
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
pub occurrence_count: i64,
pub metadata: String
}
#[derive(Serialize, Default)]
pub struct UpsertBlockBlockReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub canonical_slug: Option<&'a Value>,
    pub intent_label: Option<&'a Value>,
    pub primary_tool: Option<&'a Value>,
    pub occurrence_count: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
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
    .upsert_n("Block", &[("canonical_slug", Value::from(&data.canonical_slug)), ("intent_label", Value::from(&data.intent_label)), ("primary_tool", Value::from(&data.primary_tool)), ("occurrence_count", Value::from(&data.occurrence_count)), ("metadata", Value::from(&data.metadata))])
    .collect_to_obj()?;
    let user = G::new(&db, &txn, &arena)
.n_from_type("User")

.filter_ref(|val, txn|{
                if let Ok(val) = val {
                    Ok(val
                    .get_property("external_id")
                    .map_or(false, |v| *v == data.user_id.clone()))
                } else {
                    Ok(false)
                }
            }).collect::<Result<Vec<_>, _>>()?;
    {
    let mut edge = Vec::new();
    for from_val in user.iter() {
        let e = G::new_mut(&db, &arena, &mut txn)
            .add_edge("UserHasBlock", None, from_val.id(), block.id(), false, false)
            .collect_to_obj()?;
        edge.push(e);
    }
    edge
};
let response = json!({
    "block": UpsertBlockBlockReturnType {
        id: uuid_str(block.id(), &arena),
        label: block.label(),
        canonical_slug: block.get_property("canonical_slug"),
        intent_label: block.get_property("intent_label"),
        primary_tool: block.get_property("primary_tool"),
        occurrence_count: block.get_property("occurrence_count"),
        metadata: block.get_property("metadata"),
    }
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
    pub title: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler]
pub fn GetTimelineNodeByExternalId (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetTimelineNodeByExternalIdInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let node = G::new(&db, &txn, &arena)
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
let response = json!({
    "node": node.iter().map(|node| GetTimelineNodeByExternalIdNodeReturnType {
        id: uuid_str(node.id(), &arena),
        label: node.label(),
        external_id: node.get_property("external_id"),
        node_type: node.get_property("node_type"),
        title: node.get_property("title"),
        metadata: node.get_property("metadata"),
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
pub start_time: DateTime<Utc>,
pub end_time: DateTime<Utc>,
pub duration_seconds: i64,
pub screenshot_count: i64,
pub workflow_primary: String,
pub workflow_secondary: String,
pub workflow_confidence: f64,
pub metadata: String
}
#[derive(Serialize, Default)]
pub struct UpsertSessionSessionReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub external_id: Option<&'a Value>,
    pub start_time: Option<&'a Value>,
    pub end_time: Option<&'a Value>,
    pub duration_seconds: Option<&'a Value>,
    pub screenshot_count: Option<&'a Value>,
    pub workflow_primary: Option<&'a Value>,
    pub workflow_secondary: Option<&'a Value>,
    pub workflow_confidence: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
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
    .upsert_n("Session", &[("external_id", Value::from(&data.external_id)), ("start_time", Value::from(&data.start_time)), ("end_time", Value::from(&data.end_time)), ("duration_seconds", Value::from(&data.duration_seconds)), ("screenshot_count", Value::from(&data.screenshot_count)), ("workflow_primary", Value::from(&data.workflow_primary)), ("workflow_secondary", Value::from(&data.workflow_secondary)), ("workflow_confidence", Value::from(&data.workflow_confidence)), ("metadata", Value::from(&data.metadata))])
    .collect_to_obj()?;
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
    {
    let mut edge = Vec::new();
    for from_val in user.iter() {
        let e = G::new_mut(&db, &arena, &mut txn)
            .add_edge("UserOwnsSession", None, from_val.id(), session.id(), false, false)
            .collect_to_obj()?;
        edge.push(e);
    }
    edge
};
let response = json!({
    "session": UpsertSessionSessionReturnType {
        id: uuid_str(session.id(), &arena),
        label: session.label(),
        external_id: session.get_property("external_id"),
        start_time: session.get_property("start_time"),
        end_time: session.get_property("end_time"),
        duration_seconds: session.get_property("duration_seconds"),
        screenshot_count: session.get_property("screenshot_count"),
        workflow_primary: session.get_property("workflow_primary"),
        workflow_secondary: session.get_property("workflow_secondary"),
        workflow_confidence: session.get_property("workflow_confidence"),
        metadata: session.get_property("metadata"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetAllSessionsForBackfillInput {

pub start: i64,
pub end_range: i64
}
#[derive(Serialize, Default)]
pub struct GetAllSessionsForBackfillSessionsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub external_id: Option<&'a Value>,
    pub start_time: Option<&'a Value>,
    pub end_time: Option<&'a Value>,
    pub duration_seconds: Option<&'a Value>,
    pub screenshot_count: Option<&'a Value>,
    pub workflow_primary: Option<&'a Value>,
    pub workflow_secondary: Option<&'a Value>,
    pub workflow_confidence: Option<&'a Value>,
    pub metadata: Option<&'a Value>,
}

#[handler]
pub fn GetAllSessionsForBackfill (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetAllSessionsForBackfillInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let sessions = G::new(&db, &txn, &arena)
.n_from_type("Session")

.range(data.start.clone(), data.end_range.clone()).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "sessions": sessions.iter().map(|session| GetAllSessionsForBackfillSessionsReturnType {
        id: uuid_str(session.id(), &arena),
        label: session.label(),
        external_id: session.get_property("external_id"),
        start_time: session.get_property("start_time"),
        end_time: session.get_property("end_time"),
        duration_seconds: session.get_property("duration_seconds"),
        screenshot_count: session.get_property("screenshot_count"),
        workflow_primary: session.get_property("workflow_primary"),
        workflow_secondary: session.get_property("workflow_secondary"),
        workflow_confidence: session.get_property("workflow_confidence"),
        metadata: session.get_property("metadata"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}


