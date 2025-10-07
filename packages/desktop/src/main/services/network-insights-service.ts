import { NetworkInsights, NetworkConnection, CareerPath } from '../../shared/types'

/**
 * Service to generate mock network insights from user profile
 * In a real app, this would query a graph database of connections
 */
export class NetworkInsightsService {
  generateMockInsights(userId: string, currentRole: string | null): NetworkInsights {
    // Mock connections based on user's role
    const connections: NetworkConnection[] = [
      {
        id: 'conn-1',
        name: 'Sarah Chen',
        currentRole: 'Senior Engineering Manager',
        currentCompany: 'Google',
        relationshipStrength: 'strong',
        sharedExperience: [
          {
            type: 'company',
            name: 'Tech Corp',
            timeOverlap: {
              start: '2020-01',
              end: '2022-06'
            }
          },
          {
            type: 'skill',
            name: 'Microservices Architecture'
          }
        ]
      },
      {
        id: 'conn-2',
        name: 'Michael Rodriguez',
        currentRole: 'Staff Software Engineer',
        currentCompany: 'Meta',
        relationshipStrength: 'medium',
        sharedExperience: [
          {
            type: 'school',
            name: 'MIT'
          },
          {
            type: 'skill',
            name: 'Distributed Systems'
          }
        ]
      },
      {
        id: 'conn-3',
        name: 'Jessica Park',
        currentRole: 'Principal Engineer',
        currentCompany: 'Amazon',
        relationshipStrength: 'strong',
        sharedExperience: [
          {
            type: 'project',
            name: 'Cloud Migration Initiative'
          },
          {
            type: 'company',
            name: 'Startup Inc',
            timeOverlap: {
              start: '2018-03',
              end: '2019-12'
            }
          }
        ]
      }
    ]

    const careerPaths: CareerPath[] = [
      {
        description: 'Senior Engineer → Staff Engineer → Principal Engineer at FAANG',
        examplePeople: ['Jessica Park', 'Michael Rodriguez'],
        commonTransitions: [
          'Increased scope to multi-team impact',
          'Led architectural decisions',
          'Mentored senior engineers'
        ],
        timeframe: '5-8 years'
      },
      {
        description: 'Senior Engineer → Engineering Manager → Senior Manager',
        examplePeople: ['Sarah Chen'],
        commonTransitions: [
          'Transitioned from IC to management',
          'Built and scaled teams',
          'Drove organizational strategy'
        ],
        timeframe: '4-6 years'
      },
      {
        description: 'Senior Engineer → Founding Engineer at Startup',
        examplePeople: ['Alex Kumar', 'Tom Wilson'],
        commonTransitions: [
          'Joined early-stage startup',
          'Built products from scratch',
          'Wore multiple hats'
        ],
        timeframe: '2-4 years'
      }
    ]

    return {
      connections,
      commonCompanies: ['Tech Corp', 'Startup Inc', 'Amazon'],
      commonSchools: ['MIT', 'Stanford', 'UC Berkeley'],
      industryDistribution: {
        'Technology': 60,
        'Finance': 20,
        'Healthcare': 10,
        'Education': 10
      },
      skillOverlap: [
        'Microservices Architecture',
        'Distributed Systems',
        'Cloud Infrastructure',
        'System Design',
        'Team Leadership'
      ],
      careerPaths
    }
  }
}

export const networkInsightsService = new NetworkInsightsService()
