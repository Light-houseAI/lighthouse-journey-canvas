-- Load fixture data into test database
-- This script loads the test user, profile, and skills from fixture JSON files

-- Insert test user
INSERT INTO users (id, email, password, interest, has_completed_onboarding, created_at) 
VALUES (
    999,
    'test-user@example.com',
    '$2b$10$test.hash.for.test.user.only',
    'grow-career',
    true,
    '2025-07-30T20:40:16.433Z'::timestamp
) ON CONFLICT (id) DO NOTHING;

-- Insert test profile with comprehensive data
INSERT INTO profiles (id, user_id, username, raw_data, filtered_data, projects, created_at) 
VALUES (
    999,
    999,
    'test-user',
    '{
      "name": "sonam mishra",
      "headline": "senior product manager - tech",
      "location": "Washington DC-Baltimore Area",
      "about": "Results-oriented Product Manager with over 10 years of experience managing complex<br>data products and applications across finance and supply chain domains. Proven expertise<br>in leading cross-functional teams, optimizing product strategies, and leveraging data-driven<br>insights to drive business growth and enhance user experiences. Adept at managing product<br>lifecycles from ideation to launch, with a strong track record of improving delivery metrics<br>and stakeholder satisfaction.",
      "experiences": [
        {
          "title": {
            "name": "senior product manager - tech",
            "class": "research_and_development",
            "role": "product",
            "sub_role": "product_management",
            "levels": ["senior"]
          },
          "company": "amazon",
          "description": "",
          "start": "Mar 2025",
          "end": "Present"
        },
        {
          "title": {
            "name": "senior product manager",
            "class": "research_and_development",
            "role": "product",
            "sub_role": "product_management",
            "levels": ["senior"]
          },
          "company": "walmart",
          "description": "",
          "start": "Apr 2024",
          "end": "Mar 2025"
        },
        {
          "title": {
            "name": "teaching assistant",
            "class": "services",
            "role": "education",
            "sub_role": null,
            "levels": []
          },
          "company": "carnegie mellon university",
          "description": "",
          "start": "Jan 2022",
          "end": "May 2022"
        },
        {
          "title": {
            "name": "team lead",
            "class": null,
            "role": null,
            "sub_role": null,
            "levels": ["manager"]
          },
          "company": "accenture",
          "description": "",
          "start": "Dec 2017",
          "end": "May 2020"
        }
      ],
      "education": [
        {
          "school": "Walmart",
          "degree": "",
          "field": "",
          "start": "",
          "end": ""
        },
        {
          "school": "Carnegie Mellon University",
          "degree": "",
          "field": "",
          "start": "",
          "end": ""
        },
        {
          "school": "Accenture in India",
          "degree": "",
          "field": "",
          "start": "",
          "end": ""
        },
        {
          "school": "Dr. A.P.J. Abdul Kalam Technical University",
          "degree": "",
          "field": "",
          "start": "",
          "end": ""
        }
      ],
      "skills": [
        "agile methodologies",
        "ajax",
        "analytical skills",
        "asp.net",
        "business analysis",
        "c",
        "c#",
        "c++",
        "c/c++ stl",
        "core java",
        "html",
        "java",
        "javascript",
        "jsp",
        "microsoft office"
      ]
    }'::jsonb,
    '{
      "name": "sonam mishra",
      "headline": "senior product manager - tech",
      "location": "Washington DC-Baltimore Area",
      "about": "Results-oriented Product Manager with over 10 years of experience managing complex<br>data products and applications across finance and supply chain domains. Proven expertise<br>in leading cross-functional teams, optimizing product strategies, and leveraging data-driven<br>insights to drive business growth and enhance user experiences. Adept at managing product<br>lifecycles from ideation to launch, with a strong track record of improving delivery metrics<br>and stakeholder satisfaction.",
      "experiences": [
        {
          "title": {
            "name": "senior product manager - tech",
            "class": "research_and_development",
            "role": "product",
            "sub_role": "product_management",
            "levels": ["senior"]
          },
          "company": "amazon",
          "description": "",
          "start": "Mar 2025",
          "end": "Present"
        },
        {
          "title": {
            "name": "senior product manager",
            "class": "research_and_development",
            "role": "product",
            "sub_role": "product_management",
            "levels": ["senior"]
          },
          "company": "walmart",
          "description": "",
          "start": "Apr 2024",
          "end": "Mar 2025"
        },
        {
          "title": {
            "name": "teaching assistant",
            "class": "services",
            "role": "education",
            "sub_role": null,
            "levels": []
          },
          "company": "carnegie mellon university",
          "description": "",
          "start": "Jan 2022",
          "end": "May 2022"
        },
        {
          "title": {
            "name": "team lead",
            "class": null,
            "role": null,
            "sub_role": null,
            "levels": ["manager"]
          },
          "company": "accenture",
          "description": "",
          "start": "Dec 2017",
          "end": "May 2020"
        }
      ],
      "education": [
        {
          "school": "Walmart",
          "degree": "",
          "field": "",
          "start": "",
          "end": ""
        },
        {
          "school": "Carnegie Mellon University",
          "degree": "",
          "field": "",
          "start": "",
          "end": ""
        },
        {
          "school": "Accenture in India",
          "degree": "",
          "field": "",
          "start": "",
          "end": ""
        },
        {
          "school": "Dr. A.P.J. Abdul Kalam Technical University",
          "degree": "",
          "field": "",
          "start": "",
          "end": ""
        }
      ],
      "skills": [
        "agile methodologies",
        "ajax",
        "analytical skills",
        "asp.net",
        "business analysis",
        "c",
        "c#",
        "c++",
        "c/c++ stl",
        "core java",
        "html",
        "java",
        "javascript",
        "jsp",
        "microsoft office"
      ]
    }'::jsonb,
    '[
      {
        "id": "sub-subtask-1753397227502-0.8056894378531805-0.9436102156185875",
        "title": "I recently started working on building a PoC fo...",
        "type": "subtask",
        "date": "2025-07-24",
        "description": "I recently started working on building a PoC for allowing internal users to share product improvements",
        "skills": [],
        "organization": "amazon",
        "parentId": "sub-update-1753396256743-0.2850085193719972",
        "isSubMilestone": true
      },
      {
        "id": "milestone-1753428412360-dqajml3p7",
        "type": "sub-milestone",
        "parentId": "experience-1",
        "parentOrganization": "walmart",
        "title": "Improve delivery time transparency",
        "description": "The existing delivery interface presented customers with ambiguous delivery windows...",
        "dateRange": "Recently completed",
        "location": "walmart",
        "starDetails": {
          "situation": "The existing delivery interface presented customers with ambiguous delivery windows...",
          "task": "Improve delivery time transparency",
          "action": "I led the design and launch of a Smart Delivery Promise module...",
          "result": "Checkout conversion ↑ 7.4% post-launch..."
        },
        "isSubMilestone": true
      }
    ]'::jsonb,
    '2025-07-30T20:40:16.434Z'::timestamp
) ON CONFLICT (id) DO NOTHING;

-- Note: test-skills-template.json is empty, so no skills data to insert

-- Verify data was loaded
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM users WHERE id = 999) > 0 THEN
        RAISE NOTICE 'Test user loaded successfully (ID: 999)';
    END IF;
    
    IF (SELECT COUNT(*) FROM profiles WHERE user_id = 999) > 0 THEN
        RAISE NOTICE 'Test profile loaded successfully';
    END IF;
END $$;