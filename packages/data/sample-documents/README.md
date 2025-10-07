# Sample Documents for Demo

This directory contains sample documents that can be loaded into the editor for testing the LLM suggestions.

## Files

### Resume Writing

**`lisa-chen-base-resume.md`** (Senior PM - Demo Profile)
- Base resume for Lisa Chen (Senior PM at EnterpriseCloud)
- Intentionally written with weak action verbs and vague descriptions
- Missing quantifiable metrics and specific achievements
- Good for testing resume improvement suggestions

**`jordan-williams-base-resume.md`** (New Graduate)
- Base resume for Jordan Williams (Recent CS Graduate)
- Entry-level resume with informal language and vague descriptions
- Missing specific metrics, impact, and professional formatting
- Good for testing new graduate resume improvement suggestions

**What needs improvement:**
- Generic statements like "Working on B2B infrastructure platform"
- Weak verbs: "Worked on", "Collaborated with", "Helped define"
- No quantifiable metrics (revenue, customers, performance improvements)
- Missing business impact and outcomes
- Vague descriptions without specifics

**Expected LLM suggestions:**
- Use strong action verbs (Led, Architected, Implemented, Reduced, Increased)
- Add quantifiable metrics ($5M revenue, 800+ customers, 60% reduction)
- Focus on outcomes and business impact
- Highlight achievements relevant to network career patterns

### Requirements Documentation

**`sample-requirements-doc.md`**
- Product requirements for real-time collaboration feature
- Intentionally written with vague, non-testable requirements
- Missing specific acceptance criteria and performance metrics
- Good for testing requirements documentation suggestions

**What needs improvement:**
- Vague statements like "should be fast and responsive"
- Non-testable requirements without measurable criteria
- Missing technical specifications (latency, throughput, SLA)
- User stories lack proper format and acceptance criteria
- No specific performance targets or constraints

**Expected LLM suggestions:**
- Use "shall/must" language for functional requirements
- Add measurable acceptance criteria
- Specify performance metrics (p95 latency < 200ms, 99.9% uptime)
- Format user stories as "As a [role], I want [capability] so that [benefit]"
- Include testable acceptance criteria for each requirement

## Usage

These documents can be:
1. Loaded into the editor when testing the application
2. Copied into the textarea to trigger LLM suggestions
3. Used as examples in documentation
4. Modified to test different suggestion scenarios

## Testing Flow

1. **Resume Writing (Senior PM)**:
   - App auto-selects Lisa Chen profile on launch
   - Choose "Resume Writing" intent
   - Copy content from `lisa-chen-base-resume.md`
   - Observe LLM suggestions for improvement with enterprise context

2. **Resume Writing (New Graduate)**:
   - Select Jordan Williams profile
   - Choose "Resume Writing" intent
   - Copy content from `jordan-williams-base-resume.md`
   - Observe LLM suggestions tailored for entry-level candidates

3. **Requirements Documentation**:
   - Use Lisa Chen profile (auto-selected)
   - Choose "Requirements Documentation" intent
   - Copy content from `sample-requirements-doc.md`
   - Observe LLM suggestions for specific, testable requirements
