#!/usr/bin/env tsx

/**
 * Organization Population Script
 *
 * This script extracts organization information from timeline_nodes and populates:
 * 1. organizations table - creates organizations from job/education nodes
 * 2. org_members table - associates users with organizations they've worked at/studied at
 *
 * Run with: NODE_ENV=development npx tsx server/scripts/populate-organizations.ts
 */

import { and, eq, inArray,sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import {
  organizations,
  OrganizationType,
  OrgMemberRole,
  orgMembers,
  timelineNodes} from '../../shared/schema';

interface ProcessedOrg {
  id: number;
  name: string;
  type: OrganizationType;
  users: Array<{
    userId: number;
    nodeId: string;
    nodeType: 'job' | 'education';
  }>;
}

async function main() {
  console.log('🚀 Starting organization population script...');

  // Database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
  });

  const db = drizzle(pool);

  try {
    // Step 1: Extract organization data from timeline nodes
    console.log('📊 Extracting organization data from timeline nodes...');

    const jobEducationNodes = await db
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
          sql`(${timelineNodes.meta}->>'company' IS NOT NULL OR ${timelineNodes.meta}->>'institution' IS NOT NULL)`
        )
      );

    console.log(`Found ${jobEducationNodes.length} timeline nodes with organization data`);

    // Step 2: Process and deduplicate organizations by name
    const organizationMap = new Map<string, ProcessedOrg & { autoId: number }>();
    let autoId = 1;

    for (const node of jobEducationNodes) {
      const meta = node.meta as any;
      const orgName = (meta.company || meta.institution || '').trim().toLowerCase();

      if (!orgName) continue;

      const displayName = meta.company || meta.institution;
      const orgType = node.type === 'job' ? OrganizationType.Company : OrganizationType.EducationalInstitution;

      if (!organizationMap.has(orgName)) {
        organizationMap.set(orgName, {
          id: 0, // Will be set after DB insertion
          autoId: autoId++,
          name: displayName,
          type: orgType,
          users: []
        });
      }

      const org = organizationMap.get(orgName)!;
      org.users.push({
        userId: node.userId,
        nodeId: node.id,
        nodeType: node.type as 'job' | 'education'
      });
    }

    console.log(`📋 Found ${organizationMap.size} unique organizations`);

    // Step 3: Check which organizations already exist by name
    const existingOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.name
      })
      .from(organizations);

    const existingOrgsByName = new Map(
      existingOrgs.map(org => [org.name.toLowerCase(), org.id])
    );
    console.log(`✅ ${existingOrgsByName.size} organizations already exist in database`);

    // Step 4: Create missing organizations and get their IDs
    const orgList = Array.from(organizationMap.values());
    console.log(`➕ Processing ${orgList.length} organizations...`);

    for (const org of orgList) {
      const normalizedName = org.name.toLowerCase();

      if (existingOrgsByName.has(normalizedName)) {
        // Organization exists, use existing ID
        org.id = existingOrgsByName.get(normalizedName)!;
        console.log(`   ✓ Found existing: ${org.name} (ID: ${org.id})`);
      } else {
        // Create new organization
        try {
          const [newOrg] = await db.insert(organizations).values({
            name: org.name,
            type: org.type,
            metadata: {}
          }).returning({ id: organizations.id });

          org.id = newOrg.id;
          console.log(`   ➕ Created: ${org.name} (ID: ${org.id}, Type: ${org.type})`);
        } catch (error) {
          console.error(`   ❌ Failed to create ${org.name}:`, error);
          continue;
        }
      }
    }

    // Step 5: Update timeline nodes with orgId
    console.log('🔄 Updating timeline nodes with orgId...');

    let updatedNodes = 0;

    for (const org of orgList) {
      if (org.id === 0) continue; // Skip failed organizations

      for (const user of org.users) {
        try {
          const currentNode = await db
            .select({ meta: timelineNodes.meta })
            .from(timelineNodes)
            .where(eq(timelineNodes.id, user.nodeId))
            .limit(1);

          if (currentNode.length > 0) {
            const updatedMeta = {
              ...currentNode[0].meta,
              orgId: org.id
            };

            await db
              .update(timelineNodes)
              .set({ meta: updatedMeta })
              .where(eq(timelineNodes.id, user.nodeId));

            updatedNodes++;
          }
        } catch (error) {
          console.error(`   ❌ Failed to update node ${user.nodeId}:`, error);
        }
      }
    }

    console.log(`✅ Updated ${updatedNodes} timeline nodes with orgId`);

    // Step 6: Update org_members table
    console.log('👥 Processing organization memberships...');

    // Get existing memberships to avoid duplicates
    const existingMemberships = await db
      .select({
        orgId: orgMembers.orgId,
        userId: orgMembers.userId
      })
      .from(orgMembers);

    const membershipSet = new Set(
      existingMemberships.map(m => `${m.orgId}-${m.userId}`)
    );

    let newMemberships = 0;
    let skippedMemberships = 0;

    for (const org of orgList) {
      if (org.id === 0) continue; // Skip failed organizations
      // Deduplicate users within each organization
      const uniqueUsers = new Map<number, { userId: number; nodeId: string; nodeType: 'job' | 'education' }>();

      for (const user of org.users) {
        if (!uniqueUsers.has(user.userId)) {
          uniqueUsers.set(user.userId, user);
        }
      }

      for (const user of Array.from(uniqueUsers.values())) {
        const membershipKey = `${org.id}-${user.userId}`;

        if (!membershipSet.has(membershipKey)) {
          try {
            await db.insert(orgMembers).values({
              orgId: org.id,
              userId: user.userId,
              role: OrgMemberRole.Member
            });

            newMemberships++;
            console.log(`   ✓ Added membership: User ${user.userId} → ${org.name}`);
          } catch (error) {
            console.error(`   ❌ Failed to add membership for User ${user.userId} → ${org.name}:`, error);
          }
        } else {
          skippedMemberships++;
        }
      }
    }

    console.log(`✅ Processed memberships: ${newMemberships} created, ${skippedMemberships} skipped (already exist)`);

    // Step 7: Summary statistics
    console.log('\n📊 Final Summary:');

    const totalOrgs = await db.select({ count: sql<number>`count(*)` }).from(organizations);
    const totalMembers = await db.select({ count: sql<number>`count(*)` }).from(orgMembers);

    console.log(`   Organizations in database: ${totalOrgs[0].count}`);
    console.log(`   Total memberships: ${totalMembers[0].count}`);

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

    console.log('\n🎉 Organization population completed successfully!');

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
