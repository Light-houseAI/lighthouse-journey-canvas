import { EventType, TodoStatus } from '@journey/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

import type { LLMProvider } from '../../core/llm-provider.js';
import type { Logger } from '../../core/logger.js';
import {
  ApplicationStatus,
  type JobApplicationMeta,
  LLMSummaryService,
  type UserInfo,
} from '../llm-summary.service.js';

describe('LLMSummaryService', () => {
  let llmProvider: ReturnType<typeof mockDeep<LLMProvider>>;
  let logger: ReturnType<typeof mockDeep<Logger>>;
  let service: LLMSummaryService;

  beforeEach(() => {
    llmProvider = mockDeep<LLMProvider>();
    logger = mockDeep<Logger>();
    service = new LLMSummaryService({ llmProvider, logger });
  });

  describe('generateApplicationSummaries', () => {
    it('should generate summaries for job application with statusData', async () => {
      const meta: JobApplicationMeta = {
        company: 'Microsoft',
        jobTitle: 'Software Engineer',
        applicationStatus: ApplicationStatus.RecruiterScreen,
        statusData: {
          [ApplicationStatus.RecruiterScreen]: {
            todos: [
              {
                id: '1',
                description: 'Research company',
                status: TodoStatus.Completed,
              },
              {
                id: '2',
                description: 'Prepare for behavioral questions',
                status: TodoStatus.Pending,
              },
            ],
            interviewContext: 'Phone screen with recruiter',
          },
        },
      };

      const userInfo: UserInfo = {
        firstName: 'John',
        lastName: 'Doe',
      };

      llmProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          overallReasoning: 'Candidate is in recruiter screen phase',
          overallContext:
            'John is interviewing for a Software Engineer role at Microsoft. Currently in the recruiter screen phase.',
          statusSummaries: {
            RecruiterScreen:
              'John had a recruiter screen and completed research on the company.',
          },
          statusReasoning: {
            RecruiterScreen: 'Phone screen with recruiter mentioned',
          },
        },
      });

      const result = await service.generateApplicationSummaries(
        meta,
        userInfo,
        1
      );

      expect(result.llmInterviewContext).toBe(
        'John is interviewing for a Software Engineer role at Microsoft. Currently in the recruiter screen phase.'
      );
      expect(result.statusData).toBeDefined();
      expect(
        result.statusData?.[ApplicationStatus.RecruiterScreen]?.llmSummary
      ).toBe(
        'John had a recruiter screen and completed research on the company.'
      );
    });

    it('should skip generation if missing required data', async () => {
      const meta: JobApplicationMeta = {
        company: 'Microsoft',
        // Missing jobTitle
        statusData: {},
      };

      const userInfo: UserInfo = { firstName: 'John' };

      const result = await service.generateApplicationSummaries(
        meta,
        userInfo,
        1
      );

      expect(result).toEqual({});
      expect(llmProvider.generateStructuredResponse).not.toHaveBeenCalled();
    });

    it('should skip generation if statusData is empty', async () => {
      const meta: JobApplicationMeta = {
        company: 'Microsoft',
        jobTitle: 'Software Engineer',
        statusData: {},
      };

      const userInfo: UserInfo = { firstName: 'John' };

      const result = await service.generateApplicationSummaries(
        meta,
        userInfo,
        1
      );

      expect(result).toEqual({});
      expect(llmProvider.generateStructuredResponse).not.toHaveBeenCalled();
    });

    it('should handle LLM provider errors gracefully', async () => {
      const meta: JobApplicationMeta = {
        company: 'Microsoft',
        jobTitle: 'Software Engineer',
        statusData: {
          [ApplicationStatus.RecruiterScreen]: {
            todos: [
              { id: '1', description: 'Test', status: TodoStatus.Pending },
            ],
          },
        },
      };

      const userInfo: UserInfo = { firstName: 'John' };

      llmProvider.generateStructuredResponse.mockRejectedValue(
        new Error('LLM API error')
      );

      const result = await service.generateApplicationSummaries(
        meta,
        userInfo,
        1
      );

      expect(result).toEqual({});
      expect(logger.error).toHaveBeenCalled();
    });

    it('should capitalize first name correctly', async () => {
      const meta: JobApplicationMeta = {
        company: 'Microsoft',
        jobTitle: 'Software Engineer',
        statusData: {
          [ApplicationStatus.RecruiterScreen]: {
            todos: [
              { id: '1', description: 'Test', status: TodoStatus.Pending },
            ],
          },
        },
      };

      const userInfo: UserInfo = { firstName: 'john' }; // lowercase

      llmProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          overallReasoning: 'Test',
          overallContext: 'John is interviewing...',
          statusSummaries: {},
          statusReasoning: {},
        },
      });

      await service.generateApplicationSummaries(meta, userInfo, 1);

      // Check that the prompt sent to LLM has capitalized name
      const call = llmProvider.generateStructuredResponse.mock.calls[0];
      const userPrompt = call[0][1].content;
      expect(userPrompt).toContain('Candidate: John');
    });

    it('should handle multiple statuses', async () => {
      const meta: JobApplicationMeta = {
        company: 'Microsoft',
        jobTitle: 'Software Engineer',
        statusData: {
          [ApplicationStatus.RecruiterScreen]: {
            todos: [
              { id: '1', description: 'Test 1', status: TodoStatus.Completed },
            ],
          },
          [ApplicationStatus.PhoneInterview]: {
            todos: [
              { id: '2', description: 'Test 2', status: TodoStatus.Pending },
            ],
          },
        },
      };

      const userInfo: UserInfo = { firstName: 'John' };

      llmProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          overallReasoning: 'Test',
          overallContext: 'John is interviewing...',
          statusSummaries: {
            RecruiterScreen: 'Summary 1',
            PhoneInterview: 'Summary 2',
          },
          statusReasoning: {
            RecruiterScreen: 'Reasoning 1',
            PhoneInterview: 'Reasoning 2',
          },
        },
      });

      const result = await service.generateApplicationSummaries(
        meta,
        userInfo,
        1
      );

      expect(
        result.statusData?.[ApplicationStatus.RecruiterScreen]?.llmSummary
      ).toBe('Summary 1');
      expect(
        result.statusData?.[ApplicationStatus.PhoneInterview]?.llmSummary
      ).toBe('Summary 2');
    });

    it('should include notes in the prompt when provided', async () => {
      const meta: JobApplicationMeta = {
        company: 'Microsoft',
        jobTitle: 'Software Engineer',
        notes: 'Referral from John Smith. Remote position with flexible hours.',
        statusData: {
          [ApplicationStatus.RecruiterScreen]: {
            todos: [
              { id: '1', description: 'Test 1', status: TodoStatus.Completed },
            ],
          },
        },
      };

      const userInfo: UserInfo = { firstName: 'John' };

      llmProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          overallReasoning: 'Test reasoning including notes',
          overallContext:
            'John is interviewing for a Software Engineer role at Microsoft. This is a remote position.',
          statusSummaries: {
            RecruiterScreen: 'Summary including note context',
          },
          statusReasoning: {
            RecruiterScreen: 'Reasoning',
          },
        },
      });

      await service.generateApplicationSummaries(meta, userInfo, 1);

      // Verify the notes were included in the prompt
      const call = llmProvider.generateStructuredResponse.mock.calls[0];
      const userPrompt = call[0][1].content;
      expect(userPrompt).toContain('General notes:');
      expect(userPrompt).toContain(
        'Referral from John Smith. Remote position with flexible hours.'
      );
    });
  });

  describe('enrichApplicationWithSummaries', () => {
    it('should only process event nodes', async () => {
      const nodeMeta = { company: 'Microsoft' };

      const result = await service.enrichApplicationWithSummaries(
        nodeMeta,
        'job', // Not an event
        1
      );

      expect(result).toEqual(nodeMeta);
    });

    it('should only process job application events', async () => {
      const nodeMeta = {
        eventType: 'interview', // Not job-application
        company: 'Microsoft',
      };

      const result = await service.enrichApplicationWithSummaries(
        nodeMeta,
        'event',
        1
      );

      expect(result).toEqual(nodeMeta);
    });

    it('should skip regeneration if summaries already exist', async () => {
      const nodeMeta: Record<string, unknown> = {
        eventType: EventType.JobApplication,
        company: 'Microsoft',
        jobTitle: 'Software Engineer',
        llmInterviewContext: 'Existing summary',
        statusData: {
          [ApplicationStatus.RecruiterScreen]: {
            todos: [],
            llmSummary: 'Existing status summary',
          },
        },
      };

      const result = await service.enrichApplicationWithSummaries(
        nodeMeta,
        'event',
        1
      );

      expect(result).toEqual(nodeMeta);
      expect(llmProvider.generateStructuredResponse).not.toHaveBeenCalled();
    });

    it('should generate summaries if they do not exist', async () => {
      const nodeMeta: Record<string, unknown> = {
        eventType: EventType.JobApplication,
        company: 'Microsoft',
        jobTitle: 'Software Engineer',
        statusData: {
          [ApplicationStatus.RecruiterScreen]: {
            todos: [
              { id: '1', description: 'Test', status: TodoStatus.Pending },
            ],
          },
        },
      };

      llmProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          overallReasoning: 'Test',
          overallContext: 'John is interviewing...',
          statusSummaries: {
            RecruiterScreen: 'Summary',
          },
          statusReasoning: {
            RecruiterScreen: 'Reasoning',
          },
        },
      });

      const result = await service.enrichApplicationWithSummaries(
        nodeMeta,
        'event',
        1,
        { firstName: 'John' }
      );

      expect(result.llmInterviewContext).toBe('John is interviewing...');
      expect(llmProvider.generateStructuredResponse).toHaveBeenCalled();
    });

    it('should use empty userInfo if not provided', async () => {
      const nodeMeta: Record<string, unknown> = {
        eventType: EventType.JobApplication,
        company: 'Microsoft',
        jobTitle: 'Software Engineer',
        statusData: {
          [ApplicationStatus.RecruiterScreen]: {
            todos: [
              { id: '1', description: 'Test', status: TodoStatus.Pending },
            ],
          },
        },
      };

      llmProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          overallReasoning: 'Test',
          overallContext: 'The candidate is interviewing...',
          statusSummaries: {
            RecruiterScreen: 'Summary',
          },
          statusReasoning: {
            RecruiterScreen: 'Reasoning',
          },
        },
      });

      const result = await service.enrichApplicationWithSummaries(
        nodeMeta,
        'event',
        1
        // No userInfo provided
      );

      expect(result.llmInterviewContext).toBe(
        'The candidate is interviewing...'
      );
    });
  });

  describe('generateMaterialEditSummary', () => {
    it('should generate full summary from edit history when no existing summary', async () => {
      const editHistory = [
        {
          editedAt: '2024-01-01T00:00:00.000Z',
          notes: 'Initial upload',
          editedBy: '123',
        },
        {
          editedAt: '2024-01-02T00:00:00.000Z',
          notes: 'Updated skills section',
          editedBy: '123',
        },
        {
          editedAt: '2024-01-03T00:00:00.000Z',
          notes: 'Added project details',
          editedBy: '123',
        },
      ];

      llmProvider.generateText.mockResolvedValue({
        content:
          'Initial upload\nUpdated skills section\nAdded project details',
      });

      const result = await service.generateMaterialEditSummary(
        editHistory,
        'Technical Resume',
        1
      );

      expect(result).toBe(
        'Initial upload\nUpdated skills section\nAdded project details'
      );
      expect(llmProvider.generateText).toHaveBeenCalled();

      // Should use all edits (up to 5) when no existing summary
      const call = llmProvider.generateText.mock.calls[0];
      const userPrompt = call[0][1].content;
      expect(userPrompt).toContain('Initial upload');
      expect(userPrompt).toContain('Updated skills section');
      expect(userPrompt).toContain('Added project details');
    });

    it('should generate incremental summary when existing summary provided', async () => {
      const editHistory = [
        {
          editedAt: '2024-01-01T00:00:00.000Z',
          notes: 'Initial upload',
          editedBy: '123',
        },
        {
          editedAt: '2024-01-02T00:00:00.000Z',
          notes: 'Updated skills section',
          editedBy: '123',
        },
        {
          editedAt: '2024-01-03T00:00:00.000Z',
          notes: 'Added leadership experience',
          editedBy: '123',
        },
      ];

      const existingSummary = 'Initial upload\nUpdated skills section';

      llmProvider.generateText.mockResolvedValue({
        content:
          'Initial upload\nUpdated skills section\nAdded leadership experience',
      });

      const result = await service.generateMaterialEditSummary(
        editHistory,
        'Technical Resume',
        1,
        existingSummary
      );

      expect(result).toBe(
        'Initial upload\nUpdated skills section\nAdded leadership experience'
      );

      // Should only use the most recent edit when existing summary is provided
      const call = llmProvider.generateText.mock.calls[0];
      const userPrompt = call[0][1].content;
      expect(userPrompt).toContain(existingSummary);
      expect(userPrompt).toContain('Added leadership experience');
      expect(userPrompt).toContain('New Edit:');
    });

    it('should return undefined when no edit history', async () => {
      const result = await service.generateMaterialEditSummary([], 'Resume', 1);

      expect(result).toBeUndefined();
      expect(llmProvider.generateText).not.toHaveBeenCalled();
    });

    it('should handle LLM errors gracefully', async () => {
      const editHistory = [
        {
          editedAt: '2024-01-01T00:00:00.000Z',
          notes: 'Test edit',
          editedBy: '123',
        },
      ];

      llmProvider.generateText.mockRejectedValue(new Error('LLM API error'));

      const result = await service.generateMaterialEditSummary(
        editHistory,
        'Resume',
        1
      );

      expect(result).toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('generateNetworkingSummaries', () => {
    it('should generate summaries for multiple networking types', async () => {
      const activities = [
        {
          networkingType: 'Cold outreach',
          timestamp: '2024-01-01T00:00:00.000Z',
          whom: ['John Doe', 'Jane Smith'],
          channels: ['LinkedIn', 'Email'],
          exampleOnHow:
            'Hi, I wanted to connect and learn about your experience.',
        },
        {
          networkingType: 'Attended networking event',
          timestamp: '2024-01-02T00:00:00.000Z',
          event: 'Tech Meetup 2024',
          notes: 'Met several engineers from local startups.',
        },
      ];

      const userInfo: UserInfo = {
        firstName: 'John',
        lastName: 'Doe',
      };

      llmProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          overallSummary:
            'John engaged in various networking activities including cold outreach and attending events.',
          typeSummaries: {
            'Cold outreach':
              'John reached out via LinkedIn and Email with personalized messages.',
            'Attended networking event':
              'John attended Tech Meetup 2024 and connected with local engineers.',
          },
          typeKeyPoints: {
            'Cold outreach': [
              'Used multiple channels to reach out',
              'Personalized messages for each contact',
            ],
            'Attended networking event': [
              'Attended industry-specific events',
              'Focused on building local connections',
            ],
          },
        },
      });

      const result = await service.generateNetworkingSummaries(
        activities,
        userInfo,
        1
      );

      expect(result.overallSummary).toBe(
        'John engaged in various networking activities including cold outreach and attending events.'
      );
      expect(result.summaries).toBeDefined();
      expect(result.summaries?.['Cold outreach']).toBe(
        'John reached out via LinkedIn and Email with personalized messages.'
      );
      expect(result.keyPoints).toBeDefined();
      expect(result.keyPoints?.['Cold outreach']).toHaveLength(2);
      expect(llmProvider.generateStructuredResponse).toHaveBeenCalledOnce();
    });

    it('should handle Cold outreach activities with channels and messages', async () => {
      const activities = [
        {
          networkingType: 'Cold outreach',
          timestamp: '2024-01-01T00:00:00.000Z',
          whom: ['Person A'],
          channels: ['LinkedIn'],
          exampleOnHow: 'Hello, I saw your profile and wanted to connect.',
        },
      ];

      const userInfo: UserInfo = { firstName: 'John' };

      llmProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          overallSummary: 'John conducted cold outreach.',
          typeSummaries: {
            'Cold outreach':
              'John reached out via LinkedIn with a connection request.',
          },
          typeKeyPoints: {
            'Cold outreach': ['Used LinkedIn as primary channel'],
          },
        },
      });

      const result = await service.generateNetworkingSummaries(
        activities,
        userInfo,
        1
      );

      expect(result.summaries?.['Cold outreach']).toContain('LinkedIn');
      expect(llmProvider.generateStructuredResponse).toHaveBeenCalled();
    });

    it('should handle Reconnected activities with contacts', async () => {
      const activities = [
        {
          networkingType: 'Reconnected with someone',
          timestamp: '2024-01-01T00:00:00.000Z',
          contacts: ['Old Colleague'],
          notes: 'Reached out after 2 years to reconnect.',
        },
      ];

      const userInfo: UserInfo = { firstName: 'John' };

      llmProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          overallSummary: 'John reconnected with former colleagues.',
          typeSummaries: {
            'Reconnected with someone':
              'John reached out to reconnect after 2 years.',
          },
          typeKeyPoints: {
            'Reconnected with someone': [
              'Maintained long-term professional relationships',
            ],
          },
        },
      });

      const result = await service.generateNetworkingSummaries(
        activities,
        userInfo,
        1
      );

      expect(result.summaries?.['Reconnected with someone']).toBeDefined();
      expect(result.keyPoints?.['Reconnected with someone']).toBeDefined();
    });

    it('should handle Networking event activities', async () => {
      const activities = [
        {
          networkingType: 'Attended networking event',
          timestamp: '2024-01-01T00:00:00.000Z',
          event: 'Tech Conference 2024',
          notes: 'Attended keynote and networked during breaks.',
        },
      ];

      const userInfo: UserInfo = { firstName: 'John' };

      llmProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          overallSummary: 'John attended networking events.',
          typeSummaries: {
            'Attended networking event':
              'John attended Tech Conference 2024 and networked during breaks.',
          },
          typeKeyPoints: {
            'Attended networking event': [
              'Participated in industry conferences',
            ],
          },
        },
      });

      const result = await service.generateNetworkingSummaries(
        activities,
        userInfo,
        1
      );

      expect(result.summaries?.['Attended networking event']).toContain(
        'Tech Conference 2024'
      );
    });

    it('should handle Informational interview activities', async () => {
      const activities = [
        {
          networkingType: 'Informational interview',
          timestamp: '2024-01-01T00:00:00.000Z',
          contact: 'Senior Engineer',
          notes: 'Discussed career growth in software engineering.',
        },
      ];

      const userInfo: UserInfo = { firstName: 'John' };

      llmProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          overallSummary: 'John conducted informational interviews.',
          typeSummaries: {
            'Informational interview':
              'John discussed career growth with experienced professionals.',
          },
          typeKeyPoints: {
            'Informational interview': ['Sought advice on career advancement'],
          },
        },
      });

      const result = await service.generateNetworkingSummaries(
        activities,
        userInfo,
        1
      );

      expect(result.summaries?.['Informational interview']).toBeDefined();
    });

    it('should return empty object when no activities provided', async () => {
      const userInfo: UserInfo = { firstName: 'John' };

      const result = await service.generateNetworkingSummaries([], userInfo, 1);

      expect(result).toEqual({});
      expect(llmProvider.generateStructuredResponse).not.toHaveBeenCalled();
    });

    it('should return empty object when LLM call fails', async () => {
      const activities = [
        {
          networkingType: 'Cold outreach',
          timestamp: '2024-01-01T00:00:00.000Z',
          whom: ['Person A'],
          channels: ['LinkedIn'],
          exampleOnHow: 'Hello',
        },
      ];

      const userInfo: UserInfo = { firstName: 'John' };

      llmProvider.generateStructuredResponse.mockRejectedValue(
        new Error('LLM API error')
      );

      const result = await service.generateNetworkingSummaries(
        activities,
        userInfo,
        1
      );

      expect(result).toEqual({});
      expect(logger.error).toHaveBeenCalled();
    });

    it('should log generation start and completion', async () => {
      const activities = [
        {
          networkingType: 'Cold outreach',
          timestamp: '2024-01-01T00:00:00.000Z',
          whom: ['Person A'],
          channels: ['LinkedIn'],
          exampleOnHow: 'Hello',
        },
      ];

      const userInfo: UserInfo = { firstName: 'John' };

      llmProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          overallSummary: 'Summary',
          typeSummaries: { 'Cold outreach': 'Detail' },
          typeKeyPoints: { 'Cold outreach': ['Point'] },
        },
      });

      await service.generateNetworkingSummaries(activities, userInfo, 1);

      expect(logger.info).toHaveBeenCalledWith(
        '=== Generating Networking Summaries ==='
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Generated networking summaries',
        expect.objectContaining({
          userId: 1,
          activityCount: 1,
          typeCount: 1,
        })
      );
    });

    it('should verify LLM prompt structure includes type-specific instructions', async () => {
      const activities = [
        {
          networkingType: 'Cold outreach',
          timestamp: '2024-01-01T00:00:00.000Z',
          whom: ['Person A'],
          channels: ['LinkedIn'],
          exampleOnHow: 'Hello',
        },
      ];

      const userInfo: UserInfo = { firstName: 'John' };

      llmProvider.generateStructuredResponse.mockResolvedValue({
        content: {
          overallSummary: 'Summary',
          typeSummaries: { 'Cold outreach': 'Detail' },
          typeKeyPoints: { 'Cold outreach': ['Point'] },
        },
      });

      await service.generateNetworkingSummaries(activities, userInfo, 1);

      const callArgs = llmProvider.generateStructuredResponse.mock.calls[0];
      const userPrompt = callArgs[0][1].content as string;

      // Verify prompt mentions Cold outreach specific instructions
      expect(userPrompt).toContain('Cold outreach');
      expect(userPrompt).toContain('channels');
      // Verify it asks for type-specific summaries
      expect(userPrompt).toContain('typeSummaries');
      expect(userPrompt).toContain('typeKeyPoints');
    });
  });
});
