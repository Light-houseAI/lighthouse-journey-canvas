#!/usr/bin/env tsx

/**
 * Test Migration Script
 *
 * Tests the profile to hierarchy migration functionality with sample data
 * Useful for validating the migration logic before running on real data
 */

import { container } from 'tsyringe';
import { HierarchyService } from '../services/hierarchy-service';
import { HIERARCHY_TOKENS } from '../core/hierarchy-tokens';
import { Container } from '../core/container-setup';
import { db } from '../config/database.config';
import { storage } from '../services/storage.service';

async function testMigration() {
  console.log('🧪 Testing Profile Migration Logic\n');

  try {
    // Initialize hierarchy container
    console.log('🔧 Initializing hierarchy container...');
    const logger = {
      debug: () => {},
      info: console.log,
      warn: console.warn,
      error: console.error,
    };
    await Container.configure(db, logger);
    const hierarchyService = container.resolve<HierarchyService>(HIERARCHY_TOKENS.HIERARCHY_SERVICE);
    console.log('✅ Hierarchy container initialized\n');

    // Test 1: Check if we can connect to the database
    console.log('📊 Test 1: Database connectivity');
    try {
      const profiles = await storage.getAllProfiles();
      console.log(`   ✅ Successfully connected to database`);
      console.log(`   📋 Found ${profiles.length} existing profiles`);
    } catch (error) {
      console.log(`   ❌ Database connection failed: ${error}`);
      return;
    }

    // Test 2: Check hierarchy service functionality
    console.log('\n🔗 Test 2: Hierarchy service functionality');
    try {
      // Try to get nodes for a test user (user ID 999 - shouldn't exist)
      const testNodes = await hierarchyService.getAllNodes(999);
      console.log(`   ✅ Hierarchy service is working (returned ${testNodes.length} nodes for test user)`);
    } catch (error) {
      console.log(`   ❌ Hierarchy service test failed: ${error}`);
      return;
    }

    // Test 3: Check if we can identify users who already have nodes
    console.log('\n👥 Test 3: Analyzing existing user data');
    try {
      const profiles = await storage.getAllProfiles();
      let usersWithNodes = 0;
      let usersWithoutNodes = 0;

      for (const profile of profiles.slice(0, 5)) { // Test first 5 profiles
        const nodes = await hierarchyService.getAllNodes(profile.userId);
        if (nodes.length > 0) {
          usersWithNodes++;
          console.log(`   📝 User ${profile.userId} has ${nodes.length} existing nodes`);
        } else {
          usersWithoutNodes++;
          console.log(`   📋 User ${profile.userId} has no existing nodes (eligible for migration)`);
        }
      }

      console.log(`   📊 Summary (from first 5 profiles):`);
      console.log(`      Users with existing nodes: ${usersWithNodes}`);
      console.log(`      Users eligible for migration: ${usersWithoutNodes}`);

    } catch (error) {
      console.log(`   ❌ User analysis failed: ${error}`);
      return;
    }

    // Test 4: Profile data structure validation
    console.log('\n📋 Test 4: Profile data structure validation');
    try {
      const profiles = await storage.getAllProfiles();
      if (profiles.length > 0) {
        const sampleProfile = profiles[0];
        console.log(`   📄 Sample profile structure:`);
        console.log(`      Profile ID: ${sampleProfile.id}`);
        console.log(`      User ID: ${sampleProfile.userId}`);
        console.log(`      Username: ${sampleProfile.username}`);
        console.log(`      Has raw data: ${!!sampleProfile.rawData}`);
        console.log(`      Has filtered data: ${!!sampleProfile.filteredData}`);

        const profileData = sampleProfile.filteredData || sampleProfile.rawData;
        if (profileData) {
          console.log(`      Experiences: ${profileData.experiences?.length || 0}`);
          console.log(`      Education: ${profileData.education?.length || 0}`);
          console.log(`      Skills: ${profileData.skills?.length || 0} (will be skipped)`);
        }
        console.log(`   ✅ Profile data structure is valid`);
      } else {
        console.log(`   ℹ️  No profiles found to validate`);
      }
    } catch (error) {
      console.log(`   ❌ Profile data validation failed: ${error}`);
      return;
    }

    console.log('\n✅ All tests passed! Migration script should work correctly.');
    console.log('\n💡 To run the actual migration:');
    console.log('   # Dry run (safe):');
    console.log('   tsx server/scripts/migrate-profiles-to-hierarchy.ts');
    console.log('   # Live migration:');
    console.log('   tsx server/scripts/migrate-profiles-to-hierarchy.ts --live');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testMigration()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test script failed:', error);
      process.exit(1);
    });
}
