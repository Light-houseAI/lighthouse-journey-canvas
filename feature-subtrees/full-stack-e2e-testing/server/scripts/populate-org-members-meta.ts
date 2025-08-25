#!/usr/bin/env tsx

/**
 * Organization Members & Meta Population Script (One-time)
 * 
 * This script is a one-time script to:
 * 1. Populate org_members table from existing orgId data in timeline_nodes
 * 2. Ensure all timeline_nodes with company/institution names have orgId in meta
 * 
 * This is a cleanup/migration script for existing data.
 * 
 * Run with: NODE_ENV=development npx tsx server/scripts/populate-org-members-meta.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql, eq, and, inArray, isNotNull } from 'drizzle-orm';
import { 
  timelineNodes, 
  organizations, 
  orgMembers,
  OrgMemberRole
} from '../../shared/schema';

async function main() {
  console.log('🚀 Starting one-time org_members & meta population script...');
  
  // Database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
  });
  
  const db = drizzle(pool);
  
  try {
    // Step 1: Get all timeline nodes with orgId in meta
    console.log('📊 Finding timeline nodes with orgId...');
    
    const nodesWithOrgId = await db
      .select({
        id: timelineNodes.id,
        type: timelineNodes.type,
        meta: timelineNodes.meta,
        userId: timelineNodes.userId,
      })
      .from(timelineNodes)
      .where(sql`${timelineNodes.meta}->>'orgId' IS NOT NULL`);

    console.log(`Found ${nodesWithOrgId.length} timeline nodes with orgId`);
    
    // Step 2: Get existing org_members to avoid duplicates
    const existingMemberships = await db
      .select({
        orgId: orgMembers.orgId,
        userId: orgMembers.userId
      })
      .from(orgMembers);
    
    const membershipSet = new Set(
      existingMemberships.map(m => `${m.orgId}-${m.userId}`)
    );
    
    console.log(`Found ${existingMemberships.length} existing memberships`);
    
    // Step 3: Create missing org_members relationships
    console.log('👥 Creating missing org_members relationships...');
    
    let newMemberships = 0;
    let skippedMemberships = 0;
    
    for (const node of nodesWithOrgId) {
      const meta = node.meta as any;
      const orgId = parseInt(meta.orgId);
      const userId = node.userId;
      
      if (!orgId || !userId) continue;
      
      const membershipKey = `${orgId}-${userId}`;
      
      if (!membershipSet.has(membershipKey)) {
        try {
          await db.insert(orgMembers).values({
            orgId: orgId,
            userId: userId,
            role: OrgMemberRole.Member
          });
          
          newMemberships++;
          console.log(`   ✓ Added membership: User ${userId} → Organization ${orgId}`);
        } catch (error) {
          console.error(`   ❌ Failed to add membership for User ${userId} → Org ${orgId}:`, error);
        }
      } else {
        skippedMemberships++;
      }
    }
    
    console.log(`✅ Processed memberships: ${newMemberships} created, ${skippedMemberships} skipped`);
    
    // Step 4: Find timeline nodes with company/institution but missing orgId
    console.log('🔍 Finding nodes with company/institution but missing orgId...');
    
    const nodesWithoutOrgId = await db
      .select({
        id: timelineNodes.id,
        type: timelineNodes.type,
        meta: timelineNodes.meta,
        userId: timelineNodes.userId,
      })
      .from(timelineNodes)
      .where(
        and(
          inArray(timelineNodes.type, ['job', 'education']),
          sql`(${timelineNodes.meta}->>'company' IS NOT NULL OR ${timelineNodes.meta}->>'institution' IS NOT NULL)`,
          sql`${timelineNodes.meta}->>'orgId' IS NULL`
        )
      );

    console.log(`Found ${nodesWithoutOrgId.length} nodes with company/institution but missing orgId`);
    
    // Step 5: Create organizations and update nodes for missing orgId
    if (nodesWithoutOrgId.length > 0) {
      console.log('🏢 Creating organizations for nodes missing orgId...');
      
      // Get existing organizations to avoid duplicates
      const existingOrgs = await db
        .select({ 
          id: organizations.id,
          name: organizations.name 
        })
        .from(organizations);
      
      const existingOrgsByName = new Map(
        existingOrgs.map(org => [org.name.toLowerCase(), org.id])
      );
      
      let nodesUpdated = 0;
      
      for (const node of nodesWithoutOrgId) {
        const meta = node.meta as any;
        const orgName = (meta.company || meta.institution || '').trim();
        
        if (!orgName) continue;
        
        const normalizedName = orgName.toLowerCase();
        let orgId: number;
        
        if (existingOrgsByName.has(normalizedName)) {
          // Use existing organization
          orgId = existingOrgsByName.get(normalizedName)!;
        } else {
          // Create new organization
          try {
            const orgType = node.type === 'job' ? 'company' : 'educational_institution';
            const [newOrg] = await db.insert(organizations).values({
              name: orgName,
              type: orgType as any,
              metadata: {}
            }).returning({ id: organizations.id });
            
            orgId = newOrg.id;
            existingOrgsByName.set(normalizedName, orgId);
            console.log(`   ➕ Created organization: ${orgName} (ID: ${orgId})`);
          } catch (error) {
            console.error(`   ❌ Failed to create organization ${orgName}:`, error);
            continue;
          }
        }
        
        // Update timeline node with orgId
        try {
          const updatedMeta = {
            ...meta,
            orgId: orgId
          };
          
          await db
            .update(timelineNodes)
            .set({ meta: updatedMeta })
            .where(eq(timelineNodes.id, node.id));
          
          nodesUpdated++;
          
          // Create org_member relationship
          const membershipKey = `${orgId}-${node.userId}`;
          if (!membershipSet.has(membershipKey)) {
            await db.insert(orgMembers).values({
              orgId: orgId,
              userId: node.userId,
              role: OrgMemberRole.Member
            });
            
            membershipSet.add(membershipKey);
            newMemberships++;
          }
          
          console.log(`   ✓ Updated node ${node.id} with orgId ${orgId}`);
        } catch (error) {
          console.error(`   ❌ Failed to update node ${node.id}:`, error);
        }
      }
      
      console.log(`✅ Updated ${nodesUpdated} nodes with orgId`);
    }
    
    // Step 6: Final statistics
    console.log('\n📊 Final Summary:');
    
    const totalOrgs = await db.select({ count: sql<number>`count(*)` }).from(organizations);
    const totalMembers = await db.select({ count: sql<number>`count(*)` }).from(orgMembers);
    const totalNodesWithOrgId = await db.select({ count: sql<number>`count(*)` }).from(timelineNodes).where(sql`${timelineNodes.meta}->>'orgId' IS NOT NULL`);
    
    console.log(`   Organizations in database: ${totalOrgs[0].count}`);
    console.log(`   Total org memberships: ${totalMembers[0].count}`);
    console.log(`   Timeline nodes with orgId: ${totalNodesWithOrgId[0].count}`);
    
    // Show organization breakdown
    const orgBreakdown = await db
      .select({
        type: organizations.type,
        count: sql<number>`count(*)`,
      })
      .from(organizations)
      .groupBy(organizations.type);
    
    console.log('\n   Organization breakdown:');
    for (const item of orgBreakdown) {
      console.log(`     ${item.type}: ${item.count}`);
    }
    
    // Show membership breakdown by organization type
    const membershipBreakdown = await db
      .select({
        orgType: organizations.type,
        memberCount: sql<number>`count(${orgMembers.userId})`,
      })
      .from(orgMembers)
      .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
      .groupBy(organizations.type);
    
    console.log('\n   Membership breakdown:');
    for (const item of membershipBreakdown) {
      console.log(`     ${item.orgType}: ${item.memberCount} members`);
    }
    
    console.log('\n🎉 One-time org_members & meta population completed successfully!');
    
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