import axios from "axios";
import { ProfileData, ProfileExperience, ProfileEducation } from "@shared/schema";
import { LinkedInExtractor } from "./linkedin-extractor";
import { PeopleDataLabsService } from "./people-data-labs";

interface PersonSearchResult {
  name: string;
  location?: string;
  company?: string;
  title?: string;
  url?: string;
  source: string;
}

export class MultiSourceExtractor {
  private linkedinExtractor: LinkedInExtractor;
  private peopleDataLabs: PeopleDataLabsService;
  private zenrowsApiKey: string;

  constructor() {
    this.linkedinExtractor = new LinkedInExtractor();
    this.peopleDataLabs = new PeopleDataLabsService();
    this.zenrowsApiKey = process.env.ZENROWS_API_KEY || "";
  }

  async extractComprehensiveProfile(username: string): Promise<ProfileData> {
    console.log(`Starting comprehensive profile extraction for: ${username}`);

    // Step 1: Extract LinkedIn data first (our primary source)
    let profileData = await this.linkedinExtractor.extractProfile(username);
    console.log(`LinkedIn extraction completed for ${profileData.name}`);
    console.log(`Current data: ${profileData.experiences.length} experiences, ${profileData.education.length} education`);

    // Step 2: Enhance with People Data Labs for comprehensive professional data
    if (this.peopleDataLabs.isAvailable()) {
      console.log("Searching People Data Labs for enhanced professional data...");

      try {
        // First try LinkedIn username search
        let pdlData = await this.peopleDataLabs.searchPersonByLinkedIn(username);

        // If no results, try name-based search with location
        if (!pdlData && profileData.name && profileData.name !== "Unknown User") {
          pdlData = await this.peopleDataLabs.searchPersonByName(profileData.name, profileData.location);
        }

        if (pdlData) {
          console.log(`Found PDL data: ${pdlData.experiences?.length || 0} experiences, ${pdlData.education?.length || 0} education`);
          // Prioritize PDL data when it has substantial professional info
          if (pdlData.experiences?.length > 0 || pdlData.education?.length > 0) {
            console.log("PDL has comprehensive data - using as primary source");
            profileData = this.safeMergeProfileData(pdlData, profileData);
          } else {
            profileData = this.safeMergeProfileData(profileData, pdlData);
          }
        }
      } catch (error) {
        console.log("People Data Labs search failed:", error instanceof Error ? error.message : String(error));
      }
    }

    // Step 3: Search additional web sources if still missing key data
    console.log("Evaluating if additional web sources needed...");
    if (this.shouldSearchAdditionalSources(profileData)) {
      console.log("Searching web sources for enhanced profile data...");

      try {
        const additionalData = await this.searchAdditionalSources(profileData.name, username);
        if (additionalData.experiences?.length > 0 || additionalData.education?.length > 0) {
          console.log(`Found web data: ${additionalData.experiences?.length || 0} experiences, ${additionalData.education?.length || 0} education`);
          profileData = this.safeMergeProfileData(profileData, additionalData);
        }
      } catch (error) {
        console.log("Additional web sources search failed:", error instanceof Error ? error.message : String(error));
      }
    }

    return profileData;
  }

  private shouldSearchAdditionalSources(profile: ProfileData): boolean {
    // Search additional sources if we have limited data
    const hasLimitedEducation = profile.education.length < 2;
    const hasShortAbout = !profile.about || profile.about.length < 100;

    // Search for additional sources if missing key data
    return hasLimitedEducation && hasShortAbout;
  }

  private isProfileDataLimited(profile: ProfileData): boolean {
    // Check if profile has minimal data that suggests we need more sources
    const hasLimitedExperience = profile.experiences.length < 2;
    const hasLimitedEducation = profile.education.length < 1;
    const hasNoAbout = !profile.about || profile.about.length < 50;
    return hasLimitedExperience && (hasLimitedEducation || hasNoAbout);
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

  private async searchAdditionalSources(name: string, username: string): Promise<Partial<ProfileData>> {
    const sources = [
      () => this.searchGitHub(name, username),
      () => this.searchCompanyWebsites(name),
      () => this.searchProfessionalDirectories(name),
      () => this.searchPublicProfiles(name)
    ];

    const results = await Promise.allSettled(sources.map(fn => fn()));

    let aggregatedData: Partial<ProfileData> = {
      experiences: [],
      education: [],
      skills: [] // Skills are no longer extracted
    };

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        console.log(`Source ${index + 1} returned data:`, Object.keys(result.value));
        aggregatedData = this.mergeProfileData(aggregatedData, result.value);
      }
    });

    return aggregatedData;
  }

  private async searchGitHub(name: string, username: string): Promise<Partial<ProfileData>> {
    try {
      // Search GitHub for profiles matching the name/username
      const searchResponse = await axios.get(`https://api.github.com/search/users`, {
        params: {
          q: `${name} in:fullname OR ${username} in:login`,
          per_page: 5
        },
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ProfileExtractor/1.0'
        },
        timeout: 5000
      });

      if (searchResponse.data.items && searchResponse.data.items.length > 0) {
        const user = searchResponse.data.items[0];

        // Get detailed user info
        const userResponse = await axios.get(user.url, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'ProfileExtractor/1.0'
          },
          timeout: 5000
        });

        const userData = userResponse.data;

        return {
          about: userData.bio || undefined,
          location: userData.location || undefined,
          skills: [] // Skills extraction removed
        };
      }
    } catch (error) {
      console.log("GitHub search failed:", error.message);
    }

    return {};
  }

  // Removed extractGitHubSkills method - skills are no longer extracted

  private async searchCompanyWebsites(name: string): Promise<Partial<ProfileData>> {
    try {
      // Use ZenRows to search for the person's name on common company directories
      if (!this.zenrowsApiKey) return {};

      const searchQueries = [
        `"${name}" site:about.me`,
        `"${name}" "software engineer" OR "developer" OR "manager"`,
        `"${name}" "experience" OR "worked at" OR "currently at"`
      ];

      for (const query of searchQueries) {
        try {
          const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

          const response = await axios.get("https://api.zenrows.com/v1/", {
            params: {
              url: searchUrl,
              apikey: this.zenrowsApiKey,
              premium_proxy: "true",
              proxy_country: "US"
            },
            timeout: 10000
          });

          if (response.status === 200) {
            const extractedInfo = this.parseSearchResults(response.data, name);
            if (extractedInfo.experiences.length > 0 || extractedInfo.education.length > 0) {
              return extractedInfo;
            }
          }
        } catch (error) {
          console.log(`Search query "${query}" failed:`, error.message);
          continue;
        }
      }
    } catch (error) {
      console.log("Company website search failed:", error.message);
    }

    return {};
  }

  private parseSearchResults(html: string, name: string): Partial<ProfileData> {
    // Extract structured data from search results
    const experiences = [];
    const education = [];

    // Look for common patterns indicating work experience
    const companyPatterns = [
      new RegExp(`${name.replace(/\s+/g, '\\s+')}\\s+(?:at|works?\\s+at|employed\\s+at)\\s+([A-Za-z0-9\\s,&.-]+)`, 'gi'),
      new RegExp(`([A-Za-z0-9\\s,&.-]+)\\s+(?:-|–|—)\\s+${name.replace(/\s+/g, '\\s+')}`, 'gi')
    ];

    companyPatterns.forEach(pattern => {
      const matches = Array.from(html.matchAll(pattern));
      matches.forEach(match => {
        if (match[1] && match[1].length > 2 && match[1].length < 100) {
          experiences.push({
            title: "Professional",
            company: match[1].trim(),
            description: "",
            start: "",
            end: ""
          } as Experience);
        }
      });
    });

    // Look for education patterns
    const educationPatterns = [
      new RegExp(`${name.replace(/\s+/g, '\\s+')}\\s+(?:graduated\\s+from|studied\\s+at|alumni\\s+of)\\s+([A-Za-z0-9\\s,&.-]+(?:University|College|Institute|School))`, 'gi'),
      new RegExp(`([A-Za-z0-9\\s,&.-]+(?:University|College|Institute|School))\\s+(?:-|–|—)\\s+${name.replace(/\s+/g, '\\s+')}`, 'gi')
    ];

    educationPatterns.forEach(pattern => {
      const matches = Array.from(html.matchAll(pattern));
      matches.forEach(match => {
        if (match[1] && match[1].length > 5 && match[1].length < 100) {
          education.push({
            institution: match[1].trim(),
            degree: "",
            field: "",
            start: "",
            end: ""
          } as Education);
        }
      });
    });

    return {
      experiences: experiences.slice(0, 3), // Limit to top 3 results
      education: education.slice(0, 2)      // Limit to top 2 results
    };
  }

  private async searchProfessionalDirectories(name: string): Promise<Partial<ProfileData>> {
    // Search professional directories and business databases
    try {
      if (!this.zenrowsApiKey) return {};

      const directories = [
        `https://www.crunchbase.com/search/people?query=${encodeURIComponent(name)}`,
        `https://angel.co/search?q=${encodeURIComponent(name)}&type=Person`
      ];

      for (const url of directories) {
        try {
          const response = await axios.get("https://api.zenrows.com/v1/", {
            params: {
              url: url,
              apikey: this.zenrowsApiKey,
              premium_proxy: "true",
              proxy_country: "US"
            },
            timeout: 8000
          });

          if (response.status === 200) {
            const directoryInfo = this.parseDirectoryData(response.data, name);
            if (directoryInfo.experiences.length > 0) {
              return directoryInfo;
            }
          }
        } catch (error) {
          console.log(`Directory search failed for ${url}:`, error.message);
          continue;
        }
      }
    } catch (error) {
      console.log("Professional directory search failed:", error.message);
    }

    return {};
  }

  private parseDirectoryData(html: string, name: string): Partial<ProfileData> {
    // Parse structured data from professional directories
    const experiences = [];

    // Look for JSON-LD structured data
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);

    if (jsonLdMatches) {
      jsonLdMatches.forEach(match => {
        try {
          const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
          const data = JSON.parse(jsonContent);

          if (data['@type'] === 'Person' && data.name && data.name.toLowerCase().includes(name.toLowerCase())) {
            if (data.worksFor) {
              experiences.push({
                title: data.jobTitle || "Professional",
                company: data.worksFor.name || data.worksFor,
                description: "",
                start: "",
                end: "Present"
              } as ProfileExperience);
            }
          }
        } catch (error) {
          // JSON parsing failed, continue
        }
      });
    }

    return { experiences };
  }

  private async searchPublicProfiles(name: string): Promise<Partial<ProfileData>> {
    // Search for public profiles on various platforms
    try {
      const publicSources = [
        `"${name}" site:about.me`,
        `"${name}" site:dribbble.com`,
        `"${name}" site:behance.net`
      ];

      // This would use web scraping to find additional profile information
      // For now, return empty data to avoid overcomplicating
      return {};
    } catch (error) {
      console.log("Public profile search failed:", error.message);
      return {};
    }
  }

  private async enhanceWithProfessionalDatabases(profile: ProfileData): Promise<Partial<ProfileData>> {
    // This could integrate with services like People Data Labs, Clearbit, etc.
    // For now, we'll focus on the free/accessible sources we've implemented
    return {};
  }

  private mergeProfileData(base: Partial<ProfileData>, additional: Partial<ProfileData>): ProfileData {
    const merged: ProfileData = {
      name: base.name || additional.name || "Unknown User",
      headline: base.headline || additional.headline,
      location: base.location || additional.location,
      about: base.about || additional.about,
      avatarUrl: base.avatarUrl || additional.avatarUrl,
      experiences: [...(base.experiences || []), ...(additional.experiences || [])],
      education: [...(base.education || []), ...(additional.education || [])],
      skills: [] // Skills are no longer extracted
    };

    // Filter out invalid entries and remove duplicates
    const validExperiences = merged.experiences.filter(exp => exp && exp.company && exp.title);
    const validEducation = merged.education.filter(edu => edu && edu.institution);

    merged.experiences = this.deduplicateExperiences(validExperiences).slice(0, 15);
    merged.education = this.deduplicateEducation(validEducation).slice(0, 5);
    merged.skills = []; // Skills are no longer extracted

    return merged;
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
