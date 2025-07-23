import { type ProfileData } from "@shared/schema";
import { chromium } from "playwright";

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

    // Fallback to Playwright scraping
    try {
      return await this.extractWithPlaywright(linkedinUrl);
    } catch (error) {
      console.error("Playwright extraction failed:", error);
      throw new Error("Failed to extract LinkedIn profile data. Please check if the profile is publicly accessible.");
    }
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

  private async extractWithPlaywright(url: string): Promise<ProfileData> {
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      ]
    });

    const page = await browser.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Wait for content to load
      await page.waitForSelector('h1', { timeout: 10000 });
      
      const html = await page.content();
      const profileData = this.parseLinkedInHtml(html);
      
      await browser.close();
      return profileData;
    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  private parseLinkedInHtml(html: string): ProfileData {
    // Create a simple HTML parser using regex and string manipulation
    // Note: This is a simplified version - in production, consider using a proper HTML parser
    
    const extractTextContent = (pattern: RegExp): string => {
      const match = html.match(pattern);
      return match ? match[1].replace(/<[^>]*>/g, '').trim() : '';
    };

    const extractMultiple = (pattern: RegExp): string[] => {
      const matches = Array.from(html.matchAll(pattern));
      return matches.map(match => match[1].replace(/<[^>]*>/g, '').trim()).filter(Boolean);
    };

    // Extract JSON-LD structured data first
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/s);
    let structuredData: any = null;
    
    if (jsonLdMatch) {
      try {
        structuredData = JSON.parse(jsonLdMatch[1]);
      } catch (e) {
        console.warn("Failed to parse JSON-LD data");
      }
    }

    // Extract basic information
    const name = structuredData?.name || 
                 extractTextContent(/<h1[^>]*class="[^"]*text-heading-xlarge[^"]*"[^>]*>([^<]+)<\/h1>/) ||
                 extractTextContent(/<h1[^>]*>([^<]+)<\/h1>/) ||
                 "Unknown";

    const headline = extractTextContent(/<div[^>]*class="[^"]*text-body-medium[^"]*"[^>]*>([^<]+)<\/div>/) ||
                    extractTextContent(/<div[^>]*class="[^"]*pv-text-details__left-panel[^"]*"[^>]*>.*?<div[^>]*>([^<]+)<\/div>/s);

    const location = extractTextContent(/<span[^>]*class="[^"]*text-body-small[^"]*"[^>]*>([^<]+)<\/span>/) ||
                    extractTextContent(/<span[^>]*class="[^"]*pv-text-details__left-panel[^"]*"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/s);

    const about = extractTextContent(/<div[^>]*class="[^"]*pv-shared-text-with-see-more[^"]*"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/s) ||
                  extractTextContent(/<section[^>]*aria-labelledby="summary"[^>]*>.*?<div[^>]*>([^<]+)<\/div>/s);

    // Extract avatar URL
    const avatarUrl = html.match(/src="([^"]*profile-displayphoto[^"]*)"/) ? 
                     html.match(/src="([^"]*profile-displayphoto[^"]*)"/)![1] : undefined;

    // Extract experiences
    const experiences = [];
    const expMatches = html.matchAll(/<div[^>]*class="[^"]*pvs-entity[^"]*"[^>]*>.*?<span[^>]*class="[^"]*mr1[^"]*"[^>]*aria-hidden="true">([^<]+)<\/span>.*?<span[^>]*>([^<]+)<\/span>.*?<span[^>]*class="[^"]*t-14[^"]*"[^>]*>([^<]+)<\/span>/gs);
    
    for (const match of expMatches) {
      experiences.push({
        title: match[1].trim(),
        company: match[2].trim(),
        start: match[3].trim(),
        end: "Present",
        description: ""
      });
    }

    // Extract education
    const education = [];
    const eduMatches = html.matchAll(/<div[^>]*class="[^"]*pvs-entity[^"]*"[^>]*>.*?<span[^>]*class="[^"]*mr1[^"]*"[^>]*aria-hidden="true">([^<]+)<\/span>.*?<span[^>]*class="[^"]*t-14[^"]*"[^>]*>([^<]+)<\/span>/gs);
    
    for (const match of eduMatches) {
      education.push({
        school: match[1].trim(),
        degree: match[2].trim(),
        field: "",
        start: "",
        end: ""
      });
    }

    // Extract skills
    const skills = extractMultiple(/<span[^>]*class="[^"]*pvs-entity__caption-wrapper[^"]*"[^>]*>([^<]+)<\/span>/g);

    return {
      name,
      headline: headline || undefined,
      location: location || undefined,
      about: about || undefined,
      avatarUrl,
      experiences,
      education,
      skills
    };
  }
}
