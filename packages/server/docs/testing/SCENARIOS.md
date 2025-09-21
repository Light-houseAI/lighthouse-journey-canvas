# Career Agent Test Scenarios

A comprehensive guide to testing scenarios for understanding and validating career agent behavior.

## 📋 Overview

This document provides an organized list of test scenarios based on the current test suite structure. Each scenario tests specific agent behaviors and helps validate the intelligent conversation flow.

## 🎯 Agent Capabilities Being Tested

### Core Functions:
- **Add Experience**: Creating new work experiences
- **Add Project**: Adding projects to existing experiences  
- **Conversation Flow**: Multi-turn dialogues and clarifications
- **Duplicate Detection**: Handling similar/duplicate entries
- **Error Handling**: Graceful handling of edge cases

---

## 🏢 ADD EXPERIENCE SCENARIOS

### **Basic Scenarios** (`add-experience/basic-scenarios.test.ts`)
Tests core experience creation functionality

| Scenario | Input Example | Expected Behavior |
|----------|---------------|-------------------|
| **Complete Details** | "Add my Software Engineer role at TechCorp from January 2020 to December 2022" | ✅ Creates experience with all fields |
| **Current Role** | "I started as Senior Developer at StartupCo in March 2023 and still work there" | ✅ Creates experience without end date |
| **Rich Description** | "Add my Principal Engineer position at BigTech where I led ML platform development" | ✅ Captures description details |
| **Minimal Details** | "Add my Developer role at WebCorp from 2019 to 2020" | ✅ Handles sparse input |
| **Date Formats** | "Add my QA Engineer role at TestCorp from June 2018 to Aug 2019" | ✅ Parses various date formats |
| **Well-known Company** | "I worked as Software Engineer at Google from 2017 to 2019" | ✅ Handles recognizable companies |
| **Complex Titles** | "Add my Senior Full Stack Software Engineer role at InnovateTech" | ✅ Processes multi-word titles |
| **Agent Response Quality** | Any successful addition | ✅ Provides contextual, non-template responses |

### **Conversation Flow** (`add-experience/conversation-flow.test.ts`)  
Tests multi-turn conversations and clarification handling

| Scenario | Input Example | Expected Behavior |
|----------|---------------|-------------------|
| **Insufficient Details** | "I want to add my work experience" | ❓ Asks for company, role, dates |
| **Missing Company** | "Add my Software Engineer position that I started in 2021" | ❓ Asks which company |
| **Missing Role** | "I worked at Google from 2019 to 2021" | ❓ Asks what role/position |
| **Missing Dates** | "Add my Product Manager role at Apple" | ❓ Asks for start date |
| **Multi-turn Flow** | "I want to add a job" → "Frontend Developer at Netflix from 2020-2022" | ✅ Continues from clarification |
| **Vague References** | "Add my engineer role at the startup I worked at" | ❓ Asks for startup name |
| **Ambiguous Roles** | "Add the role I had at Microsoft" | ❓ Asks for specific role |
| **Interrupted Conversation** | Same thread ID after disconnect | ✅ Resumes context |
| **Generic Requests** | "Help me add something to my work history" | 💡 Provides helpful guidance |
| **Response Quality** | Any clarification request | ✅ Contextual questions, not templates |

### **Edge Cases** (`add-experience/edge-cases.test.ts`)
Tests error handling and robustness

| Scenario | Input Example | Expected Behavior |
|----------|---------------|-------------------|
| **Invalid Dates** | "Add my Developer role at TechCorp from yesterday to tomorrow" | ⚠️ Handles gracefully, asks clarification |
| **Future Start Date** | "Add my Software Engineer role at FutureCorp starting in January 2027" | ⚠️ Questions future date |
| **Date Logic Error** | "Add my Manager role at LogicCorp from 2022 to 2020" | ⚠️ Catches inconsistent dates |
| **Long Company Name** | "Add my Engineer role at [200+ character company name]" | ✅ Handles without errors |
| **Long Description** | Experience with 500+ word description | ✅ Processes/truncates appropriately |
| **Special Characters** | "Add my Developer role at Tech@Co! & Partners #1 Solutions" | ✅ Handles character encoding |
| **Empty Input** | "   " (whitespace only) | ✅ Responds helpfully |
| **Conflicting Info** | "Add my current role as Engineer at Google that ended in 2020" | ⚠️ Identifies conflicts |
| **Multiple Experiences** | "Add my role at Google 2018-2020 and Manager at Facebook 2020-2022" | 📝 Handles appropriately |
| **Robust Error Handling** | Various challenging inputs | ✅ No crashes, meaningful responses |
| **Agent-driven Errors** | Any error scenario | ✅ Contextual error messages |

### **Validation** (`add-experience/validation.test.ts`)
Tests data integrity and format validation

| Scenario | Input Example | Expected Behavior |
|----------|---------------|-------------------|
| **Required Fields** | Any valid experience | ✅ All required fields present |
| **Date Format Consistency** | Various date inputs | ✅ Consistent date storage |
| **Profile State Consistency** | After experience addition | ✅ Profile remains valid |
| **Data Sanitization** | Input with extra whitespace/mixed case | ✅ Clean, normalized data |
| **Experience ID Uniqueness** | Multiple experience additions | ✅ All IDs unique |
| **Optional Fields** | With/without descriptions | ✅ Handles optional data |
| **Current Experience** | "still work there" | ✅ No end date set |
| **Database Persistence** | Experience addition | ✅ Data persists correctly |
| **Array Ordering** | Multiple experiences | ✅ Consistent ordering |
| **Response Quality** | Validation scenarios | ✅ Meaningful success messages |

### **Duplicate Detection** (`add-experience/duplicate-detection.test.ts`)
Tests handling of similar/duplicate experiences

| Scenario | Input Example | Expected Behavior |
|----------|---------------|-------------------|
| **Potential Duplicate** | Same company/role, different dates | ❓ Confirms intention |
| **Different Roles** | Same company, different positions | ✅ Recognizes as separate |
| **Similar Company Names** | "Google" vs "Google Inc" | ❓ Asks if same company |
| **Overlapping Dates** | Same company, overlapping time periods | ⚠️ Questions overlap |
| **Role Progression** | Junior → Senior at same company | ✅ Handles as progression |
| **Different Companies** | "Apple Corp" vs "Apple Inc" | ✅ Treats as separate |
| **Exact Duplicate** | Identical experience details | ⚠️ Prevents/confirms duplicate |
| **Update vs Add** | Similar to existing with more details | 💡 Suggests update |
| **Multiple Stints** | Same company, different time periods | ✅ Recognizes as separate |
| **Agent-driven Detection** | Any duplicate scenario | ✅ Intelligent, contextual responses |

---

## 📁 ADD PROJECT TO EXPERIENCE SCENARIOS

### **Basic Scenarios** (`add-project-to-experience/basic-scenarios.test.ts`)
Tests core project addition functionality

| Scenario | Input Example | Expected Behavior |
|----------|---------------|-------------------|
| **Well-known Company** | "Add a Database Optimization project to my TechCorp experience" | ✅ Finds experience, adds project |
| **Healthcare Context** | "Add a FHIR Integration project to my Optum healthcare experience" | ✅ Domain-specific handling |
| **Minimal Details** | "Add a Security Audit project to TechCorp" | ✅ Handles sparse input |
| **Rich Details** | "Add Microservices Architecture project using Docker, Kubernetes from Jan-Mar 2024" | ✅ Captures all details |

### **Conversation Flow** (`add-project-to-experience/conversation-flow.test.ts`)
Tests project-specific conversation handling

| Scenario | Input Example | Expected Behavior |
|----------|---------------|-------------------|
| **Insufficient Details** | "Add a project to my work" | ❓ Asks for project and company details |
| **Missing Company** | "Add a machine learning project I worked on" | ❓ Asks which company/experience |
| **Continuation Flow** | "I want to add a project" → "React dashboard at TechCorp with TypeScript" | ✅ Continues conversation |
| **Project Type Clarification** | "Add the big project I did at Google" | ❓ Asks what kind of project |
| **Interrupted Resume** | Resume conversation with same thread | ✅ Maintains context |
| **Ambiguous References** | "Add that API project we discussed" | ❓ Asks for clarification |
| **Helpful Guidance** | "Help me add something to my profile" | 💡 Provides examples/guidance |

### **Multiple Roles** (`add-project-to-experience/multiple-roles.test.ts`)
Tests role-specific targeting when multiple roles exist at same company

| Scenario | Input Example | Expected Behavior |
|----------|---------------|-------------------|
| **Role-specific Request** | "Add project to ABCO when I was principal software engineer" | 🎯 Targets correct role |
| **Semantic Search** | General ABCO search | 🔍 Finds multiple experiences |
| **Case Insensitive** | "abco" vs "ABCO" vs "Abco" | ✅ Matches regardless of case |
| **Disambiguation** | Ambiguous company reference | ❓ Asks which role/period |

### **Novel Companies** (`add-project-to-experience/novel-companies.test.ts`)
Tests generalization beyond training examples

| Scenario | Input Example | Expected Behavior |
|----------|---------------|-------------------|
| **Meta/Facebook** | "Add React Native project to Meta experience" | ✅ Handles novel company |
| **Netflix** | "Add Recommendation Algorithm project to Netflix" | ✅ Data science context |
| **Spotify** | "Add Kubernetes Migration to Spotify DevOps role" | ✅ Infrastructure context |
| **Stripe** | "Add Payment API project to Stripe backend role" | ✅ Fintech context |
| **Adobe** | "Add Photoshop Plugin to Adobe Creative role" | ✅ Creative software context |

### **Insufficient Details** (`add-project-to-experience/insufficient-details.test.ts`)
Tests handling of incomplete project information

| Scenario | Input Example | Expected Behavior |
|----------|---------------|-------------------|
| **Missing Project Name** | "Add to my Google experience" | ❓ Asks what project |
| **Missing Company** | "Add my React project" | ❓ Asks which company |
| **Vague Description** | "Add the thing I worked on" | ❓ Asks for specifics |
| **Multiple Missing** | "Add something" | ❓ Asks for all needed info |

### **Edge Cases** (`add-project-to-experience/edge-cases.test.ts`)
Tests error handling for project scenarios

| Scenario | Input Example | Expected Behavior |
|----------|---------------|-------------------|
| **Non-existent Company** | "Add project to CompanyThatDoesntExist" | 💡 Suggests creating experience first |
| **Very Long Description** | Project with 1000+ character description | ✅ Handles without errors |
| **Special Characters** | Project with emoji/symbols | ✅ Proper encoding |
| **Empty Messages** | Whitespace-only input | ✅ Helpful response |
| **Multiple Projects** | "Add React dashboard and Vue component" | 📝 Handles appropriately |

---

## 🔍 AGENT BEHAVIOR VALIDATION

### **Response Quality Indicators**
All test scenarios validate that the agent provides:

- **Contextual Responses**: Mentions specific companies, roles, projects
- **Non-template Language**: Avoids generic "OK", "Success", "Error" messages  
- **Intelligent Clarifications**: Asks relevant follow-up questions
- **Helpful Guidance**: Provides examples when users are stuck
- **Professional Tone**: Maintains conversational, helpful demeanor

### **Expected Agent Capabilities**

| Capability | Description | Test Coverage |
|------------|-------------|---------------|
| **Natural Language Processing** | Understands varied input formats | ✅ All scenarios |
| **Context Retention** | Maintains conversation state | ✅ Multi-turn tests |
| **Semantic Search** | Finds relevant experiences/projects | ✅ Multiple role tests |
| **Duplicate Detection** | Identifies similar entries | ✅ Duplicate scenarios |
| **Data Validation** | Ensures data integrity | ✅ Validation tests |
| **Error Recovery** | Handles edge cases gracefully | ✅ Edge case tests |
| **Clarification Requests** | Asks for missing information | ✅ Conversation flow tests |
| **Response Generation** | Provides contextual feedback | ✅ All test categories |

---

## 🚀 Running Scenario Tests

### **Execute All Scenarios**
```bash
# Run all add-experience tests
npm test server/tests/add-experience/

# Run all add-project-to-experience tests  
npm test server/tests/add-project-to-experience/

# Run specific scenario category
npm test server/tests/add-experience/basic-scenarios.test.ts
npm test server/tests/add-project-to-experience/conversation-flow.test.ts
```

### **Individual Test Execution**
```bash
# Run specific test
npm test -- --testNamePattern="should add new experience with all required fields"

# Run with debugging
DEBUG=test:* npm test server/tests/add-experience/basic-scenarios.test.ts
```

---

## 📊 Understanding Test Results

### **Success Indicators**
- ✅ `result.updatedProfile === true` (Profile was modified)
- ✅ Response contains specific context (company/role names)
- ✅ Database state validates correctly
- ✅ Agent provides meaningful feedback

### **Expected Clarification Patterns**
- ❓ "What company did you work at?"
- ❓ "What was your role/position?"
- ❓ "When did you start/end?"  
- ❓ "What kind of project was it?"
- ❓ "Can you provide more details?"

### **Quality Response Examples**
- 🎯 "Successfully added your Software Engineer experience at Google!"
- 🎯 "I found your TechCorp experience and added the Database Optimization project."
- 🎯 "I see you have multiple roles at ABCO. Which position was this project for?"

---

This scenario guide helps developers and testers understand expected agent behavior across all conversation patterns, ensuring comprehensive validation of the career assistant's capabilities.