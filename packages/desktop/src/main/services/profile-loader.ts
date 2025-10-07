import { UserProfile } from '../../shared/types'
import * as fs from 'fs'
import * as path from 'path'

export class ProfileLoaderService {
  private profilesDir: string

  constructor() {
    // In development, data is at package root
    // __dirname in compiled code points to .vite/build
    // Go up to package root: .vite/build -> .vite -> packages/desktop
    this.profilesDir = path.join(__dirname, '../../../data/mock-profiles')
  }

  async loadAll(): Promise<UserProfile[]> {
    try {
      console.log('[ProfileLoader] Loading from directory:', this.profilesDir)

      if (!fs.existsSync(this.profilesDir)) {
        console.error('[ProfileLoader] Directory does not exist:', this.profilesDir)
        return []
      }

      const files = fs.readdirSync(this.profilesDir)
      console.log('[ProfileLoader] Found files:', files.length)

      const jsonFiles = files.filter(f => f.endsWith('.json'))
      console.log('[ProfileLoader] Found JSON files:', jsonFiles.length)

      const profiles: UserProfile[] = []
      for (const file of jsonFiles) {
        const filePath = path.join(this.profilesDir, file)
        const content = fs.readFileSync(filePath, 'utf-8')
        const profile = JSON.parse(content) as UserProfile
        profiles.push(profile)
        console.log('[ProfileLoader] Loaded profile:', profile.id, profile.name)
      }

      console.log('[ProfileLoader] Total profiles loaded:', profiles.length)
      return profiles
    } catch (error) {
      console.error('[ProfileLoader] Failed to load profiles:', error)
      return []
    }
  }

  async getById(id: string): Promise<UserProfile | null> {
    const profiles = await this.loadAll()
    return profiles.find(p => p.id === id) || null
  }
}

export const profileLoaderService = new ProfileLoaderService()
