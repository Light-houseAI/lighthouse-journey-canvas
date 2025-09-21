/**
 * Diversity Matrix Configuration
 * Defines the distribution of profiles across roles, experience levels, and demographics
 */

export type RoleType = 'engineer' | 'pm' | 'designer';
export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'staff';

export interface RoleDistribution {
  role: RoleType;
  percentage: number; // Percentage of total profiles
  experienceLevels: {
    level: ExperienceLevel;
    percentage: number; // Percentage within this role
    yearsRange: [number, number];
    titles: string[];
  }[];
}

export interface DiversityProfile {
  names: {
    male: string[];
    female: string[];
    neutral: string[];
  };
  companies: {
    faang: string[];
    unicorn: string[];
    startup: string[];
    enterprise: string[];
  };
  universities: {
    topTier: string[];
    regional: string[];
    international: string[];
    bootcamp: string[];
  };
}

/**
 * Role distribution configuration
 */
export const ROLE_DISTRIBUTIONS: RoleDistribution[] = [
  {
    role: 'engineer',
    percentage: 40, // 40% of all profiles
    experienceLevels: [
      {
        level: 'junior',
        percentage: 20,
        yearsRange: [1, 3],
        titles: ['Junior Software Engineer', 'Software Engineer I', 'Junior Developer'],
      },
      {
        level: 'mid',
        percentage: 35,
        yearsRange: [3, 6],
        titles: ['Software Engineer', 'Software Engineer II', 'Full Stack Engineer'],
      },
      {
        level: 'senior',
        percentage: 30,
        yearsRange: [6, 10],
        titles: ['Senior Software Engineer', 'Senior Engineer', 'Lead Engineer'],
      },
      {
        level: 'staff',
        percentage: 15,
        yearsRange: [10, 20],
        titles: ['Staff Engineer', 'Principal Engineer', 'Distinguished Engineer'],
      },
    ],
  },
  {
    role: 'pm',
    percentage: 30, // 30% of all profiles
    experienceLevels: [
      {
        level: 'junior',
        percentage: 20,
        yearsRange: [1, 3],
        titles: ['Associate Product Manager', 'Product Manager I', 'Junior PM'],
      },
      {
        level: 'mid',
        percentage: 30,
        yearsRange: [3, 6],
        titles: ['Product Manager', 'Product Manager II', 'Senior Product Manager'],
      },
      {
        level: 'senior',
        percentage: 30,
        yearsRange: [6, 10],
        titles: ['Senior Product Manager', 'Lead Product Manager', 'Principal PM'],
      },
      {
        level: 'staff',
        percentage: 20,
        yearsRange: [10, 20],
        titles: ['Director of Product', 'VP Product', 'Head of Product'],
      },
    ],
  },
  {
    role: 'designer',
    percentage: 30, // 30% of all profiles
    experienceLevels: [
      {
        level: 'junior',
        percentage: 20,
        yearsRange: [1, 3],
        titles: ['Junior Designer', 'UX Designer I', 'Product Designer I'],
      },
      {
        level: 'mid',
        percentage: 40,
        yearsRange: [3, 6],
        titles: ['UX Designer', 'Product Designer', 'UI/UX Designer'],
      },
      {
        level: 'senior',
        percentage: 30,
        yearsRange: [6, 10],
        titles: ['Senior Product Designer', 'Senior UX Designer', 'Lead Designer'],
      },
      {
        level: 'staff',
        percentage: 10,
        yearsRange: [10, 20],
        titles: ['Principal Designer', 'Design Director', 'Head of Design'],
      },
    ],
  },
];

/**
 * Diversity profiles for realistic data generation
 */
export const DIVERSITY_PROFILES: DiversityProfile = {
  names: {
    male: [
      'James Chen', 'Marcus Johnson', 'David Kim', 'Carlos Rodriguez', 
      'Michael Brown', 'Robert Singh', 'Daniel Lee', 'Christopher Martinez',
      'Kevin Wang', 'Brian Park', 'Ryan Thompson', 'Tom Wilson',
      'Jake Miller', 'Lucas Brown', 'Nathan Lee', 'Oliver Wright',
      'Diego Lopez', 'Raj Patel', 'Ahmed Hassan', 'Ivan Petrov',
    ],
    female: [
      'Elena Rodriguez', 'Sarah Williams', 'Lisa Thompson', 'Maria Garcia',
      'Jennifer Lee', 'Amanda Davis', 'Jessica Martinez', 'Emily Chen',
      'Rachel Green', 'Sophia Lopez', 'Jessica Park', 'Priya Patel',
      'Nina Zhang', 'Emma Johnson', 'Aria Singh', 'Isabella Martinez',
      'Maya Patel', 'Zoe Chen', 'Sofia Rodriguez', 'Grace Wang',
      'Chloe Johnson', 'Fatima Ali', 'Yuki Tanaka', 'Anastasia Volkov',
    ],
    neutral: [
      'Alex Kim', 'Jordan Smith', 'Taylor Johnson', 'Casey Brown',
      'Morgan Davis', 'Riley Chen', 'Jamie Park', 'Sam Wilson',
      'Avery Martinez', 'Quinn Thompson', 'River Lee', 'Sage Rodriguez',
    ],
  },
  companies: {
    faang: [
      'Google', 'Meta', 'Amazon', 'Apple', 'Netflix', 'Microsoft',
    ],
    unicorn: [
      'Stripe', 'Airbnb', 'Uber', 'Spotify', 'Databricks', 'Canva',
      'Notion', 'Figma', 'Linear', 'Vercel', 'Snowflake', 'Instacart',
    ],
    startup: [
      'TechStartup Inc', 'AI Innovations', 'CloudFirst', 'DataFlow',
      'AppCraft', 'WebScale', 'MobileFirst', 'DevTools Pro',
    ],
    enterprise: [
      'IBM', 'Oracle', 'SAP', 'Salesforce', 'Adobe', 'VMware',
      'Cisco', 'Intel', 'HP', 'Dell', 'Accenture', 'Deloitte',
    ],
  },
  universities: {
    topTier: [
      'MIT', 'Stanford', 'Carnegie Mellon', 'UC Berkeley', 'Harvard',
      'Princeton', 'Caltech', 'Cornell', 'Columbia', 'Yale',
    ],
    regional: [
      'University of Washington', 'Georgia Tech', 'UIUC', 'UT Austin',
      'UCLA', 'UCSD', 'NYU', 'University of Michigan', 'Duke', 'Northwestern',
    ],
    international: [
      'University of Toronto', 'University of Waterloo', 'ETH Zurich',
      'Cambridge', 'Oxford', 'IIT Delhi', 'NUS', 'University of Tokyo',
    ],
    bootcamp: [
      'General Assembly', 'Hack Reactor', 'Lambda School', 'Springboard',
      'CareerFoundry', 'Thinkful', 'BrainStation', 'Le Wagon',
    ],
  },
};

/**
 * Calculate the number of profiles for each category
 */
export function calculateDistribution(totalProfiles: number): Map<string, number> {
  const distribution = new Map<string, number>();
  
  for (const roleConfig of ROLE_DISTRIBUTIONS) {
    const roleCount = Math.round((totalProfiles * roleConfig.percentage) / 100);
    distribution.set(roleConfig.role, roleCount);
    
    for (const level of roleConfig.experienceLevels) {
      const levelCount = Math.round((roleCount * level.percentage) / 100);
      distribution.set(`${roleConfig.role}_${level.level}`, levelCount);
    }
  }
  
  return distribution;
}

/**
 * Get a random item from an array
 */
export function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Get a diverse name based on index for consistent distribution
 */
export function getDiverseName(index: number): string {
  const allNames = [
    ...DIVERSITY_PROFILES.names.male,
    ...DIVERSITY_PROFILES.names.female,
    ...DIVERSITY_PROFILES.names.neutral,
  ];
  
  // Use modulo to ensure we cycle through names if we have more profiles than names
  return allNames[index % allNames.length];
}

/**
 * Get company distribution based on experience level
 */
export function getCompanyForLevel(level: ExperienceLevel): string {
  const { faang, unicorn, startup, enterprise } = DIVERSITY_PROFILES.companies;
  
  // Junior level: More likely to be at startups or unicorns
  if (level === 'junior') {
    const pool = [...startup, ...startup, ...unicorn, ...enterprise];
    return randomChoice(pool);
  }
  
  // Mid level: Mix of all company types
  if (level === 'mid') {
    const pool = [...faang, ...unicorn, ...startup, ...enterprise];
    return randomChoice(pool);
  }
  
  // Senior level: More likely at established companies
  if (level === 'senior') {
    const pool = [...faang, ...faang, ...unicorn, ...enterprise];
    return randomChoice(pool);
  }
  
  // Staff level: Mostly at FAANG and established companies
  const pool = [...faang, ...faang, ...faang, ...unicorn];
  return randomChoice(pool);
}

/**
 * Get education background based on role
 */
export function getEducationForRole(role: RoleType): {
  university: string;
  degree: string;
} {
  const { topTier, regional, international, bootcamp } = DIVERSITY_PROFILES.universities;
  
  if (role === 'engineer') {
    // Mix of traditional CS and bootcamp backgrounds
    const hasTraditionalDegree = Math.random() > 0.2; // 80% traditional
    
    if (hasTraditionalDegree) {
      const unis = [...topTier, ...regional, ...international];
      return {
        university: randomChoice(unis),
        degree: randomChoice(['B.S. Computer Science', 'B.S. Software Engineering', 'B.S. Computer Engineering']),
      };
    } else {
      return {
        university: randomChoice(bootcamp),
        degree: 'Full Stack Web Development Certificate',
      };
    }
  }
  
  if (role === 'pm') {
    // Mix of business and technical backgrounds
    const unis = [...topTier, ...regional];
    return {
      university: randomChoice(unis),
      degree: randomChoice(['MBA', 'B.S. Computer Science', 'B.A. Business Administration', 'B.S. Information Systems']),
    };
  }
  
  // Designer
  const hasDesignDegree = Math.random() > 0.3; // 70% design degree
  if (hasDesignDegree) {
    const unis = [...topTier, ...regional, ...international];
    return {
      university: randomChoice(unis),
      degree: randomChoice(['B.F.A. Graphic Design', 'B.A. Human-Computer Interaction', 'B.S. Digital Media', 'M.F.A. Design']),
    };
  } else {
    return {
      university: randomChoice(bootcamp),
      degree: 'UX/UI Design Certificate',
    };
  }
}