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
});
