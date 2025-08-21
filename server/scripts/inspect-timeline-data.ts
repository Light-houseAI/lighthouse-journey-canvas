#!/usr/bin/env tsx

/**
 * Timeline Data Inspection Script
 * 
 * This script inspects timeline_nodes to understand the current data structure
 * and help determine what needs to be done for organization population
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { timelineNodes } from '../../shared/schema';

async function main() {
  console.log('🔍 Inspecting timeline nodes data...');
  
  // Database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
  });
  
  const db = drizzle(pool);
  
  try {
    // Check total timeline nodes
    const totalNodes = await db
      .select({ count: sql<number>`count(*)` })
      .from(timelineNodes);
    
    console.log(`📊 Total timeline nodes: ${totalNodes[0].count}`);
    
    if (totalNodes[0].count === 0) {
      console.log('❌ No timeline nodes found in database');
      return;
    }
    
    // Check nodes by type
    const nodesByType = await db
      .select({
        type: timelineNodes.type,
        count: sql<number>`count(*)`,
      })
      .from(timelineNodes)
      .groupBy(timelineNodes.type);
    
    console.log('\n📋 Nodes by type:');
    for (const item of nodesByType) {
      console.log(`   ${item.type}: ${item.count}`);
    }
    
    // Sample a few nodes to see their structure
    const sampleNodes = await db
      .select({
        id: timelineNodes.id,
        type: timelineNodes.type,
        meta: timelineNodes.meta,
        userId: timelineNodes.userId,
      })
      .from(timelineNodes)
      .limit(5);
    
    console.log('\n🔬 Sample nodes metadata:');
    for (const node of sampleNodes) {
      console.log(`\n   Node ${node.id} (${node.type}, User ${node.userId}):`);
      console.log(`   Meta:`, JSON.stringify(node.meta, null, 4));
    }
    
    // Check for nodes that might contain organization info
    const jobEducationNodes = await db
      .select({
        id: timelineNodes.id,
        type: timelineNodes.type,
        meta: timelineNodes.meta,
        userId: timelineNodes.userId,
      })
      .from(timelineNodes)
      .where(inArray(timelineNodes.type, ['job', 'education']))
      .limit(10);
    
    if (jobEducationNodes.length > 0) {
      console.log('\n💼 Job/Education nodes:');
      for (const node of jobEducationNodes) {
        console.log(`\n   ${node.type.toUpperCase()} ${node.id} (User ${node.userId}):`);
        console.log(`   Meta:`, JSON.stringify(node.meta, null, 4));
        
        // Check for organization-related fields
        const meta = node.meta as any;
        const orgFields = ['orgId', 'organizationId', 'company', 'companyName', 'school', 'schoolName', 'institution'];
        const foundFields = orgFields.filter(field => meta[field]);
        
        if (foundFields.length > 0) {
          console.log(`   📍 Organization fields found: ${foundFields.join(', ')}`);
        } else {
          console.log(`   ❌ No organization fields found`);
        }
      }
    }
    
    // Check for nodes with orgId specifically
    const nodesWithOrgId = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(timelineNodes)
      .where(sql`${timelineNodes.meta}->>'orgId' IS NOT NULL`);
    
    console.log(`\n🏢 Nodes with orgId: ${nodesWithOrgId[0].count}`);
    
    // Check for nodes with any company/organization references
    const nodesWithCompanyInfo = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(timelineNodes)
      .where(
        sql`${timelineNodes.meta}->>'company' IS NOT NULL OR ${timelineNodes.meta}->>'companyName' IS NOT NULL OR ${timelineNodes.meta}->>'school' IS NOT NULL OR ${timelineNodes.meta}->>'schoolName' IS NOT NULL`
      );
    
    console.log(`🏢 Nodes with company/school names: ${nodesWithCompanyInfo[0].count}`);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };