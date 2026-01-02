#!/usr/bin/env npx tsx

/**
 * Quick script to check what blocks and edges exist in ArangoDB
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { aql } from 'arangojs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { ArangoDBConnection } from '../config/arangodb.connection.js';

async function main() {
  console.log('Initializing ArangoDB connection...');

  const arangoConfig = {
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    database: process.env.ARANGO_DATABASE || 'lighthouse_graph',
    username: process.env.ARANGO_USERNAME || 'root',
    password: process.env.ARANGO_PASSWORD || '',
  };

  await ArangoDBConnection.initialize(arangoConfig);
  const db = await ArangoDBConnection.getConnection();

  try {
    // Check blocks
    console.log('\n=== BLOCKS ===');
    const blocksQuery = aql`
      FOR b IN blocks
        RETURN {
          key: b._key,
          name: b.canonicalName,
          occurrenceCount: b.occurrenceCount,
          confidence: b.confidence,
          userId: b.userId
        }
    `;
    const blocksCursor = await db.query(blocksQuery);
    const blocks = await blocksCursor.all();
    console.log('Total blocks:', blocks.length);
    for (const b of blocks) {
      console.log(`  ${b.key}: ${b.name} (occ: ${b.occurrenceCount}, conf: ${b.confidence}, user: ${b.userId})`);
    }

    // Check NEXT_BLOCK edges
    console.log('\n=== NEXT_BLOCK EDGES ===');
    const edgesQuery = aql`
      FOR e IN NEXT_BLOCK
        RETURN {
          from: e._from,
          to: e._to,
          frequency: e.frequency,
          probability: e.probability
        }
    `;
    const edgesCursor = await db.query(edgesQuery);
    const edges = await edgesCursor.all();
    console.log('Total edges:', edges.length);
    for (const e of edges) {
      console.log(`  ${e.from} -> ${e.to} (freq: ${e.frequency}, prob: ${e.probability})`);
    }

    // Try a simple traversal
    console.log('\n=== SIMPLE TRAVERSAL TEST ===');
    const traversalQuery = aql`
      FOR startBlock IN blocks
        LIMIT 3
        FOR v, e, p IN 1..2 OUTBOUND startBlock NEXT_BLOCK
          RETURN {
            start: startBlock.canonicalName,
            pathLength: LENGTH(p.vertices),
            endBlock: v.canonicalName
          }
    `;
    const travCursor = await db.query(traversalQuery);
    const traversals = await travCursor.all();
    console.log('Traversal results:', traversals.length);
    for (const t of traversals) {
      console.log(`  ${t.start} -> ${t.endBlock} (path length: ${t.pathLength})`);
    }

    // Test with minOccurrences = 1
    console.log('\n=== QUERY WITH minOccurrences=1, minConfidence=0 ===');
    const queryWithMinOcc = aql`
      FOR startBlock IN blocks
        FILTER startBlock.occurrenceCount >= 1
        FOR v, e, p IN 1..5 OUTBOUND startBlock NEXT_BLOCK
          OPTIONS { order: 'bfs' }
          FILTER e.frequency >= 1
          LET pathBlocks = (
            FOR vertex IN p.vertices
              RETURN {
                id: vertex._key,
                name: vertex.canonicalName,
                intent: vertex.intentLabel,
                tool: vertex.primaryTool
              }
          )
          LET pathFrequency = MIN(
            FOR edge IN p.edges
              RETURN edge.frequency
          )
          LET pathConfidence = AVG(
            FOR vertex IN p.vertices
              RETURN vertex.confidence
          )
          FILTER pathFrequency >= 1
          FILTER pathConfidence >= 0
          RETURN DISTINCT {
            blocks: pathBlocks,
            frequency: pathFrequency,
            confidence: pathConfidence,
            length: LENGTH(p.vertices)
          }
    `;
    const queryCursor = await db.query(queryWithMinOcc);
    const queryResults = await queryCursor.all();
    console.log('Query results:', queryResults.length);
    for (const r of queryResults.slice(0, 5)) {
      const blockNames = r.blocks.map((b: any) => b.name).join(' -> ');
      console.log(`  [${r.length} blocks] ${blockNames} (freq: ${r.frequency}, conf: ${r.confidence?.toFixed(2)})`);
    }

  } finally {
    console.log('\nDone!');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
