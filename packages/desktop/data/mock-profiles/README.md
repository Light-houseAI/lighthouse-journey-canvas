# Mock User Profiles

This directory contains 22 diverse mock user profiles for the Lighthouse Insight Assistant POC. The profiles span different experience levels, roles, and focus areas to demonstrate AI-powered writing assistance for both **resume preparation** and **requirements documentation**.

## Profile Distribution

### Experience Levels
- **Junior (5 profiles)**: 1-3 years experience
- **Mid-level (8 profiles)**: 3-7 years experience
- **Senior (9 profiles)**: 7+ years experience

### Role Categories

#### Software Engineering (10 profiles)
1. `junior-frontend-dev.json` - Emily Parker (Junior Frontend Developer, bootcamp grad)
2. `mid-backend-engineer.json` - Marcus Wong (Mid-level Backend Engineer, API design)
3. `senior-fullstack-lead.json` - Priya Sharma (Senior Full-Stack, transitioning to leadership)
4. `mobile-dev-junior.json` - Aisha Patel (Junior iOS Developer, bootcamp)
5. `android-dev-senior.json` - Carlos Santos (Senior Android, Kotlin/Compose)
6. `devops-engineer-senior.json` - David Kim (Senior DevOps, K8s migration)
7. `tech-lead-architect.json` - Robert Nguyen (Staff Engineer, distributed systems)
8. `data-scientist-mid.json` - Sophia Rodriguez (PhD ML, production models)
9. `database-engineer-mid.json` - Natalie Kumar (Database Engineer, PostgreSQL)
10. `site-reliability-engineer.json` - Thomas Wright (SRE, observability)

#### Product & Requirements (6 profiles)
11. `junior-pm-startup.json` - Jake Martinez (Junior PM, learning requirements writing)
12. `senior-pm-enterprise.json` - Lisa Chen (Senior PM, comprehensive technical requirements)
13. `product-manager.json` - Sarah Chen (Senior PM, requirements documentation focus)
14. `product-analyst-junior.json` - Jessica Lee (Junior Analyst, data-driven requirements)
15. `ux-designer-mid.json` - Maya Thompson (UX Designer, user story writing)
16. `scrum-master-agile-coach.json` - Rachel Green (Scrum Master, acceptance criteria)

#### Engineering Operations (3 profiles)
17. `qa-engineer-senior.json` - James Anderson (Senior QA, test automation)
18. `security-engineer-mid.json` - Elena Volkov (Security Engineer, OAuth implementation)
19. `technical-writer-mid.json` - Kevin Brooks (Technical Writer, API documentation)

#### Leadership (3 profiles)
20. `engineering-manager.json` - Amanda Foster (Engineering Manager, team scaling)
21. `startup-founder-cto.json` - Michael Chang (Founder/CTO, 0-to-1 products)
22. `resume-writer.json` - Alex Johnson (Software Engineer, resume optimization focus)

## Resume Writing Profiles

These profiles contain rich examples of quantifiable achievements, metrics-driven descriptions, and career progression:

- **Entry-level**: `junior-frontend-dev.json`, `mobile-dev-junior.json`, `junior-pm-startup.json`
- **Career transitions**: `senior-fullstack-lead.json` (IC to leadership), `engineering-manager.json` (IC to management)
- **Strong quantifiable results**: `resume-writer.json`, `mid-backend-engineer.json`, `devops-engineer-senior.json`
- **Leadership experience**: `tech-lead-architect.json`, `startup-founder-cto.json`

## Requirements Documentation Profiles

These profiles showcase different approaches to writing technical and functional requirements:

- **Learning stage**: `junior-pm-startup.json`, `product-analyst-junior.json`
- **User story expertise**: `ux-designer-mid.json`, `scrum-master-agile-coach.json`
- **Technical requirements**: `senior-pm-enterprise.json`, `tech-lead-architect.json`, `site-reliability-engineer.json`
- **Security requirements**: `security-engineer-mid.json`
- **Database requirements**: `database-engineer-mid.json`
- **API documentation**: `technical-writer-mid.json`

## Key Insight Patterns

Each profile includes contextual insights relevant to their experience level:

### Junior Profiles
- Focus on learning and growth
- Project-based achievements
- Technologies and tools learned
- First production deployments

### Mid-Level Profiles
- Quantifiable performance improvements (40-70% improvements)
- Project ownership
- Cross-team collaboration
- Technical depth in specialization

### Senior Profiles
- Business impact ($XXM revenue, XX% cost savings)
- Team leadership and mentoring
- Architectural decisions
- Strategic initiatives

## Usage in POC

The profile loader (`profile-loader.ts`) automatically loads all JSON files from this directory. Each profile contains:

- **Background**: Education, job history, projects
- **Insights**: Role-specific achievements and learnings
- **Context**: Current role, recent projects, skills
- **Examples**: Resume descriptions or requirements documentation samples

This diversity ensures the LLM can provide contextually appropriate suggestions across different career stages and writing scenarios.
