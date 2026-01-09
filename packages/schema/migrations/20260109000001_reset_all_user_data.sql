-- Migration: Reset All User Data
-- Description: Deletes all user data to allow fresh starts for all users
-- WARNING: This is a destructive migration that removes ALL user data
-- Created: 2026-01-09

-- Use DO block with exception handling to safely delete from tables that may not exist
DO $$
BEGIN
    -- Delete in order of dependencies (child tables first, then parent tables)

    -- User feedback (may not exist in all environments)
    BEGIN
        DELETE FROM user_feedback;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table user_feedback does not exist, skipping';
    END;

    -- Session classification feedback
    BEGIN
        DELETE FROM session_classification_feedback;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table session_classification_feedback does not exist, skipping';
    END;

    -- Session mappings
    BEGIN
        DELETE FROM session_mappings;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table session_mappings does not exist, skipping';
    END;

    -- Workflow screenshots
    BEGIN
        DELETE FROM workflow_screenshots;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table workflow_screenshots does not exist, skipping';
    END;

    -- Concept embeddings
    BEGIN
        DELETE FROM concept_embeddings;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table concept_embeddings does not exist, skipping';
    END;

    -- Entity embeddings
    BEGIN
        DELETE FROM entity_embeddings;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table entity_embeddings does not exist, skipping';
    END;

    -- GraphRAG edges
    BEGIN
        DELETE FROM graphrag_edges;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table graphrag_edges does not exist, skipping';
    END;

    -- GraphRAG chunks
    BEGIN
        DELETE FROM graphrag_chunks;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table graphrag_chunks does not exist, skipping';
    END;

    -- User files
    BEGIN
        DELETE FROM user_files;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table user_files does not exist, skipping';
    END;

    -- Refresh tokens
    BEGIN
        DELETE FROM refresh_tokens;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table refresh_tokens does not exist, skipping';
    END;

    -- Node policies
    BEGIN
        DELETE FROM node_policies;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table node_policies does not exist, skipping';
    END;

    -- Node insights
    BEGIN
        DELETE FROM node_insights;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table node_insights does not exist, skipping';
    END;

    -- Updates
    BEGIN
        DELETE FROM updates;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table updates does not exist, skipping';
    END;

    -- Org members
    BEGIN
        DELETE FROM org_members;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table org_members does not exist, skipping';
    END;

    -- Timeline node closure
    BEGIN
        DELETE FROM timeline_node_closure;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table timeline_node_closure does not exist, skipping';
    END;

    -- Timeline nodes
    BEGIN
        DELETE FROM timeline_nodes;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table timeline_nodes does not exist, skipping';
    END;

    -- User storage usage
    BEGIN
        DELETE FROM user_storage_usage;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table user_storage_usage does not exist, skipping';
    END;

    -- Organizations
    BEGIN
        DELETE FROM organizations;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table organizations does not exist, skipping';
    END;

    -- Users (main table - cascades to remaining dependent data)
    BEGIN
        DELETE FROM users;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table users does not exist, skipping';
    END;

    -- Reset sequences (with error handling for missing sequences)
    BEGIN
        ALTER SEQUENCE users_id_seq RESTART WITH 1;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Sequence users_id_seq does not exist, skipping';
    END;

    BEGIN
        ALTER SEQUENCE organizations_id_seq RESTART WITH 1;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Sequence organizations_id_seq does not exist, skipping';
    END;

    BEGIN
        ALTER SEQUENCE graphrag_chunks_id_seq RESTART WITH 1;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Sequence graphrag_chunks_id_seq does not exist, skipping';
    END;

    BEGIN
        ALTER SEQUENCE graphrag_edges_id_seq RESTART WITH 1;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Sequence graphrag_edges_id_seq does not exist, skipping';
    END;

    BEGIN
        ALTER SEQUENCE user_files_id_seq RESTART WITH 1;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Sequence user_files_id_seq does not exist, skipping';
    END;

    BEGIN
        ALTER SEQUENCE concept_embeddings_id_seq RESTART WITH 1;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Sequence concept_embeddings_id_seq does not exist, skipping';
    END;

    BEGIN
        ALTER SEQUENCE entity_embeddings_id_seq RESTART WITH 1;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Sequence entity_embeddings_id_seq does not exist, skipping';
    END;

    BEGIN
        ALTER SEQUENCE workflow_screenshots_id_seq RESTART WITH 1;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Sequence workflow_screenshots_id_seq does not exist, skipping';
    END;

END $$;
