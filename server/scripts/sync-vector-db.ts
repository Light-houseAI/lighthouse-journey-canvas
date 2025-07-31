#!/usr/bin/env tsx
/**
 * Vector Database Sync Script
 *
 * This script can be used to check and sync the vector database with the current profile data
 * when using the actual DATABASE_URL (production/development environment).
 *
 * Usage:
 *   npx tsx server/scripts/sync-vector-db.ts --check --userId=123
 *   npx tsx server/scripts/sync-vector-db.ts --sync --userId=123
 *   npx tsx server/scripts/sync-vector-db.ts --sync --userId=123 --force
 */

import { Command } from 'commander';
import { profileVectorManager } from '../services/ai/profile-vector-manager.js';
import { db } from '../db.js';
import { profiles } from "@shared/schema";
import { eq } from 'drizzle-orm';

const program = new Command();

program
  .name('sync-vector-db')
  .description('Check and sync vector database with profile data')
  .option('-c, --check', 'Check if vector database is in sync')
  .option('-s, --sync', 'Sync vector database with profile data')
  .option('-f, --force', 'Force sync even if already in sync')
  .option('-u, --userId <userId>', 'User ID to sync (required)')
  .option('-a, --all', 'Process all users (use with caution)')
  .parse(process.argv);

const options = program.opts();

async function getProfileData(userId: string) {
  const result = await db.select()
    .from(profiles)
    .where(eq(profiles.userId, parseInt(userId)))
    .limit(1);

  if (result.length === 0) {
    throw new Error(`No profile found for user ${userId}`);
  }

  return result[0].filteredData;
}

async function getAllUserIds(): Promise<string[]> {
  const result = await db.select({ userId: profiles.userId }).from(profiles);
  return result.map(r => r.userId.toString());
}

async function checkUserSync(userId: string) {
  console.log(`\n🔍 Checking vector sync for user ${userId}...`);

  try {
    const profileData = await getProfileData(userId);
    if (!profileData) {
      console.log(`❌ No profile data found for user ${userId}`);
      return false;
    }

    const syncStatus = await profileVectorManager.checkVectorProfileSync(userId, profileData);

    if (syncStatus.inSync) {
      console.log(`✅ User ${userId} is in sync`);
    } else {
      console.log(`⚠️ User ${userId} is NOT in sync:`);
      if (syncStatus.missingIds.length > 0) {
        console.log(`  - Missing from vectors: ${syncStatus.missingIds.length} experiences`);
        console.log(`    IDs: ${syncStatus.missingIds.slice(0, 5).join(', ')}${syncStatus.missingIds.length > 5 ? '...' : ''}`);
      }
      if (syncStatus.staleIds.length > 0) {
        console.log(`  - Stale in vectors: ${syncStatus.staleIds.length} experiences`);
        console.log(`    IDs: ${syncStatus.staleIds.slice(0, 5).join(', ')}${syncStatus.staleIds.length > 5 ? '...' : ''}`);
      }
    }

    return syncStatus.inSync;
  } catch (error) {
    console.error(`❌ Error checking user ${userId}:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function syncUser(userId: string, force: boolean = false) {
  console.log(`\n🔄 Syncing vector database for user ${userId}...`);

  try {
    const profileData = await getProfileData(userId);
    if (!profileData) {
      console.log(`❌ No profile data found for user ${userId}`);
      return false;
    }

    await profileVectorManager.syncVectorWithProfile(userId, profileData, { force });
    console.log(`✅ Successfully synced user ${userId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error syncing user ${userId}:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function main() {
  if (!options.userId && !options.all) {
    console.error('❌ Either --userId or --all must be specified');
    process.exit(1);
  }

  if (options.userId && options.all) {
    console.error('❌ Cannot specify both --userId and --all');
    process.exit(1);
  }

  if (!options.check && !options.sync) {
    console.error('❌ Either --check or --sync must be specified');
    process.exit(1);
  }

  const userIds = options.all ? (await getAllUserIds()) : [options.userId];

  console.log(`🚀 Processing ${userIds.length} user(s)${options.force ? ' (forced)' : ''}...`);

  let totalChecked = 0;
  let inSyncCount = 0;
  let syncedCount = 0;

  for (const userId of userIds) {
    if (options.check) {
      const inSync = await checkUserSync(userId);
      totalChecked++;
      if (inSync) inSyncCount++;
    }

    if (options.sync) {
      const synced = await syncUser(userId, options.force);
      if (synced) syncedCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  if (options.check) {
    console.log(`  - Users checked: ${totalChecked}`);
    console.log(`  - Users in sync: ${inSyncCount}`);
    console.log(`  - Users out of sync: ${totalChecked - inSyncCount}`);
  }
  if (options.sync) {
    console.log(`  - Users synced: ${syncedCount}`);
    console.log(`  - Users failed: ${userIds.length - syncedCount}`);
  }

  process.exit(0);
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
