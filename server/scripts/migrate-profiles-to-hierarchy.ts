#!/usr/bin/env tsx

/**
 * Profile to Hierarchy Migration Script
 *
 * Migrates existing profile data to the new hierarchy node structure.
 * - Reads all existing profiles from the profiles table
 * - Converts experiences to job nodes
 * - Converts education to education nodes
 * - Safely handles existing users who may already have hierarchy nodes
 * - Provides detailed logging and progress tracking
 * - Dry-run mode for safe testing
 */

import { container } from 'tsyringe';
import { HierarchyService, type CreateNodeDTO } from '../services/hierarchy-service';
import { storage } from '../services/storage.service';
import { HIERARCHY_TOKENS } from '../core/hierarchy-tokens';
import { Container } from '../core/container-setup';
import { db } from '../config/database.config';
import { UserOnboardingController } from '../controllers/user-onboarding-controller';
import type { ProfileData, ProfileExperience, ProfileEducation } from '@shared/schema';

interface MigrationStats {
  profilesProcessed: number;
  profilesSkipped: number;
  profilesWithErrors: number;
  nodesCreated: number;
  jobNodesCreated: number;
  educationNodesCreated: number;
  projectNodesCreated: number;
  errors: Array<{ profileId: number; userId: number; error: string }>;
}

interface MigrationOptions {
  dryRun: boolean;
  batchSize: number;
  skipUsersWithExistingNodes: boolean;
}

class ProfileMigrationScript {
  private hierarchyService!: HierarchyService;
  private userOnboardingController!: UserOnboardingController;
  private stats: MigrationStats = {
    profilesProcessed: 0,
    profilesSkipped: 0,
    profilesWithErrors: 0,
    nodesCreated: 0,
    jobNodesCreated: 0,
    educationNodesCreated: 0,
    projectNodesCreated: 0,
    errors: []
  };

  constructor(private options: MigrationOptions) {}

  async initialize(): Promise<void> {
    console.log('🔧 Initializing hierarchy container...');
    try {
      // Create a simple logger for the migration
      const logger = {
        debug: () => {}, // Silent debug logs during migration
        info: console.log,
        warn: console.warn,
        error: console.error,
      };

      // Configure hierarchy container
      await Container.configure(db, logger);

      // Resolve hierarchy service and controller
      this.hierarchyService = container.resolve<HierarchyService>(HIERARCHY_TOKENS.HIERARCHY_SERVICE);
      this.userOnboardingController = container.resolve<UserOnboardingController>('UserOnboardingController');

      console.log('✅ Hierarchy container initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize hierarchy container:', error);
      throw error;
    }
  }

  async run(): Promise<void> {
    console.log('\n🚀 Starting Profile to Hierarchy Migration');
    console.log('='.repeat(50));
    console.log(`Mode: ${this.options.dryRun ? '🧪 DRY RUN' : '💾 LIVE MIGRATION'}`);
    console.log(`Batch Size: ${this.options.batchSize}`);
    console.log(`Skip users with existing nodes: ${this.options.skipUsersWithExistingNodes}`);
    console.log('='.repeat(50));

    const startTime = Date.now();

    try {
      await this.initialize();

      // Get all profiles
      const profiles = await this.getAllProfiles();
      console.log(`\n📊 Found ${profiles.length} profiles to process\n`);

      if (profiles.length === 0) {
        console.log('ℹ️  No profiles found to migrate');
        return;
      }

      // Process profiles in batches
      await this.processProfilesInBatches(profiles);

      const duration = (Date.now() - startTime) / 1000;
      this.printSummary(duration);

    } catch (error) {
      console.error('\n❌ Migration failed:', error);
      throw error;
    }
  }

  private async getAllProfiles(): Promise<any[]> {
    try {
      console.log('📋 Fetching all profiles from database...');
      const profiles = await storage.getAllProfiles();
      return profiles;
    } catch (error) {
      console.error('❌ Failed to fetch profiles:', error);
      throw error;
    }
  }

  private async processProfilesInBatches(profiles: any[]): Promise<void> {
    const batches = this.createBatches(profiles, this.options.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNumber = i + 1;

      console.log(`\n📦 Processing batch ${batchNumber}/${batches.length} (${batch.length} profiles)`);

      for (const profile of batch) {
        await this.processProfile(profile);
      }

      // Brief pause between batches to avoid overwhelming the database
      if (i < batches.length - 1) {
        await this.sleep(100);
      }
    }
  }

  private async processProfile(profile: any): Promise<void> {
    const profileId = profile.id;
    const userId = profile.userId;

    try {
      console.log(`\n👤 Processing profile ${profileId} for user ${userId}`);

      // Check if user already has hierarchy nodes
      if (this.options.skipUsersWithExistingNodes) {
        const existingNodes = await this.hierarchyService.getAllNodes(userId);
        if (existingNodes.length > 0) {
          console.log(`   ⏭️  User ${userId} already has ${existingNodes.length} hierarchy nodes, skipping`);
          this.stats.profilesSkipped++;
          return;
        }
      }

      // Extract profile data (use filteredData if available, fallback to rawData)
      const profileData: ProfileData = profile.filteredData || profile.rawData;

      if (!profileData) {
        console.log(`   ⚠️  No profile data found for profile ${profileId}, skipping`);
        this.stats.profilesSkipped++;
        return;
      }

      // Convert and create hierarchy nodes using UserOnboardingController
      const createdNodes = await this.createNodesFromProfile(profileData, userId);

      this.stats.profilesProcessed++;
      this.stats.nodesCreated += createdNodes.length;

      console.log(`   ✅ Created ${createdNodes.length} nodes for profile ${profileId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ Error processing profile ${profileId}: ${errorMessage}`);

      this.stats.profilesWithErrors++;
      this.stats.errors.push({
        profileId,
        userId,
        error: errorMessage
      });
    }
  }

  private async createNodesFromProfile(profileData: ProfileData, userId: number): Promise<any[]> {
    if (!this.options.dryRun) {
      // Use the UserOnboardingController's method for live migration
      return await (this.userOnboardingController as any).createHierarchyNodesFromProfile(profileData, userId);
    } else {
      // For dry run, simulate the creation and count nodes
      return await this.simulateNodeCreation(profileData, userId);
    }
  }

  private async simulateNodeCreation(profileData: ProfileData, userId: number): Promise<any[]> {
    const simulatedNodes = [];

    // Simulate job nodes from experiences (with their projects as children)
    if (profileData.experiences && profileData.experiences.length > 0) {
      console.log(`   📝 Converting ${profileData.experiences.length} experiences to job nodes`);

      for (const experience of profileData.experiences) {
        console.log(`     🧪 [DRY RUN] Would create job node: ${this.extractTitle(experience.title)} at ${experience.company}`);
        this.stats.jobNodesCreated++;
        simulatedNodes.push({ type: 'job', id: `simulated-job-${simulatedNodes.length}` });

        if (experience.projects && experience.projects.length > 0) {
          console.log(`       🧪 [DRY RUN] Would create ${experience.projects.length} project nodes under job`);
          this.stats.projectNodesCreated += experience.projects.length;
          for (let i = 0; i < experience.projects.length; i++) {
            simulatedNodes.push({ type: 'project', id: `simulated-project-${simulatedNodes.length}` });
          }
        }
      }
    }

    // Simulate education nodes
    if (profileData.education && profileData.education.length > 0) {
      console.log(`   🎓 Converting ${profileData.education.length} education entries to education nodes`);

      for (const education of profileData.education) {
        console.log(`     🧪 [DRY RUN] Would create education node: ${education.degree || 'Degree'} at ${education.school}`);
        this.stats.educationNodesCreated++;
        simulatedNodes.push({ type: 'education', id: `simulated-edu-${simulatedNodes.length}` });
      }
    }

    return simulatedNodes;
  }



  private extractTitle(title: any): string {
    if (typeof title === 'string') {
      return title;
    }
    if (typeof title === 'object' && title?.name) {
      return title.name;
    }
    return 'Position';
  }

  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private printSummary(duration: number): void {
    console.log('\n' + '='.repeat(50));
    console.log('📈 MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📊 Profiles processed: ${this.stats.profilesProcessed}`);
    console.log(`⏭️  Profiles skipped: ${this.stats.profilesSkipped}`);
    console.log(`❌ Profiles with errors: ${this.stats.profilesWithErrors}`);
    console.log(`🔗 Total nodes created: ${this.stats.nodesCreated}`);
    console.log(`💼 Job nodes created: ${this.stats.jobNodesCreated}`);
    console.log(`🎓 Education nodes created: ${this.stats.educationNodesCreated}`);
    console.log(`📋 Project nodes created: ${this.stats.projectNodesCreated}`);

    if (this.stats.errors.length > 0) {
      console.log('\n❌ ERRORS ENCOUNTERED:');
      this.stats.errors.forEach(error => {
        console.log(`   Profile ${error.profileId} (User ${error.userId}): ${error.error}`);
      });
    }

    if (this.options.dryRun) {
      console.log('\n🧪 This was a DRY RUN - no actual changes were made');
      console.log('💡 Run with --live to perform the actual migration');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
    console.log('='.repeat(50));
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);



  const options: MigrationOptions = {
    dryRun: !args.includes('--live'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '10'),
    skipUsersWithExistingNodes: !args.includes('--force-all')
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Profile to Hierarchy Migration Script

Usage:
  tsx server/scripts/migrate-profiles-to-hierarchy.ts [options]

Options:
  --live                    Perform actual migration (default: dry run)
  --batch-size=N           Process N profiles at a time (default: 10)
  --force-all              Migrate all profiles, even if user has existing nodes
  --help, -h               Show this help message

Examples:
  # Dry run (default - safe to run):
  tsx server/scripts/migrate-profiles-to-hierarchy.ts

  # Live migration with default settings:
  tsx server/scripts/migrate-profiles-to-hierarchy.ts --live

  # Live migration with custom batch size:
  tsx server/scripts/migrate-profiles-to-hierarchy.ts --live --batch-size=5

  # Force migrate all profiles (including users with existing nodes):
  tsx server/scripts/migrate-profiles-to-hierarchy.ts --live --force-all
`);
    process.exit(0);
  }

  console.log('🔄 Profile to Hierarchy Migration Script');

  try {
    const migration = new ProfileMigrationScript(options);
    await migration.run();
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ProfileMigrationScript, type MigrationOptions };
