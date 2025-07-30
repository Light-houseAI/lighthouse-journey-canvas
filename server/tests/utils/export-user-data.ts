/**
 * Utility script to export User 19 data for test template creation
 * Run with: tsx server/tests/utils/export-user-data.ts
 */

import { db } from '../../db.js'
import { users, profiles, userSkills } from '../../../shared/schema.js'
import { eq } from 'drizzle-orm'
import { writeFileSync } from 'fs'
import { join } from 'path'

const SOURCE_USER_ID = 19

async function exportUserData() {
  console.log(`🔍 Exporting data for User ID ${SOURCE_USER_ID}...`)
  
  try {
    // Export user record
    const userRecord = await db.select()
      .from(users)
      .where(eq(users.id, SOURCE_USER_ID))
      .limit(1)
    
    if (userRecord.length === 0) {
      console.log(`❌ User ${SOURCE_USER_ID} not found in database`)
      return
    }
    
    // Export profile record
    const profileRecord = await db.select()
      .from(profiles)
      .where(eq(profiles.userId, SOURCE_USER_ID))
      .limit(1)
    
    // Export skills records
    const skillsRecords = await db.select()
      .from(userSkills)
      .where(eq(userSkills.userId, SOURCE_USER_ID))
    
    // Create anonymized templates
    const userTemplate = {
      ...userRecord[0],
      id: 999, // Test user ID
      email: 'test-user@example.com',
      password: '$2b$10$test.hash.for.test.user.only', // Bcrypt hash for 'testpassword123'
      createdAt: new Date().toISOString()
    }
    
    const profileTemplate = profileRecord.length > 0 ? {
      ...profileRecord[0],
      id: 999,
      userId: 999,
      username: 'test-user',
      createdAt: new Date().toISOString()
    } : null
    
    const skillsTemplate = skillsRecords.map(skill => ({
      ...skill,
      id: undefined, // Will be auto-generated
      userId: 999,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      firstMentioned: new Date().toISOString(),
      lastMentioned: new Date().toISOString()
    }))
    
    // Create fixtures directory
    const fixturesDir = join(process.cwd(), 'server', 'tests', 'fixtures')
    
    // Write template files
    writeFileSync(
      join(fixturesDir, 'test-user-template.json'),
      JSON.stringify(userTemplate, null, 2)
    )
    
    if (profileTemplate) {
      writeFileSync(
        join(fixturesDir, 'test-profile-template.json'),
        JSON.stringify(profileTemplate, null, 2)
      )
    }
    
    writeFileSync(
      join(fixturesDir, 'test-skills-template.json'),
      JSON.stringify(skillsTemplate, null, 2)
    )
    
    // Summary
    console.log('✅ Export completed successfully!')
    console.log(`📊 Exported data summary:`)
    console.log(`   - User: ${userRecord[0].email}`)
    console.log(`   - Profile: ${profileRecord.length > 0 ? 'Found' : 'Not found'}`)
    console.log(`   - Skills: ${skillsRecords.length} records`)
    console.log(`   - Template files created in server/tests/fixtures/`)
    
    if (profileRecord.length > 0) {
      const profile = profileRecord[0]
      console.log(`📋 Profile data preview:`)
      console.log(`   - Experiences: ${profile.filteredData?.experiences?.length || 0}`)
      console.log(`   - Projects: ${profile.projects?.length || 0}`)
    }
    
  } catch (error) {
    console.error('❌ Error exporting user data:', error)
  } finally {
    process.exit(0)
  }
}

exportUserData()