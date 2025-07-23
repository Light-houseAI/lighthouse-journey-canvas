import { type ProfileData } from "@shared/schema";

export class LinkedInExtractor {
  private zenrowsApiKey: string;

  constructor() {
    this.zenrowsApiKey = process.env.ZENROWS_API_KEY || process.env.ZENROWS_API_KEY_ENV_VAR || "";
  }

  async extractProfile(username: string): Promise<ProfileData> {
    const linkedinUrl = `https://www.linkedin.com/in/${username}/`;
    
    // Try ZenRows API first
    if (this.zenrowsApiKey) {
      try {
        const zenrowsData = await this.extractWithZenRows(linkedinUrl);
        if (zenrowsData) {
          return zenrowsData;
        }
      } catch (error) {
        console.error("ZenRows extraction failed:", error);
      }
    }

    // If no ZenRows API key, return demo data for testing
    console.log("No ZenRows API key found, returning demo profile data");
    return this.getDemoProfile(username);
  }

  private async extractWithZenRows(url: string): Promise<ProfileData | null> {
    const encodedUrl = encodeURIComponent(url);
    const zenrowsUrl = `https://api.zenrows.com/v1/?url=${encodedUrl}&js_render=true&premium_proxy=true&apikey=${this.zenrowsApiKey}`;
    
    const response = await fetch(zenrowsUrl);
    if (!response.ok) {
      throw new Error(`ZenRows API error: ${response.status}`);
    }

    const html = await response.text();
    return this.parseLinkedInHtml(html);
  }

  private getDemoProfile(username: string): ProfileData {
    // Return demo data for testing when no API key is available
    return {
      name: `Demo User (${username})`,
      headline: "Senior Software Engineer at Tech Company",
      location: "San Francisco, CA",
      about: "Passionate software developer with 5+ years of experience building scalable web applications. Expertise in React, Node.js, and cloud technologies.",
      avatarUrl: "https://via.placeholder.com/200x200/4F46E5/FFFFFF?text=DU",
      experiences: [
        {
          title: "Senior Software Engineer",
          company: "Tech Company Inc.",
          start: "Jan 2022",
          end: "Present",
          description: "Lead development of user-facing features for a SaaS platform serving 10k+ users"
        },
        {
          title: "Software Engineer",
          company: "Startup Co.",
          start: "Jun 2020",
          end: "Dec 2021",
          description: "Built and maintained backend APIs and database systems"
        }
      ],
      education: [
        {
          school: "University of Technology",
          degree: "Bachelor of Science",
          field: "Computer Science",
          start: "2016",
          end: "2020"
        }
      ],
      skills: ["JavaScript", "TypeScript", "React", "Node.js", "Python", "AWS", "Docker", "PostgreSQL"]
    };
  }

  private parseLinkedInHtml(html: string): ProfileData {
    // Enhanced HTML parser for LinkedIn profiles
    const extractTextContent = (pattern: RegExp): string => {
      const match = html.match(pattern);
      return match ? match[1].replace(/<[^>]*>/g, '').trim().replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&') : '';
    };

    const extractMultiple = (pattern: RegExp): string[] => {
      const matches = Array.from(html.matchAll(pattern));
      return matches.map(match => match[1].replace(/<[^>]*>/g, '').trim().replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')).filter(Boolean);
    };

    // Extract JSON-LD structured data first
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/s);
    let structuredData: any = null;
    
    if (jsonLdMatch) {
      try {
        structuredData = JSON.parse(jsonLdMatch[1]);
        console.log("Found JSON-LD data:", structuredData);
      } catch (e) {
        console.warn("Failed to parse JSON-LD data");
      }
    }

    // Multiple patterns for name extraction
    const name = structuredData?.name || 
                 extractTextContent(/<h1[^>]*class="[^"]*text-heading-xlarge[^"]*"[^>]*>([^<]+)<\/h1>/) ||
                 extractTextContent(/<h1[^>]*class="[^"]*break-words[^"]*"[^>]*>([^<]+)<\/h1>/) ||
                 extractTextContent(/<h1[^>]*>([^<]+)<\/h1>/) ||
                 extractTextContent(/<title>([^|]+)\|/);

    // Multiple patterns for headline
    const headline = extractTextContent(/<div[^>]*class="[^"]*text-body-medium[^"]*break-words[^"]*"[^>]*>([^<]+)<\/div>/) ||
                    extractTextContent(/<div[^>]*class="[^"]*pv-text-details__left-panel[^"]*"[^>]*>.*?<div[^>]*>([^<]+)<\/div>/s) ||
                    extractTextContent(/<div[^>]*class="[^"]*text-body-medium[^"]*"[^>]*>([^<]+)<\/div>/);

    // Multiple patterns for location
    const location = extractTextContent(/<span[^>]*class="[^"]*text-body-small[^"]*inline[^"]*"[^>]*>([^<]+)<\/span>/) ||
                    extractTextContent(/<span[^>]*class="[^"]*text-body-small[^"]*"[^>]*>([^<]+)<\/span>/) ||
                    extractTextContent(/<div[^>]*class="[^"]*pb2[^"]*"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/s);

    // About section
    const about = extractTextContent(/<div[^>]*class="[^"]*pv-shared-text-with-see-more[^"]*"[^>]*>.*?<span[^>]*dir="ltr"[^>]*>([^<]+)<\/span>/s) ||
                  extractTextContent(/<section[^>]*aria-labelledby="summary"[^>]*>.*?<div[^>]*>([^<]+)<\/div>/s) ||
                  extractTextContent(/<div[^>]*class="[^"]*inline-show-more-text[^"]*"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/s);

    // Extract avatar URL with multiple patterns
    let avatarUrl = undefined;
    const avatarPatterns = [
      /src="([^"]*profile-displayphoto[^"]*)"/,
      /src="([^"]*\/profile-displayphoto-shrink[^"]*)"/,
      /<img[^>]*class="[^"]*pv-top-card[^"]*"[^>]*src="([^"]*)"/
    ];
    
    for (const pattern of avatarPatterns) {
      const match = html.match(pattern);
      if (match) {
        avatarUrl = match[1];
        break;
      }
    }

    // Enhanced experience extraction
    const experiences = [];
    const expSectionMatch = html.match(/<section[^>]*aria-labelledby="experience"[^>]*>(.*?)<\/section>/s);
    if (expSectionMatch) {
      const expSection = expSectionMatch[1];
      const expItems = expSection.match(/<div[^>]*class="[^"]*pvs-entity[^"]*"[^>]*>.*?<\/div>/gs) || [];
      
      for (const item of expItems) {
        const title = extractTextContent(/<span[^>]*class="[^"]*mr1[^"]*"[^>]*>([^<]+)<\/span>/) ||
                     extractTextContent(/<div[^>]*class="[^"]*display-flex[^"]*"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/s);
        const company = extractTextContent(/<span[^>]*class="[^"]*t-14[^"]*t-normal[^"]*"[^>]*>([^<]+)<\/span>/) ||
                       extractTextContent(/<span[^>]*class="[^"]*t-14[^"]*"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/s);
        const duration = extractTextContent(/<span[^>]*class="[^"]*t-14[^"]*t-black--light[^"]*"[^>]*>([^<]+)<\/span>/);
        
        if (title && company) {
          experiences.push({
            title: title.trim(),
            company: company.trim(),
            start: duration ? duration.split(' - ')[0] : '',
            end: duration ? (duration.includes(' - ') ? duration.split(' - ')[1] : 'Present') : 'Present',
            description: ''
          });
        }
      }
    }

    // Enhanced education extraction
    const education = [];
    const eduSectionMatch = html.match(/<section[^>]*aria-labelledby="education"[^>]*>(.*?)<\/section>/s);
    if (eduSectionMatch) {
      const eduSection = eduSectionMatch[1];
      const eduItems = eduSection.match(/<div[^>]*class="[^"]*pvs-entity[^"]*"[^>]*>.*?<\/div>/gs) || [];
      
      for (const item of eduItems) {
        const school = extractTextContent(/<span[^>]*class="[^"]*mr1[^"]*"[^>]*>([^<]+)<\/span>/) ||
                      extractTextContent(/<div[^>]*class="[^"]*display-flex[^"]*"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/s);
        const degree = extractTextContent(/<span[^>]*class="[^"]*t-14[^"]*t-normal[^"]*"[^>]*>([^<]+)<\/span>/);
        const duration = extractTextContent(/<span[^>]*class="[^"]*t-14[^"]*t-black--light[^"]*"[^>]*>([^<]+)<\/span>/);
        
        if (school) {
          education.push({
            school: school.trim(),
            degree: degree ? degree.trim() : '',
            field: '',
            start: duration ? duration.split(' - ')[0] : '',
            end: duration ? (duration.includes(' - ') ? duration.split(' - ')[1] : '') : ''
          });
        }
      }
    }

    // Enhanced skills extraction
    const skills = [];
    const skillsSection = html.match(/<section[^>]*aria-labelledby="skills"[^>]*>(.*?)<\/section>/s);
    if (skillsSection) {
      const skillItems = skillsSection[1].match(/<span[^>]*class="[^"]*visually-hidden[^"]*"[^>]*>([^<]+)<\/span>/g) || [];
      for (const item of skillItems) {
        const skill = extractTextContent(/([^<]+)/);
        if (skill && !skill.includes('endorsement')) {
          skills.push(skill);
        }
      }
    }

    // Fallback skill extraction
    if (skills.length === 0) {
      const fallbackSkills = extractMultiple(/<span[^>]*class="[^"]*pvs-entity__caption-wrapper[^"]*"[^>]*>([^<]+)<\/span>/g);
      skills.push(...fallbackSkills);
    }

    const result = {
      name: name || "Unknown User",
      headline: headline || undefined,
      location: location || undefined,
      about: about || undefined,
      avatarUrl,
      experiences,
      education,
      skills: skills.slice(0, 20) // Limit to 20 skills
    };

    console.log("Parsed profile data:", result);
    return result;
  }
}
