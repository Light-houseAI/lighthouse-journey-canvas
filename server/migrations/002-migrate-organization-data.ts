/**
 * Data Migration Script for Organization System
 * Migrates existing timeline node data to use the new organization structure
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '../core/logger';
import { 
  timelineNodes, 
  organizations, 
  OrganizationType,
  TimelineNodeType 
} from '@shared/schema';
import { eq, sql, isNotNull, and } from 'drizzle-orm';

export interface MigrationStats {
  organizationsCreated: number;
  nodesLinked: number;
  metadataCleaned: number;
  errors: Array<{ nodeId: string; error: string }>;
}

export class OrganizationDataMigration {
  constructor(
    private database: NodePgDatabase<any>,
    private logger: Logger
  ) {}

  /**
   * Run the complete migration process
   */
  async migrate(): Promise<MigrationStats> {
    const stats: MigrationStats = {
      organizationsCreated: 0,
      nodesLinked: 0,
      metadataCleaned: 0,
      errors: []
    };

    this.logger.info('Starting organization data migration...');

    try {
      // Step 1: Extract and create organizations
      stats.organizationsCreated = await this.extractOrganizations();

      // Step 2: Link nodes to organizations
      stats.nodesLinked = await this.linkNodesToOrganizations(stats);

      // Step 3: Clean up metadata
      stats.metadataCleaned = await this.cleanupMetadata();

      this.logger.info('Organization data migration completed successfully', stats);
      return stats;

    } catch (error) {
      this.logger.error('Migration failed', {
        error: error instanceof Error ? error.message : String(error),
        stats
      });
      throw error;
    }
  }

  /**
   * Extract unique organizations from timeline nodes and create organization records
   */
  private async extractOrganizations(): Promise<number> {
    this.logger.info('Extracting organizations from timeline nodes...');

    try {
      // Extract unique company names from job nodes
      const companies = await this.database.execute(sql`
        SELECT DISTINCT 
          (meta->>'company') as name,
          'company'::organization_type as type
        FROM timeline_nodes
        WHERE type = 'job' 
          AND meta ? 'company' 
          AND meta->>'company' IS NOT NULL 
          AND meta->>'company' != ''
      `);

      // Extract unique institution names from education nodes
      const institutions = await this.database.execute(sql`
        SELECT DISTINCT 
          (meta->>'institution') as name,
          'educational_institution'::organization_type as type
        FROM timeline_nodes
        WHERE type = 'education' 
          AND meta ? 'institution' 
          AND meta->>'institution' IS NOT NULL 
          AND meta->>'institution' != ''
      `);

      // Combine and deduplicate
      const allOrgs = new Map<string, OrganizationType>();
      
      companies.rows.forEach(row => {
        if (row.name) {
          allOrgs.set(row.name, OrganizationType.Company);
        }
      });

      institutions.rows.forEach(row => {
        if (row.name) {
          allOrgs.set(row.name, OrganizationType.EducationalInstitution);
        }
      });

      this.logger.info(`Found ${allOrgs.size} unique organizations to create`);

      // Create organizations
      let created = 0;
      for (const [name, type] of allOrgs) {
        try {
          // Check if organization already exists
          const existing = await this.database
            .select()
            .from(organizations)
            .where(eq(organizations.name, name))
            .limit(1);

          if (existing.length === 0) {
            await this.database
              .insert(organizations)
              .values({
                name,
                type,
                metadata: {}
              });
            created++;
          }
        } catch (error) {
          this.logger.warn(`Failed to create organization: ${name}`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      this.logger.info(`Created ${created} new organizations`);
      return created;

    } catch (error) {
      this.logger.error('Error extracting organizations', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Link timeline nodes to their corresponding organizations
   */
  private async linkNodesToOrganizations(stats: MigrationStats): Promise<number> {
    this.logger.info('Linking timeline nodes to organizations...');

    try {
      let linkedCount = 0;

      // Link job nodes to companies by setting orgId in meta
      const jobLinkResult = await this.database.execute(sql`
        UPDATE timeline_nodes n
        SET meta = jsonb_set(n.meta, '{orgId}', to_jsonb(o.id::text::integer))
        FROM organizations o
        WHERE n.type = 'job'
          AND n.meta ? 'company'
          AND n.meta->>'company' = o.name
          AND o.type = 'company'
          AND NOT (n.meta ? 'orgId')
      `);

      linkedCount += jobLinkResult.rowCount || 0;

      // Link education nodes to institutions by setting orgId in meta
      const educationLinkResult = await this.database.execute(sql`
        UPDATE timeline_nodes n
        SET meta = jsonb_set(n.meta, '{orgId}', to_jsonb(o.id::text::integer))
        FROM organizations o
        WHERE n.type = 'education'
          AND n.meta ? 'institution'
          AND n.meta->>'institution' = o.name
          AND o.type = 'educational_institution'
          AND NOT (n.meta ? 'orgId')
      `);

      linkedCount += educationLinkResult.rowCount || 0;

      this.logger.info(`Linked ${linkedCount} nodes to organizations`);
      return linkedCount;

    } catch (error) {
      this.logger.error('Error linking nodes to organizations', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Clean up redundant metadata after linking
   */
  private async cleanupMetadata(): Promise<number> {
    this.logger.info('Cleaning up redundant metadata...');

    try {
      let cleanedCount = 0;

      // Clean up company metadata from job nodes that now have orgId
      const jobCleanResult = await this.database.execute(sql`
        UPDATE timeline_nodes 
        SET meta = meta - 'company'
        WHERE type = 'job' 
          AND meta ? 'orgId' 
          AND meta ? 'company'
      `);

      cleanedCount += jobCleanResult.rowCount || 0;

      // Clean up institution metadata from education nodes that now have orgId
      const educationCleanResult = await this.database.execute(sql`
        UPDATE timeline_nodes 
        SET meta = meta - 'institution'
        WHERE type = 'education' 
          AND meta ? 'orgId' 
          AND meta ? 'institution'
      `);

      cleanedCount += educationCleanResult.rowCount || 0;

      this.logger.info(`Cleaned metadata from ${cleanedCount} nodes`);
      return cleanedCount;

    } catch (error) {
      this.logger.error('Error cleaning up metadata', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Validate migration results
   */
  async validateMigration(): Promise<{
    totalNodes: number;
    nodesWithOrgs: number;
    orphanedNodes: number;
    duplicateOrgs: number;
  }> {
    this.logger.info('Validating migration results...');

    try {
      // Count total nodes
      const totalNodesResult = await this.database.execute(sql`
        SELECT COUNT(*) as count FROM timeline_nodes
      `);
      const totalNodes = totalNodesResult.rows[0]?.count || 0;

      // Count nodes with organizations
      const nodesWithOrgsResult = await this.database.execute(sql`
        SELECT COUNT(*) as count FROM timeline_nodes WHERE org_id IS NOT NULL
      `);
      const nodesWithOrgs = nodesWithOrgsResult.rows[0]?.count || 0;

      // Count orphaned job/education nodes (should have org but don't)
      const orphanedResult = await this.database.execute(sql`
        SELECT COUNT(*) as count FROM timeline_nodes 
        WHERE type IN ('job', 'education') 
          AND org_id IS NULL
          AND (meta ? 'company' OR meta ? 'institution')
      `);
      const orphanedNodes = orphanedResult.rows[0]?.count || 0;

      // Check for duplicate organizations
      const duplicateOrgsResult = await this.database.execute(sql`
        SELECT COUNT(*) as count FROM (
          SELECT name FROM organizations GROUP BY name HAVING COUNT(*) > 1
        ) as duplicates
      `);
      const duplicateOrgs = duplicateOrgsResult.rows[0]?.count || 0;

      const validation = {
        totalNodes,
        nodesWithOrgs,
        orphanedNodes,
        duplicateOrgs
      };

      this.logger.info('Migration validation results', validation);

      if (orphanedNodes > 0) {
        this.logger.warn(`Found ${orphanedNodes} orphaned nodes that should have organizations`);
      }

      if (duplicateOrgs > 0) {
        this.logger.warn(`Found ${duplicateOrgs} duplicate organization names`);
      }

      return validation;

    } catch (error) {
      this.logger.error('Error validating migration', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Rollback migration (for testing or if issues are found)
   */
  async rollback(): Promise<void> {
    this.logger.info('Rolling back organization data migration...');

    try {
      await this.database.transaction(async (tx) => {
        // Restore metadata to timeline nodes before clearing org_id
        await tx.execute(sql`
          UPDATE timeline_nodes n
          SET meta = meta || jsonb_build_object('company', o.name)
          FROM organizations o
          WHERE n.org_id = o.id 
            AND n.type = 'job'
            AND o.type = 'company'
        `);

        await tx.execute(sql`
          UPDATE timeline_nodes n
          SET meta = meta || jsonb_build_object('institution', o.name)
          FROM organizations o
          WHERE n.org_id = o.id 
            AND n.type = 'education'
            AND o.type = 'educational_institution'
        `);

        // Clear org_id from timeline nodes
        await tx.execute(sql`
          UPDATE timeline_nodes SET org_id = NULL WHERE org_id IS NOT NULL
        `);

        // Remove all organizations
        await tx.execute(sql`
          DELETE FROM organizations
        `);
      });

      this.logger.info('Migration rollback completed');

    } catch (error) {
      this.logger.error('Error rolling back migration', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}