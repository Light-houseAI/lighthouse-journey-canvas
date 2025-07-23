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
    // Simplified ZenRows parameters to avoid 400 errors
    const zenrowsUrl = `https://api.zenrows.com/v1/?url=${encodedUrl}&js_render=true&apikey=${this.zenrowsApiKey}`;
    
    console.log("Making ZenRows request to:", url);
    console.log("API key length:", this.zenrowsApiKey.length);
    
    const response = await fetch(zenrowsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      const responseText = await response.text();
      console.error("ZenRows API error:", response.status, response.statusText);
      console.error("Response body:", responseText);
      throw new Error(`ZenRows API error: ${response.status} - ${responseText}`);
    }

    const html = await response.text();
    console.log("Received HTML length:", html.length);
    console.log("HTML preview (first 500 chars):", html.substring(0, 500));
    
    // Check if LinkedIn blocked the request
    if (html.includes('authwall') || html.includes('sign in') || html.includes('Join now')) {
      console.warn("LinkedIn may be blocking access - authwall detected");
    }
    
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
    let personData: any = null;
    
    if (jsonLdMatch) {
      try {
        structuredData = JSON.parse(jsonLdMatch[1]);
        console.log("Found JSON-LD data:", structuredData);
        
        // Find the Person object in the JSON-LD data
        if (structuredData['@graph']) {
          personData = structuredData['@graph'].find((item: any) => item['@type'] === 'Person');
        } else if (structuredData['@type'] === 'Person') {
          personData = structuredData;
        }
        
        if (personData) {
          console.log("Found person data:");
          console.log("- jobTitle:", personData.jobTitle);
          console.log("- worksFor:", personData.worksFor);
          console.log("- alumniOf:", personData.alumniOf);
          console.log("- description:", personData.description);
          console.log("- address:", personData.address);
        }
      } catch (e) {
        console.warn("Failed to parse JSON-LD data");
      }
    }

    // Multiple patterns for name extraction, prioritizing JSON-LD
    const name = personData?.name || 
                 structuredData?.name || 
                 extractTextContent(/<h1[^>]*class="[^"]*text-heading-xlarge[^"]*"[^>]*>([^<]+)<\/h1>/) ||
                 extractTextContent(/<h1[^>]*class="[^"]*break-words[^"]*"[^>]*>([^<]+)<\/h1>/) ||
                 extractTextContent(/<h1[^>]*>([^<]+)<\/h1>/) ||
                 extractTextContent(/<title>([^|]+)\|/);

    // Extract data from JSON-LD with fallback to HTML parsing
    let headline = undefined;
    if (personData?.jobTitle) {
      if (Array.isArray(personData.jobTitle) && personData.jobTitle.length > 0) {
        headline = personData.jobTitle[0];
      } else if (typeof personData.jobTitle === 'string') {
        headline = personData.jobTitle;
      }
    }
    if (!headline) {
      headline = extractTextContent(/<div[^>]*class="[^"]*text-body-medium[^"]*break-words[^"]*"[^>]*>([^<]+)<\/div>/) ||
                 extractTextContent(/<div[^>]*class="[^"]*pv-text-details__left-panel[^"]*"[^>]*>.*?<div[^>]*>([^<]+)<\/div>/s) ||
                 extractTextContent(/<div[^>]*class="[^"]*text-body-medium[^"]*"[^>]*>([^<]+)<\/div>/);
    }

    // Location from JSON-LD or HTML
    let location = undefined;
    if (personData?.address) {
      location = personData.address.addressLocality || personData.address.name || personData.address.addressRegion;
    }
    if (!location) {
      location = extractTextContent(/<span[^>]*class="[^"]*text-body-small[^"]*inline[^"]*"[^>]*>([^<]+)<\/span>/) ||
                extractTextContent(/<span[^>]*class="[^"]*text-body-small[^"]*"[^>]*>([^<]+)<\/span>/) ||
                extractTextContent(/<div[^>]*class="[^"]*pb2[^"]*"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/s);
    }

    // About section from JSON-LD or HTML
    let about = personData?.description;
    if (!about) {
      about = extractTextContent(/<div[^>]*class="[^"]*pv-shared-text-with-see-more[^"]*"[^>]*>.*?<span[^>]*dir="ltr"[^>]*>([^<]+)<\/span>/s) ||
              extractTextContent(/<section[^>]*aria-labelledby="summary"[^>]*>.*?<div[^>]*>([^<]+)<\/div>/s) ||
              extractTextContent(/<div[^>]*class="[^"]*inline-show-more-text[^"]*"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/s);
    }

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

    // Extract experience from JSON-LD first, then HTML
    const experiences = [];
    
    // From JSON-LD worksFor data
    if (personData?.worksFor && Array.isArray(personData.worksFor)) {
      for (const work of personData.worksFor) {
        if (work.name) {
          experiences.push({
            title: work.jobTitle || 'Position at',
            company: work.name,
            start: '',
            end: 'Present',
            description: work.description || ''
          });
        }
      }
    }
    
    // Fallback to HTML parsing if no JSON-LD experience data
    if (experiences.length === 0) {
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
    }

    // Extract education from JSON-LD first, then HTML
    const education = [];
    
    // From JSON-LD alumniOf data
    if (personData?.alumniOf && Array.isArray(personData.alumniOf)) {
      for (const edu of personData.alumniOf) {
        if (edu.name) {
          education.push({
            school: edu.name,
            degree: edu.programName || '',
            field: edu.educationalCredentialAwarded || '',
            start: '',
            end: ''
          });
        }
      }
    }
    
    // Fallback to HTML parsing if no JSON-LD education data
    if (education.length === 0) {
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

    console.log("Extraction results:");
    console.log("- Name:", result.name);
    console.log("- Headline:", result.headline);
    console.log("- Location:", result.location);
    console.log("- About:", result.about ? result.about.substring(0, 100) + "..." : "None");
    console.log("- Avatar URL:", result.avatarUrl);
    console.log("- Experiences count:", result.experiences.length);
    console.log("- Education count:", result.education.length);
    console.log("- Skills count:", result.skills.length);
    
    if (result.experiences.length === 0 && result.education.length === 0 && result.skills.length === 0) {
      console.warn("WARNING: No experience, education, or skills data extracted. LinkedIn may be showing an auth wall or limited content.");
    }

    return result;
  }
}
