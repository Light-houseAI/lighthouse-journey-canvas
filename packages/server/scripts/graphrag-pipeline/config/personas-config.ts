/**
 * Enhanced Persona Configuration for Realistic Test User Generation
 *
 * These personas are designed to create diverse, realistic career journeys
 * with meaningful insights based on actual experiences.
 */

export interface PersonaConfig {
  id: string;
  title: string;
  description: string;
  interests: string[];
  careerPath: {
    entry: string[];
    mid: string[];
    senior: string[];
    leadership: string[];
  };
  skills: {
    technical: string[];
    soft: string[];
    tools: string[];
  };
  projectTypes: string[];
  insightThemes: {
    technical: string[];
    leadership: string[];
    growth: string[];
  };
  typicalCompanies: {
    early: string[];  // Where they typically start
    mid: string[];    // Mid-career companies
    late: string[];   // Senior-level companies
  };
}

export const ENHANCED_PERSONAS: PersonaConfig[] = [
  {
    id: 'software_engineer',
    title: 'Software Engineer',
    description: 'Full-stack engineer with experience in modern web technologies',
    interests: ['grow-career', 'start-startup'],
    careerPath: {
      entry: ['Junior Developer', 'Software Engineer I', 'Associate Engineer'],
      mid: ['Software Engineer II', 'Senior Software Engineer'],
      senior: ['Staff Engineer', 'Principal Engineer'],
      leadership: ['Tech Lead', 'Engineering Manager', 'Director of Engineering'],
    },
    skills: {
      technical: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Go', 'GraphQL', 'REST APIs'],
      soft: ['Code Review', 'Mentoring', 'Technical Writing', 'System Design'],
      tools: ['Git', 'Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Jest', 'Webpack'],
    },
    projectTypes: [
      'Microservices Migration',
      'Platform Rebuild',
      'Performance Optimization',
      'API Development',
      'Frontend Redesign',
      'DevOps Infrastructure',
    ],
    insightThemes: {
      technical: [
        'Building for scale vs. building for clarity',
        'The cost of technical debt',
        'When to refactor vs. rewrite',
        'Balancing innovation with stability',
      ],
      leadership: [
        'Growing from IC to tech lead',
        'Building trust with stakeholders',
        'Managing up and sideways',
        'Creating psychological safety',
      ],
      growth: [
        'Learning in public',
        'The importance of side projects',
        'Building a personal brand',
        'Continuous learning strategies',
      ],
    },
    typicalCompanies: {
      early: ['Startups', 'Digital Agencies', 'Bootcamp Companies'],
      mid: ['Scale-ups', 'Mid-size Tech', 'Consulting Firms'],
      late: ['FAANG', 'Enterprise Tech', 'Unicorns'],
    },
  },
  {
    id: 'product_manager',
    title: 'Product Manager',
    description: 'Customer-focused PM with data-driven decision making',
    interests: ['grow-career', 'change-careers'],
    careerPath: {
      entry: ['Associate Product Manager', 'Product Analyst', 'Junior PM'],
      mid: ['Product Manager', 'Senior Product Manager'],
      senior: ['Principal Product Manager', 'Group Product Manager'],
      leadership: ['Director of Product', 'VP Product', 'Chief Product Officer'],
    },
    skills: {
      technical: ['SQL', 'Analytics', 'A/B Testing', 'User Research', 'Roadmapping'],
      soft: ['Stakeholder Management', 'Presentation', 'Negotiation', 'Strategic Thinking'],
      tools: ['Jira', 'Amplitude', 'Mixpanel', 'Figma', 'Notion', 'Linear'],
    },
    projectTypes: [
      'Product Launch',
      'Market Expansion',
      'User Onboarding Redesign',
      'Monetization Strategy',
      'Platform Migration',
      'Growth Experiments',
    ],
    insightThemes: {
      technical: [
        'Data-driven vs. intuition-driven decisions',
        'Building MVPs that scale',
        'Feature prioritization frameworks',
        'Managing technical debt as a PM',
      ],
      leadership: [
        'Influencing without authority',
        'Building cross-functional relationships',
        'Managing competing stakeholder interests',
        'Creating product vision',
      ],
      growth: [
        'Transitioning into product management',
        'Building domain expertise',
        'PM career paths',
        'Building product sense',
      ],
    },
    typicalCompanies: {
      early: ['B2B SaaS Startups', 'E-commerce', 'Mobile Apps'],
      mid: ['Marketplace Platforms', 'Fintech', 'Health Tech'],
      late: ['Big Tech', 'Enterprise Software', 'Platform Companies'],
    },
  },
  {
    id: 'ux_designer',
    title: 'UX/Product Designer',
    description: 'User-centered designer with strong visual and interaction skills',
    interests: ['change-careers', 'find-job'],
    careerPath: {
      entry: ['Junior Designer', 'UX Designer', 'Visual Designer'],
      mid: ['Senior Designer', 'Product Designer'],
      senior: ['Principal Designer', 'Design Lead', 'Staff Designer'],
      leadership: ['Design Manager', 'Director of Design', 'VP Design'],
    },
    skills: {
      technical: ['User Research', 'Wireframing', 'Prototyping', 'Visual Design', 'Interaction Design'],
      soft: ['Empathy', 'Storytelling', 'Collaboration', 'Critique'],
      tools: ['Figma', 'Sketch', 'Adobe Creative Suite', 'Framer', 'Miro', 'Principle'],
    },
    projectTypes: [
      'Design System Creation',
      'Mobile App Design',
      'Responsive Web Design',
      'User Research Study',
      'Accessibility Improvements',
      'Brand Redesign',
    ],
    insightThemes: {
      technical: [
        'Designing for accessibility',
        'Building scalable design systems',
        'Balancing beauty and usability',
        'Design handoff best practices',
      ],
      leadership: [
        'Advocating for design in engineering orgs',
        'Building design culture',
        'Managing design critique',
        'Scaling design teams',
      ],
      growth: [
        'Portfolio development',
        'Design specialization vs. generalization',
        'Transitioning to design from other fields',
        'Building design thinking',
      ],
    },
    typicalCompanies: {
      early: ['Design Agencies', 'Startups', 'Freelance'],
      mid: ['Product Companies', 'Design Consultancies'],
      late: ['Design-Led Companies', 'Big Tech', 'Enterprise'],
    },
  },
  {
    id: 'data_scientist',
    title: 'Data Scientist',
    description: 'ML engineer with strong statistical and engineering skills',
    interests: ['find-job', 'grow-career'],
    careerPath: {
      entry: ['Data Analyst', 'Junior Data Scientist', 'ML Engineer I'],
      mid: ['Data Scientist', 'Senior Data Scientist', 'ML Engineer II'],
      senior: ['Staff Data Scientist', 'Principal Data Scientist', 'Sr Staff DS'],
      leadership: ['ML Lead', 'Data Science Manager', 'Director of ML'],
    },
    skills: {
      technical: ['Python', 'R', 'SQL', 'Machine Learning', 'Deep Learning', 'Statistics'],
      soft: ['Communication', 'Business Acumen', 'Problem Framing', 'Experimentation'],
      tools: ['TensorFlow', 'PyTorch', 'Scikit-learn', 'Jupyter', 'Spark', 'Airflow'],
    },
    projectTypes: [
      'Recommendation System',
      'Fraud Detection',
      'Churn Prediction',
      'NLP Pipeline',
      'Computer Vision',
      'Experimentation Platform',
    ],
    insightThemes: {
      technical: [
        'Model complexity vs. interpretability',
        'Production ML challenges',
        'Data quality over model sophistication',
        'Building ML platforms',
      ],
      leadership: [
        'Bridging data science and business',
        'Building data culture',
        'Managing research vs. production',
        'Scaling ML teams',
      ],
      growth: [
        'PhD vs. industry experience',
        'Specializing in ML domains',
        'Building ML intuition',
        'Staying current with research',
      ],
    },
    typicalCompanies: {
      early: ['Analytics Startups', 'Consulting', 'Academia'],
      mid: ['ML-First Companies', 'Tech Scale-ups'],
      late: ['AI Labs', 'Big Tech', 'Research Organizations'],
    },
  },
  {
    id: 'devops_engineer',
    title: 'DevOps/SRE Engineer',
    description: 'Infrastructure and reliability focused engineer',
    interests: ['grow-career', 'find-job'],
    careerPath: {
      entry: ['Junior DevOps', 'Systems Administrator', 'Cloud Engineer I'],
      mid: ['DevOps Engineer', 'Site Reliability Engineer'],
      senior: ['Senior SRE', 'Principal SRE', 'Staff DevOps'],
      leadership: ['SRE Lead', 'Infrastructure Manager', 'Director of Engineering'],
    },
    skills: {
      technical: ['Linux', 'Networking', 'Cloud Architecture', 'IaC', 'Monitoring', 'Security'],
      soft: ['Incident Management', 'Documentation', 'Cross-team Collaboration'],
      tools: ['Kubernetes', 'Terraform', 'Ansible', 'Prometheus', 'Jenkins', 'AWS/GCP/Azure'],
    },
    projectTypes: [
      'Cloud Migration',
      'CI/CD Pipeline',
      'Monitoring Infrastructure',
      'Disaster Recovery',
      'Security Hardening',
      'Cost Optimization',
    ],
    insightThemes: {
      technical: [
        'Building for reliability',
        'Automation vs. manual intervention',
        'Multi-cloud strategies',
        'Security as a first-class concern',
      ],
      leadership: [
        'Creating on-call culture',
        'Post-mortem best practices',
        'Building platform teams',
        'DevOps transformation',
      ],
      growth: [
        'From sysadmin to SRE',
        'Cloud certification value',
        'Specialization in DevOps',
        'Building operational excellence',
      ],
    },
    typicalCompanies: {
      early: ['Managed Service Providers', 'Small Tech', 'Startups'],
      mid: ['Cloud-Native Companies', 'SaaS Platforms'],
      late: ['Cloud Providers', 'Large Scale Platforms', 'Enterprise'],
    },
  },
];

/**
 * Insight generation templates based on experience level and context
 */
export const INSIGHT_TEMPLATES = {
  earlyCareer: [
    'The importance of asking questions early and often',
    'Learning to read code is as important as writing it',
    'Finding mentors who challenge your thinking',
    'Building confidence through small wins',
    'The value of working on diverse projects',
  ],
  midCareer: [
    'Balancing perfectionism with shipping',
    'The art of technical compromise',
    'Building influence through consistency',
    'Learning when to say no',
    'The importance of written communication',
  ],
  seniorCareer: [
    'Simplicity as the ultimate sophistication',
    'Building systems that outlast you',
    'The responsibility of technical decisions',
    'Mentoring as a growth accelerator',
    'Strategic thinking over tactical execution',
  ],
  leadership: [
    'People over process, always',
    'Creating clarity in ambiguity',
    'The weight of organizational decisions',
    'Building teams that build products',
    'Leading through influence, not authority',
  ],
};

/**
 * Company culture impacts on career growth insights
 */
export const CULTURE_INSIGHTS = {
  startup: [
    'Wearing multiple hats accelerates learning',
    'The importance of scrappiness and resourcefulness',
    'Direct impact on company trajectory',
    'Learning to thrive in ambiguity',
  ],
  scaleup: [
    'Building processes while maintaining agility',
    'The challenge of rapid team growth',
    'Balancing innovation with stability',
    'Creating culture at scale',
  ],
  enterprise: [
    'Navigating organizational complexity',
    'The value of patience and persistence',
    'Building consensus across stakeholders',
    'Impact through systemic change',
  ],
};

/**
 * Project-specific insights based on type
 */
export const PROJECT_INSIGHTS = {
  migration: [
    'Incremental migration beats big-bang approaches',
    'The importance of rollback strategies',
    'Communication is key during transitions',
  ],
  optimization: [
    'Measure first, optimize second',
    'The 80/20 rule applies to performance',
    'User perception matters more than metrics',
  ],
  greenfield: [
    'Starting simple allows for evolution',
    'Document decisions early',
    'Build for the team, not just the problem',
  ],
  maintenance: [
    'Refactoring as you go prevents decay',
    'The value of comprehensive testing',
    'Documentation debt is technical debt',
  ],
};