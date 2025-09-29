/**
 * Database Seeder
 * Uses repository layer and ORM queries for type-safe seed data insertion
 */

import type { InsertUser } from '@journey/schema';
import {
  OrganizationType,
  OrgMemberRole,
  TimelineNodeType,
} from '@journey/schema';
import * as schema from '@journey/schema';
import bcrypt from 'bcryptjs';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { Container } from '../core/container-setup';
import { CONTAINER_TOKENS } from '../core/container-tokens';
import type { Logger } from '../core/logger';
import { HierarchyRepository } from '../repositories/hierarchy-repository';
import { OrganizationRepository } from '../repositories/organization.repository';
import { UserRepository } from '../repositories/user-repository';

export interface SeedOptions {
  includeTestUsers?: boolean;
  includeTestOrganizations?: boolean;
  includeTestTimelines?: boolean;
  userCount?: number;
}

export class DatabaseSeeder {
  private userRepository: UserRepository;
  private organizationRepository: OrganizationRepository;
  private hierarchyRepository: HierarchyRepository;
  private logger: Logger = {
    debug: console.log,
    info: console.log,
    warn: console.warn,
    error: console.error,
  };

  constructor(database?: NodePgDatabase<typeof schema>) {
    // Try to get repositories from container if available
    try {
      const container = Container.getContainer();
      this.userRepository = container.resolve(CONTAINER_TOKENS.USER_REPOSITORY);
      this.organizationRepository = container.resolve(
        CONTAINER_TOKENS.ORGANIZATION_REPOSITORY
      );
      this.hierarchyRepository = container.resolve(
        CONTAINER_TOKENS.HIERARCHY_REPOSITORY
      );
      this.logger = container.resolve(CONTAINER_TOKENS.LOGGER) || this.logger;
    } catch {
      // Fallback to manual creation if container not available
      // This will only work for repositories that don't need TransactionManager
      if (database) {
        this.userRepository = new UserRepository({ database });
        this.organizationRepository = new OrganizationRepository({
          database,
          logger: this.logger,
        });
        // For HierarchyRepository, we need TransactionManager, so we can't create it manually
        // We'll need to skip timeline seeding in this case
        console.warn(
          'Cannot initialize HierarchyRepository without container - timeline seeding will be skipped'
        );
        this.hierarchyRepository = null as any;
      } else {
        throw new Error(
          'DatabaseSeeder requires either a database instance or an initialized container'
        );
      }
    }
  }

  /**
   * Seed the database with test data
   */
  async seedDatabase(options: SeedOptions = {}): Promise<void> {
    const {
      includeTestUsers = true,
      includeTestOrganizations = true,
      includeTestTimelines = true,
      userCount = 3,
    } = options;

    try {
      this.logger.info('🌱 Starting database seeding...');

      let testUsers: any[] = [];
      let testOrganizations: any[] = [];

      if (includeTestUsers) {
        testUsers = await this.seedTestUsers(userCount);
        this.logger.info(`✅ Seeded ${testUsers.length} test users`);
      }

      if (includeTestOrganizations) {
        testOrganizations = await this.seedTestOrganizations();
        this.logger.info(
          `✅ Seeded ${testOrganizations.length} test organizations`
        );

        // Add users as members of organizations
        if (testUsers.length > 0 && testOrganizations.length > 0) {
          await this.seedOrganizationMemberships(testUsers, testOrganizations);
        }
      }

      if (includeTestTimelines && testUsers.length > 0) {
        await this.seedTestTimelines(testUsers, testOrganizations);
        this.logger.info('✅ Seeded test timeline data');
      }

      this.logger.info('🎉 Database seeding completed successfully');
    } catch (error) {
      this.logger.error(
        '❌ Database seeding failed:',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Seed test users using repository layer
   */
  private async seedTestUsers(count: number = 3): Promise<any[]> {
    const users: any[] = [];
    const hashedPassword = await bcrypt.hash('test123', 10);

    for (let i = 1; i <= count; i++) {
      try {
        // Check if user already exists
        const existingUser = await this.userRepository.findByEmail(
          `test-user-${i}@example.com`
        );

        if (existingUser) {
          this.logger.debug(`User ${i} already exists, skipping`);
          users.push(existingUser);
          continue;
        }

        // Create new user using repository
        const userData: InsertUser = {
          email: `test-user-${i}@example.com`,
          password: hashedPassword,
          firstName: 'Test',
          lastName: `User${i}`,
          userName: `user${i}`,
          interest: 'grow-career',
          hasCompletedOnboarding: true,
        };

        const user = await this.userRepository.create(userData);
        users.push(user);
        this.logger.debug(`Created test user: ${user.email}`);
      } catch (error: any) {
        if (
          error.message?.includes('duplicate key') ||
          error.code === '23505'
        ) {
          // User already exists, try to find and add to list
          const existingUser = await this.userRepository.findByEmail(
            `test-user-${i}@example.com`
          );
          if (existingUser) {
            users.push(existingUser);
          }
        } else {
          throw error;
        }
      }
    }

    return users;
  }

  /**
   * Seed test organizations using repository layer
   */
  private async seedTestOrganizations(): Promise<any[]> {
    const organizations: any[] = [];

    const orgData = [
      { name: 'Test Company', type: OrganizationType.Company },
      { name: 'Another Company', type: OrganizationType.Company },
      {
        name: 'Test University',
        type: OrganizationType.EducationalInstitution,
      },
    ];

    for (const data of orgData) {
      try {
        const org = await this.organizationRepository.create({
          name: data.name,
          type: data.type,
          metadata: {
            description: `Test organization: ${data.name}`,
            industry:
              data.type === OrganizationType.Company ? 'Technology' : undefined,
          },
        });
        organizations.push(org);
        this.logger.debug(`Created test organization: ${org.name}`);
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          this.logger.debug(
            `Organization ${data.name} already exists, skipping`
          );
          // Try to find existing organization
          const existing =
            await this.organizationRepository.searchOrganizations(data.name, 1);
          if (existing.length > 0) {
            organizations.push(existing[0]);
          }
        } else {
          throw error;
        }
      }
    }

    return organizations;
  }

  /**
   * Seed organization memberships
   */
  private async seedOrganizationMemberships(
    users: any[],
    organizations: any[]
  ): Promise<void> {
    for (let i = 0; i < users.length && i < organizations.length; i++) {
      try {
        await this.organizationRepository.addMember(organizations[i].id, {
          userId: users[i].id,
          role: OrgMemberRole.Member, // Only 'member' is supported in database enum
        });
        this.logger.debug(
          `Added user ${users[i].userName} to ${organizations[i].name}`
        );
      } catch (error: any) {
        if (!error.message?.includes('already exists')) {
          this.logger.warn(
            `Failed to add membership for user ${users[i].id}:`,
            error.message
          );
        }
      }
    }
  }

  /**
   * Seed test timeline data using repository layer
   */
  private async seedTestTimelines(
    users: any[],
    organizations: any[] = []
  ): Promise<void> {
    // Skip if HierarchyRepository is not available
    if (!this.hierarchyRepository) {
      this.logger.warn(
        'HierarchyRepository not available - skipping timeline seeding'
      );
      return;
    }

    for (let i = 0; i < Math.min(users.length, 2); i++) {
      // Only seed for first 2 users
      const user = users[i];
      try {
        // Only proceed if we have organizations available
        if (organizations.length === 0) {
          this.logger.warn(
            `No organizations available for user ${user.id}, skipping timeline creation`
          );
          continue;
        }

        // Use iteration-based assignment - cycle through available organizations
        const jobOrgIndex = i % organizations.length;
        const educationOrgIndex = (i + 1) % organizations.length;

        // Create a job experience
        const jobNode = await this.hierarchyRepository.createNode({
          type: TimelineNodeType.Job,
          parentId: null,
          meta: {
            role: `Software Engineer ${i + 1}`,
            orgId: organizations[jobOrgIndex].id,
            startDate: '2024-01',
            endDate: '2024-12',
            description: `Working on exciting projects with modern technology stack at ${organizations[jobOrgIndex].name}.`,
            location: 'Remote',
          },
          userId: user.id,
        });

        // Create a project under the job
        await this.hierarchyRepository.createNode({
          type: TimelineNodeType.Project,
          parentId: jobNode.id,
          meta: {
            title: `Lighthouse Timeline System - Project ${i + 1}`,
            description: `Built a hierarchical timeline system for career tracking at ${organizations[jobOrgIndex].name}.`,
            technologies: ['TypeScript', 'Drizzle ORM', 'PostgreSQL', 'React'],
            startDate: '2024-01',
            endDate: '2024-03',
            status: 'completed',
          },
          userId: user.id,
        });

        // Create education - only if we have educational institutions
        const educationOrg =
          organizations.find((org) => org.type === 'educational_institution') ||
          organizations[educationOrgIndex];
        await this.hierarchyRepository.createNode({
          type: TimelineNodeType.Education,
          parentId: null,
          meta: {
            orgId: educationOrg.id,
            degree: 'Bachelor of Science',
            field: 'Computer Science',
            startDate: '2020-09',
            endDate: '2024-05',
            description: `Computer Science degree with focus on software engineering from ${educationOrg.name}.`,
          },
          userId: user.id,
        });

        this.logger.debug(`Created timeline nodes for user: ${user.userName}`);
      } catch (error) {
        this.logger.warn(
          `Failed to create timeline for user ${user.id}:`,
          error
        );
      }
    }
  }

  /**
   * Seed minimal data (just a single test user)
   */
  async seedMinimalData(): Promise<{ user: any }> {
    const hashedPassword = await bcrypt.hash('test123', 10);

    try {
      // Check if minimal user already exists
      let user = await this.userRepository.findByEmail('test@example.com');

      if (!user) {
        user = await this.userRepository.create({
          email: 'test@example.com',
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'User',
          userName: 'testuser',
          interest: 'grow-career',
        });
        this.logger.info('✅ Created minimal test user');
      } else {
        this.logger.info('📋 Minimal test user already exists');
      }

      return { user };
    } catch (error) {
      this.logger.error(
        '❌ Failed to seed minimal data:',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Clear all test data (for cleanup)
   */
  async clearTestData(): Promise<void> {
    try {
      this.logger.info('🧹 Clearing test data...');

      // Delete test users (cascade will handle related data)
      const testEmails = [
        'test@example.com',
        'test-user-1@example.com',
        'test-user-2@example.com',
        'test-user-3@example.com',
      ];

      for (const email of testEmails) {
        const user = await this.userRepository.findByEmail(email);
        if (user) {
          await this.userRepository.delete(user.id);
          this.logger.debug(`Deleted test user: ${email}`);
        }
      }

      this.logger.info('✅ Test data cleared');
    } catch (error) {
      this.logger.error(
        '❌ Failed to clear test data:',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }
}

/**
 * Helper function to create and run seeder
 */
export async function seedDatabase(
  database: NodePgDatabase<typeof schema>,
  options?: SeedOptions
): Promise<void> {
  const seeder = new DatabaseSeeder(database);
  await seeder.seedDatabase(options);
}

/**
 * Helper function for minimal seeding
 */
export async function seedMinimalData(
  database: NodePgDatabase<typeof schema>
): Promise<{ user: any }> {
  const seeder = new DatabaseSeeder(database);
  return await seeder.seedMinimalData();
}
