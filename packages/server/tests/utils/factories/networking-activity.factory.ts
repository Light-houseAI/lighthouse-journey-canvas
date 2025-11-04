/**
 * Networking Activity Test Factory
 *
 * Provides factory functions for creating test networking activity data
 */

import { NetworkingType } from '@journey/schema';

export interface ColdOutreachActivity {
  networkingType: typeof NetworkingType.ColdOutreach;
  timestamp: string;
  whom: string[];
  channels: string[];
  exampleOnHow: string;
}

export interface ReconnectedActivity {
  networkingType: typeof NetworkingType.ReconnectedWithSomeone;
  timestamp: string;
  contacts: string[];
  notes: string;
}

export interface NetworkingEventActivity {
  networkingType: typeof NetworkingType.AttendedNetworkingEvent;
  timestamp: string;
  event: string;
  notes: string;
}

export interface InformationalInterviewActivity {
  networkingType: typeof NetworkingType.InformationalInterview;
  timestamp: string;
  contact: string;
  notes: string;
}

export type NetworkingActivity =
  | ColdOutreachActivity
  | ReconnectedActivity
  | NetworkingEventActivity
  | InformationalInterviewActivity;

/**
 * Create a cold outreach activity with default values
 */
export function createColdOutreachActivity(
  overrides?: Partial<ColdOutreachActivity>
): ColdOutreachActivity {
  return {
    networkingType: NetworkingType.ColdOutreach,
    timestamp: new Date().toISOString(),
    whom: ['John Doe'],
    channels: ['LinkedIn'],
    exampleOnHow: 'Hi, I saw your profile and wanted to connect.',
    ...overrides,
  };
}

/**
 * Create a reconnected activity with default values
 */
export function createReconnectedActivity(
  overrides?: Partial<ReconnectedActivity>
): ReconnectedActivity {
  return {
    networkingType: NetworkingType.ReconnectedWithSomeone,
    timestamp: new Date().toISOString(),
    contacts: ['Jane Smith'],
    notes: 'Reached out to reconnect after 2 years.',
    ...overrides,
  };
}

/**
 * Create a networking event activity with default values
 */
export function createNetworkingEventActivity(
  overrides?: Partial<NetworkingEventActivity>
): NetworkingEventActivity {
  return {
    networkingType: NetworkingType.AttendedNetworkingEvent,
    timestamp: new Date().toISOString(),
    event: 'Tech Meetup 2024',
    notes: 'Met several engineers from local startups.',
    ...overrides,
  };
}

/**
 * Create an informational interview activity with default values
 */
export function createInformationalInterviewActivity(
  overrides?: Partial<InformationalInterviewActivity>
): InformationalInterviewActivity {
  return {
    networkingType: NetworkingType.InformationalInterview,
    timestamp: new Date().toISOString(),
    contact: 'Bob Johnson',
    notes: 'Discussed career path in software engineering.',
    ...overrides,
  };
}

/**
 * Create networking data with activities grouped by type
 */
export function createNetworkingDataWithActivities(activities: {
  coldOutreach?: ColdOutreachActivity[];
  reconnected?: ReconnectedActivity[];
  events?: NetworkingEventActivity[];
  interviews?: InformationalInterviewActivity[];
}) {
  const networkingData: Record<string, NetworkingActivity[]> = {};

  if (activities.coldOutreach && activities.coldOutreach.length > 0) {
    networkingData[NetworkingType.ColdOutreach] = activities.coldOutreach;
  }

  if (activities.reconnected && activities.reconnected.length > 0) {
    networkingData[NetworkingType.ReconnectedWithSomeone] =
      activities.reconnected;
  }

  if (activities.events && activities.events.length > 0) {
    networkingData[NetworkingType.AttendedNetworkingEvent] = activities.events;
  }

  if (activities.interviews && activities.interviews.length > 0) {
    networkingData[NetworkingType.InformationalInterview] =
      activities.interviews;
  }

  return {
    activities: networkingData,
  };
}

/**
 * Create a batch of networking activities with timestamps spread over time
 */
export function createNetworkingActivityBatch(
  count: number,
  type: NetworkingType
): NetworkingActivity[] {
  const activities: NetworkingActivity[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(
      now.getTime() - i * 24 * 60 * 60 * 1000
    ).toISOString(); // One day apart

    switch (type) {
      case NetworkingType.ColdOutreach:
        activities.push(
          createColdOutreachActivity({ timestamp, whom: [`Person ${i + 1}`] })
        );
        break;
      case NetworkingType.ReconnectedWithSomeone:
        activities.push(
          createReconnectedActivity({
            timestamp,
            contacts: [`Contact ${i + 1}`],
          })
        );
        break;
      case NetworkingType.AttendedNetworkingEvent:
        activities.push(
          createNetworkingEventActivity({ timestamp, event: `Event ${i + 1}` })
        );
        break;
      case NetworkingType.InformationalInterview:
        activities.push(
          createInformationalInterviewActivity({
            timestamp,
            contact: `Interviewer ${i + 1}`,
          })
        );
        break;
    }
  }

  return activities;
}
