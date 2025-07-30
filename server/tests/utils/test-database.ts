/**
 * Test Database Manager
 * 
 * Manages isolated test user data for consistent testing
 */

import { db } from '../../db.js'
import { users, profiles, userSkills } from '../../../shared/schema.js'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { User, Profile, UserSkill } from '../../../shared/schema.js'

export class TestDatabaseManager {
  static readonly TEST_USER_ID = 999
  private static instance: TestDatabaseManager

  static getInstance(): TestDatabaseManager {
    if (!TestDatabaseManager.instance) {
      TestDatabaseManager.instance = new TestDatabaseManager()
    }
    return TestDatabaseManager.instance
  }

  private constructor() {}

  /**
   * Load template data from fixture files
   */
  private loadTemplates() {
    const fixturesDir = join(process.cwd(), 'server', 'tests', 'fixtures')
    
    try {
      const userTemplate = JSON.parse(
        readFileSync(join(fixturesDir, 'test-user-template.json'), 'utf8')
      )
      
      const profileTemplate = JSON.parse(
        readFileSync(join(fixturesDir, 'test-profile-template.json'), 'utf8')
      )
      
      let skillsTemplate = []
      try {
        skillsTemplate = JSON.parse(
          readFileSync(join(fixturesDir, 'test-skills-template.json'), 'utf8')
        )
      } catch {
        // Skills template might be empty
      }
      
      return { userTemplate, profileTemplate, skillsTemplate }
    } catch (error) {
      throw new Error(`Failed to load test templates: ${error}`)
    }
  }

  /**
   * Setup test user with fresh data from templates
   */
  async setupTestUser(): Promise<void> {
    console.log(`🔧 Setting up test user (ID: ${TestDatabaseManager.TEST_USER_ID})...`)
    
    const { userTemplate, profileTemplate, skillsTemplate } = this.loadTemplates()
    
    // Remove any existing test user data first
    await this.cleanupTestUser()
    
    try {
      // Insert user
      await db.insert(users).values({
        id: TestDatabaseManager.TEST_USER_ID,
        email: userTemplate.email,
        password: userTemplate.password,
        interest: userTemplate.interest,
        hasCompletedOnboarding: userTemplate.hasCompletedOnboarding
      })
      
      // Insert profile if exists
      if (profileTemplate) {
        await db.insert(profiles).values({
          id: TestDatabaseManager.TEST_USER_ID,
          userId: TestDatabaseManager.TEST_USER_ID,
          username: profileTemplate.username,
          rawData: profileTemplate.rawData,
          filteredData: profileTemplate.filteredData,
          projects: profileTemplate.projects || []
        })
      }
      
      // Insert skills if exist
      if (skillsTemplate && skillsTemplate.length > 0) {
        const skillsData = skillsTemplate.map((skill: any) => ({
          ...skill,
          userId: TestDatabaseManager.TEST_USER_ID
        }))
        await db.insert(userSkills).values(skillsData)
      }
      
      console.log(`✅ Test user setup completed`)
      console.log(`   - User ID: ${TestDatabaseManager.TEST_USER_ID}`)
      console.log(`   - Email: ${userTemplate.email}`)
      console.log(`   - Profile: ${profileTemplate ? 'Created' : 'None'}`)
      console.log(`   - Skills: ${skillsTemplate.length} records`)
      
    } catch (error) {
      console.error('❌ Error setting up test user:', error)
      throw error
    }
  }

  /**
   * Reset test user data to fresh state
   */
  async resetTestUserData(): Promise<void> {
    console.log(`🔄 Resetting test user data...`)
    
    try {
      // Delete existing data
      await db.delete(userSkills).where(eq(userSkills.userId, TestDatabaseManager.TEST_USER_ID))
      await db.delete(profiles).where(eq(profiles.userId, TestDatabaseManager.TEST_USER_ID))
      await db.delete(users).where(eq(users.id, TestDatabaseManager.TEST_USER_ID))
      
      // Re-setup with fresh data
      await this.setupTestUser()
      
    } catch (error) {
      console.error('❌ Error resetting test user data:', error)
      throw error
    }
  }

  /**
   * Clean up test user completely
   */
  async cleanupTestUser(): Promise<void> {
    try {
      // Delete in reverse order due to foreign key constraints
      await db.delete(userSkills).where(eq(userSkills.userId, TestDatabaseManager.TEST_USER_ID))
      await db.delete(profiles).where(eq(profiles.userId, TestDatabaseManager.TEST_USER_ID))
      await db.delete(users).where(eq(users.id, TestDatabaseManager.TEST_USER_ID))
      
      console.log(`🧹 Test user cleanup completed`)
      
    } catch (error) {
      // Don't throw on cleanup errors - might not exist
      console.log(`⚠️  Cleanup warning (safe to ignore): ${error}`)
    }
  }

  /**
   * Verify test user exists and has expected data
   */
  async verifyTestUser(): Promise<boolean> {
    try {
      const user = await db.select()
        .from(users)
        .where(eq(users.id, TestDatabaseManager.TEST_USER_ID))
        .limit(1)
      
      const profile = await db.select()
        .from(profiles)  
        .where(eq(profiles.userId, TestDatabaseManager.TEST_USER_ID))
        .limit(1)
      
      return user.length > 0 && profile.length > 0
    } catch (error) {
      return false
    }
  }

  /**
   * Get test user profile data
   */
  async getTestUserProfile() {
    const profile = await db.select()
      .from(profiles)
      .where(eq(profiles.userId, TestDatabaseManager.TEST_USER_ID))
      .limit(1)
    
    return profile.length > 0 ? profile[0] : null
  }
}