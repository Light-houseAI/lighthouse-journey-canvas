import { ProfileData } from '@journey/schema';

import { PeopleDataLabsService } from './people-data-labs.js';

export class MultiSourceExtractor {
  private peopleDataLabs: PeopleDataLabsService;

  constructor() {
    this.peopleDataLabs = new PeopleDataLabsService();
  }

  async extractComprehensiveProfile(username: string): Promise<ProfileData> {
    console.log(`Starting comprehensive profile extraction for: ${username}`);

    if (this.peopleDataLabs.isAvailable()) {
      console.log(
        'Searching People Data Labs for enhanced professional data...'
      );

      try {
        // First try LinkedIn username search
        let pdlData =
          await this.peopleDataLabs.searchPersonByLinkedIn(username);
        if (pdlData) {
          console.log('People Data Labs found data via LinkedIn username.');
          return pdlData as ProfileData;
        }

        // If no data found, return default profile
        console.log('No data found from People Data Labs.');
        return { name: username, experiences: [], education: [], skills: [] } as ProfileData;
      } catch (error) {
        console.log(
          'People Data Labs search failed:',
          error instanceof Error ? error.message : String(error)
        );
        return { name: username, experiences: [], education: [], skills: [] } as ProfileData;
      }
    }

    // If People Data Labs is not available, return default profile
    console.log('People Data Labs not available, returning default profile.');
    return { name: username, experiences: [], education: [], skills: [] };
  }
}
