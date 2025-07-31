#!/usr/bin/env tsx
/**
 * Test Experience Vector Sync
 *
 * This script tests if new experiences are properly stored in the vector database
 * with the correct IDs when using the addExperience tool.
 */

import { processCareerConversation } from '../services/ai/simplified-career-agent.js';
import { profileVectorManager } from '../services/ai/profile-vector-manager.js';
import { db } from '../db.js';
import { profiles } from "@shared/schema".js';
import { eq } from 'drizzle-orm';

async function testAddExperienceVectorSync(userId: string) {
  console.log(`🧪 Testing addExperience vector sync for user ${userId}...`);

  try {
    // Get initial sync status
    console.log('\n1️⃣ Checking initial sync status...');
    const profileResult = await db.select()
      .from(profiles)
      .where(eq(profiles.userId, parseInt(userId)))
      .limit(1);

    if (profileResult.length === 0) {
      throw new Error(`No profile found for user ${userId}`);
    }

    const initialProfileData = profileResult[0].filteredData;
    const initialSyncStatus = await profileVectorManager.checkVectorProfileSync(userId, initialProfileData);

    console.log(`Initial sync status: ${initialSyncStatus.inSync ? '✅ In sync' : '❌ Out of sync'}`);
    console.log(`Initial experiences: ${initialProfileData?.experiences?.length || 0}`);

    // Add a new experience using the career agent
    console.log('\n2️⃣ Adding new experience via career agent...');
    const testMessage = `Add my new role as Senior DevOps Engineer at DockerCorp starting January 2025`;

    const result = await processCareerConversation({
      message: testMessage,
      userId: userId,
      threadId: `test-${Date.now()}`
    });

    console.log(`Agent response: ${result.response}`);
    console.log(`Profile updated: ${result.updatedProfile}`);

    // Check final sync status
    console.log('\n3️⃣ Checking final sync status...');
    const finalProfileResult = await db.select()
      .from(profiles)
      .where(eq(profiles.userId, parseInt(userId)))
      .limit(1);

    const finalProfileData = finalProfileResult[0].filteredData;
    const finalSyncStatus = await profileVectorManager.checkVectorProfileSync(userId, finalProfileData);

    console.log(`Final sync status: ${finalSyncStatus.inSync ? '✅ In sync' : '❌ Out of sync'}`);
    console.log(`Final experiences: ${finalProfileData?.experiences?.length || 0}`);

    // Check if a new experience was added
    const experienceCountChange = (finalProfileData?.experiences?.length || 0) - (initialProfileData?.experiences?.length || 0);
    console.log(`Experience count change: ${experienceCountChange > 0 ? '+' : ''}${experienceCountChange}`);

    // Find the new experience
    if (experienceCountChange > 0) {
      const newExperiences = finalProfileData?.experiences?.slice(-(experienceCountChange)) || [];
      console.log('\n🆕 New experiences added:');
      newExperiences.forEach((exp: any, i: number) => {
        console.log(`  ${i + 1}. ID: ${exp.id}, Title: ${exp.title}, Company: ${exp.company}`);
      });
    }

    // Summary
    console.log('\n📊 Test Summary:');
    if (result.updatedProfile && finalSyncStatus.inSync && experienceCountChange > 0) {
      console.log('✅ SUCCESS: Experience was added and vector database stayed in sync!');
    } else if (!result.updatedProfile) {
      console.log('⚠️ NEUTRAL: No experience was added (possibly due to validation/clarification)');
    } else if (!finalSyncStatus.inSync) {
      console.log(`❌ FAILED: Vector database is out of sync after adding experience`);
      console.log(`   Missing from vectors: ${finalSyncStatus.missingIds.length}`);
      console.log(`   Stale in vectors: ${finalSyncStatus.staleIds.length}`);
    } else {
      console.log('❓ UNCLEAR: Unexpected result state');
    }

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}

// Parse command line arguments
const userId = process.argv[2];
if (!userId) {
  console.error('❌ Usage: tsx server/scripts/test-experience-sync.ts <userId>');
  process.exit(1);
}

console.log(`🚀 Starting experience sync test for user ${userId}...`);

testAddExperienceVectorSync(userId)
  .then(() => {
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
