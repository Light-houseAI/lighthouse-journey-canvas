import type { IStorage } from '../../services/storage.service';
import type {
  User,
  Profile,
  InsertProfile,
  SignUp,
} from '../../../shared/schema';

/**
 * Mock storage implementation for testing
 */
export class MockStorageService implements IStorage {
  private users: Map<number, User> = new Map();
  private usersByEmail: Map<string, User> = new Map();
  private usersByUsername: Map<string, User> = new Map();
  private profiles: Map<number, Profile> = new Map();

  constructor() {
    // Add a default test user
    const testUser: User = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      interest: '',
      hasCompletedOnboarding: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.addUser(testUser);
  }

  private addUser(user: User): void {
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user);
    if (user.username) {
      this.usersByUsername.set(user.username, user);
    }
  }

  async createUser(signUpData: SignUp): Promise<User> {
    const newUser: User = {
      id: Date.now(), // Simple ID generation
      username: signUpData.username,
      email: signUpData.email,
      password: signUpData.password, // In real app, this would be hashed
      interest: '',
      hasCompletedOnboarding: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.addUser(newUser);
    return newUser;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.usersByEmail.get(email);
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.usersByUsername.get(username);
  }

  async validatePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    // Simplified validation for testing
    return password === hashedPassword;
  }

  async updateUserInterest(userId: number, interest: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');

    const updatedUser = { ...user, interest, updatedAt: new Date() };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async completeOnboarding(userId: number): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');

    const updatedUser = {
      ...user,
      hasCompletedOnboarding: true,
      updatedAt: new Date(),
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async getProfile(id: number): Promise<Profile | undefined> {
    return this.profiles.get(id);
  }

  async getProfileByUsername(
    userId: number,
    username: string
  ): Promise<Profile | undefined> {
    // Find user by username, then get their profile
    const user = this.usersByUsername.get(username);
    if (!user) return undefined;
    return this.profiles.get(user.id);
  }

  async getProfileByUserId(userId: number): Promise<Profile | undefined> {
    return this.profiles.get(userId);
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    const newProfile: Profile = {
      id: Date.now(),
      userId: profile.userId,
      username: profile.username,
      personalityType: profile.personalityType,
      lifeStage: profile.lifeStage,
      goals: profile.goals,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.profiles.set(newProfile.userId, newProfile);
    return newProfile;
  }

  async getAllProfiles(): Promise<Profile[]> {
    return Array.from(this.profiles.values());
  }

  async saveProjectMilestones(userId: number, projects: any[]): Promise<void> {
    // Mock implementation - could store in a separate map if needed
  }

  async getProjectMilestones(userId: number): Promise<any[]> {
    // Mock implementation - return empty array
    return [];
  }

  // Test helper methods
  addTestUser(
    user: Partial<User> & { id: number; username: string; email: string }
  ): User {
    const fullUser: User = {
      password: 'hashedpassword',
      interest: '',
      hasCompletedOnboarding: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...user,
    };

    this.addUser(fullUser);
    return fullUser;
  }

  clear(): void {
    this.users.clear();
    this.usersByEmail.clear();
    this.usersByUsername.clear();
    this.profiles.clear();
  }
}
