import axios from "axios";
import { ProfileData, ProfileExperience, ProfileEducation } from "@shared/schema";

interface PDLPersonData {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  linkedin_url?: string;
  linkedin_username?: string;
  location_names?: string[];
  headline?: string;
  summary?: string;
  experience?: PDLExperience[];
  education?: PDLEducation[];
  skills?: string[];
  industries?: string[];
  job_title?: string;
  job_company_name?: string;
}

interface PDLExperience {
  company?: {
    name?: string;
    website?: string;
    industry?: string;
    location?: {
      name?: string;
    };
  };
  title?: string;
  summary?: string;
  start_date?: string;
  end_date?: string;
  is_primary?: boolean;
}

interface PDLEducation {
  school?: {
    name?: string;
    type?: string;
    website?: string;
    location?: {
      name?: string;
    };
  };
  degrees?: string[];
  majors?: string[];
  minors?: string[];
  start_date?: string;
  end_date?: string;
  summary?: string;
}

export class PeopleDataLabsService {
  private apiKey: string;
  private baseUrl = "https://api.peopledatalabs.com/v5";

  constructor() {
    this.apiKey = process.env.PEOPLE_DATA_LABS_API_KEY || "";
  }

  async searchPersonByLinkedIn(linkedinUsername: string): Promise<Partial<ProfileData> | null> {
    if (!this.apiKey) {
      console.log("No People Data Labs API key found");
      return null;
    }

    try {
      console.log(`Searching People Data Labs for LinkedIn user: ${linkedinUsername}`);

      const response = await axios.get(`${this.baseUrl}/person/enrich`, {
        params: {
          api_key: this.apiKey,
          profile: `linkedin.com/in/${linkedinUsername}`,
          min_likelihood: 6,
          pretty: true
        },
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ProfileExtractor/1.0'
        }
      });

      if (response.status === 200 && response.data.status === 200) {
        const person = response.data.data as PDLPersonData;
        console.log(`Found PDL data for ${person.full_name || linkedinUsername}`);
        return this.convertPDLToProfileData(person);
      } else {
        console.log(`PDL search returned status: ${response.data.status}`);
        return null;
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log("Person not found in People Data Labs");
      } else if (error.response?.status === 400) {
        console.error("PDL API 400 error - checking request format:", {
          profile: `linkedin.com/in/${linkedinUsername}`,
          status: error.response?.status,
          data: error.response?.data,
          requestUrl: error.config?.url,
          requestParams: error.config?.params
        });
      } else {
        console.error("People Data Labs API error:", error.message, error.response?.status);
      }
      return null;
    }
  }

  async searchPersonByName(fullName: string, location?: string): Promise<Partial<ProfileData> | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      console.log(`Searching People Data Labs by name: ${fullName}`);

      const params: any = {
        api_key: this.apiKey,
        name: fullName,
        min_likelihood: 6,
        pretty: true
      };

      // PDL requires additional data with name searches - use location or default
      if (location) {
        params.location = location;
      } else {
        params.country = 'US'; // Default fallback
      }

      const response = await axios.get(`${this.baseUrl}/person/enrich`, {
        params,
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ProfileExtractor/1.0'
        }
      });

      if (response.status === 200 && response.data.status === 200) {
        const person = response.data.data as PDLPersonData;
        console.log(`Found PDL data by name for ${person.full_name}`);
        return this.convertPDLToProfileData(person);
      } else {
        console.log(`PDL name search returned status: ${response.data.status}`);
        return null;
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log("Person not found by name in People Data Labs");
      } else {
        console.error("People Data Labs name search error:", error.message);
      }
      return null;
    }
  }

  private convertPDLToProfileData(person: PDLPersonData): Partial<ProfileData> {
    const profileData: Partial<ProfileData> = {};

    // Basic information
    if (person.full_name) {
      profileData.name = person.full_name;
    }

    if (person.headline || person.job_title) {
      profileData.headline = person.headline || person.job_title;
    }

    if (person.location_names && person.location_names.length > 0) {
      profileData.location = person.location_names[0];
    }

    if (person.summary) {
      profileData.about = person.summary;
    }

    // Work experience
    if (person.experience && person.experience.length > 0) {
      profileData.experiences = person.experience.map(exp => {
        const experience: ProfileExperience = {
          title: exp.title.name || "Position",
          company: exp.company?.name || "Unknown Company",
          description: exp.summary || "",
          start: this.formatDate(exp.start_date),
          end: this.formatDate(exp.end_date) || (exp.end_date ? "" : "Present")
        };
        return experience;
      }).slice(0, 10); // Limit to 10 most recent
    }

    // Education
    if (person.education && person.education.length > 0) {
      profileData.education = person.education.map(edu => {
        const education: ProfileEducation = {
          school: edu.school?.name || "Unknown Institution",
          degree: edu.degrees?.join(", ") || "",
          field: edu.majors?.join(", ") || "",
          start: this.formatDate(edu.start_date),
          end: this.formatDate(edu.end_date)
        };
        return education;
      }).slice(0, 5); // Limit to 5 most recent
    }

    // Skills
    if (person.skills && person.skills.length > 0) {
      profileData.skills = person.skills.slice(0, 15); // Limit to 15 skills
    }

    console.log(`PDL conversion complete: ${profileData.experiences?.length || 0} experiences, ${profileData.education?.length || 0} education, ${profileData.skills?.length || 0} skills`);
    return profileData;
  }

  private formatDate(dateString?: string): string {
    if (!dateString) return "";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;

      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear();
      return `${month} ${year}`;
    } catch {
      return dateString;
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }
}
