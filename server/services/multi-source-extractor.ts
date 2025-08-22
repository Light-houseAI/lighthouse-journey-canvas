import { ProfileData, ProfileExperience, ProfileEducation } from "@shared/schema";
import { PeopleDataLabsService } from "./people-data-labs";


export class MultiSourceExtractor {
  private peopleDataLabs: PeopleDataLabsService;

  constructor() {
    this.peopleDataLabs = new PeopleDataLabsService();
  }

  async extractComprehensiveProfile(username: string): Promise<ProfileData> {
    console.log(`Starting comprehensive profile extraction for: ${username}`);

    if (this.peopleDataLabs.isAvailable()) {
      console.log("Searching People Data Labs for enhanced professional data...");

      try {
        // First try LinkedIn username search
        let pdlData = await this.peopleDataLabs.searchPersonByLinkedIn(username);
        if (pdlData) {
          console.log("People Data Labs found data via LinkedIn username.");
          return this.safeMergeProfileData(pdlData, { name: username, experiences: [], education: [], skills: [] });
        }
      } catch (error) {
        console.log("People Data Labs search failed:", error instanceof Error ? error.message : String(error));
        return { name: username, experiences: [], education: [], skills: [] };
      }
    }
  }

  private safeMergeProfileData(base: ProfileData, additional: Partial<ProfileData>): ProfileData {
    // Merge experiences with deduplication
    const allExperiences = [...base.experiences, ...(additional.experiences || [])];
    const uniqueExperiences = this.deduplicateExperiences(allExperiences.filter(exp => exp && exp.company && exp.title));

    // Merge education with deduplication
    const allEducation = [...base.education, ...(additional.education || [])];
    const uniqueEducation = this.deduplicateEducation(allEducation.filter(edu => edu && edu.school));

    // Skills are no longer extracted

    return {
      name: base.name || additional.name || "Unknown User",
      headline: base.headline || additional.headline,
      location: base.location || additional.location,
      about: base.about || additional.about,
      avatarUrl: base.avatarUrl || additional.avatarUrl,
      experiences: uniqueExperiences.slice(0, 15),
      education: uniqueEducation.slice(0, 5),
      skills: [] // Skills are no longer extracted // Skills are no longer extracted
    };
  }

  private deduplicateExperiences(experiences: ProfileExperience[]): ProfileExperience[] {
    const seen = new Set();
    return experiences.filter(exp => {
      if (!exp.company || !exp.title) return false;
      const key = `${exp.company}-${exp.title}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private deduplicateEducation(education: ProfileEducation[]): ProfileEducation[] {
    const seen = new Set();
    return education.filter(edu => {
      if (!edu.school) return false;
      const key = edu.school.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
