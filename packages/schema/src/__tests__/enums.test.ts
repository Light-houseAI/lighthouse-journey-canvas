/**
 * Enums Tests
 * Tests for all enum definitions in the schema package
 */

import { describe, expect, it } from 'vitest';

import {
  ApplicationStatus,
  EventType,
  InterviewStage,
  InterviewStatus,
  OrgMemberRole,
  OrganizationType,
  OutreachMethod,
  PermissionAction,
  PolicyEffect,
  ProjectStatus,
  ProjectType,
  SubjectType,
  TimelineNodeType,
  TodoStatus,
  VisibilityLevel,
} from '../enums';

describe('TimelineNodeType Enum', () => {
  it('should have correct values', () => {
    expect(TimelineNodeType.Job).toBe('job');
    expect(TimelineNodeType.Education).toBe('education');
    expect(TimelineNodeType.Project).toBe('project');
    expect(TimelineNodeType.Event).toBe('event');
    expect(TimelineNodeType.Action).toBe('action');
    expect(TimelineNodeType.CareerTransition).toBe('careerTransition');
  });

  it('should contain all expected types', () => {
    const types = Object.values(TimelineNodeType);
    expect(types).toHaveLength(6);
    expect(types).toContain('job');
    expect(types).toContain('education');
    expect(types).toContain('project');
    expect(types).toContain('event');
    expect(types).toContain('action');
    expect(types).toContain('careerTransition');
  });
});

describe('ProjectType Enum', () => {
  it('should have correct values', () => {
    expect(ProjectType.Personal).toBe('personal');
    expect(ProjectType.Professional).toBe('professional');
    expect(ProjectType.Academic).toBe('academic');
    expect(ProjectType.Freelance).toBe('freelance');
    expect(ProjectType.OpenSource).toBe('open-source');
  });

  it('should contain all expected types', () => {
    const types = Object.values(ProjectType);
    expect(types).toHaveLength(5);
  });
});

describe('ProjectStatus Enum', () => {
  it('should have correct values', () => {
    expect(ProjectStatus.Planning).toBe('planning');
    expect(ProjectStatus.Active).toBe('active');
    expect(ProjectStatus.Completed).toBe('completed');
  });

  it('should contain all expected statuses', () => {
    const statuses = Object.values(ProjectStatus);
    expect(statuses).toHaveLength(3);
  });
});

describe('EventType Enum', () => {
  it('should have correct values', () => {
    expect(EventType.Interview).toBe('interview');
    expect(EventType.Networking).toBe('networking');
    expect(EventType.Conference).toBe('conference');
    expect(EventType.Workshop).toBe('workshop');
    expect(EventType.JobApplication).toBe('job-application');
    expect(EventType.Other).toBe('other');
  });

  it('should contain all expected event types', () => {
    const types = Object.values(EventType);
    expect(types).toHaveLength(6);
  });
});

describe('InterviewStage Enum', () => {
  it('should have correct values', () => {
    expect(InterviewStage.Applied).toBe('applied');
    expect(InterviewStage.Screening).toBe('screening');
    expect(InterviewStage.PhoneScreen).toBe('phone_screen');
    expect(InterviewStage.TechnicalRound).toBe('technical_round');
    expect(InterviewStage.Onsite).toBe('onsite');
    expect(InterviewStage.FinalRound).toBe('final_round');
    expect(InterviewStage.OfferReceived).toBe('offer_received');
    expect(InterviewStage.Rejected).toBe('rejected');
  });

  it('should contain all expected stages', () => {
    const stages = Object.values(InterviewStage);
    expect(stages).toHaveLength(8);
  });
});

describe('InterviewStatus Enum', () => {
  it('should have correct values', () => {
    expect(InterviewStatus.Scheduled).toBe('scheduled');
    expect(InterviewStatus.Completed).toBe('completed');
    expect(InterviewStatus.Passed).toBe('passed');
    expect(InterviewStatus.Failed).toBe('failed');
    expect(InterviewStatus.Pending).toBe('pending');
    expect(InterviewStatus.Cancelled).toBe('cancelled');
  });

  it('should contain all expected statuses', () => {
    const statuses = Object.values(InterviewStatus);
    expect(statuses).toHaveLength(6);
  });
});

describe('ApplicationStatus Enum', () => {
  it('should have correct values', () => {
    expect(ApplicationStatus.Applied).toBe('Applied');
    expect(ApplicationStatus.RecruiterScreen).toBe('Recruiter Screen');
    expect(ApplicationStatus.PhoneInterview).toBe('Phone Interview');
    expect(ApplicationStatus.TechnicalInterview).toBe('Technical Interview');
    expect(ApplicationStatus.OnsiteInterview).toBe('Onsite Interview');
    expect(ApplicationStatus.FinalInterview).toBe('Final Interview');
    expect(ApplicationStatus.Offer).toBe('Offer');
    expect(ApplicationStatus.OfferAccepted).toBe('Offer Accepted');
    expect(ApplicationStatus.OfferDeclined).toBe('Offer Declined');
    expect(ApplicationStatus.Rejected).toBe('Rejected');
    expect(ApplicationStatus.Withdrawn).toBe('Withdrawn');
    expect(ApplicationStatus.Ghosted).toBe('Ghosted');
  });

  it('should contain all expected statuses', () => {
    const statuses = Object.values(ApplicationStatus);
    expect(statuses).toHaveLength(12);
  });
});

describe('OutreachMethod Enum', () => {
  it('should have correct values', () => {
    expect(OutreachMethod.Referral).toBe('Referral');
    expect(OutreachMethod.ColdApply).toBe('Cold Apply');
    expect(OutreachMethod.RecruiterOutreach).toBe('Recruiter Outreach');
    expect(OutreachMethod.JobBoard).toBe('Job Board');
    expect(OutreachMethod.CompanyWebsite).toBe('Company Website');
    expect(OutreachMethod.LinkedInMessage).toBe('LinkedIn Message');
    expect(OutreachMethod.Other).toBe('Other');
  });

  it('should contain all expected methods', () => {
    const methods = Object.values(OutreachMethod);
    expect(methods).toHaveLength(7);
  });
});

describe('TodoStatus Enum', () => {
  it('should have correct values', () => {
    expect(TodoStatus.Pending).toBe('pending');
    expect(TodoStatus.InProgress).toBe('in-progress');
    expect(TodoStatus.Completed).toBe('completed');
    expect(TodoStatus.Blocked).toBe('blocked');
  });

  it('should contain all expected statuses', () => {
    const statuses = Object.values(TodoStatus);
    expect(statuses).toHaveLength(4);
  });
});

describe('VisibilityLevel Enum', () => {
  it('should have correct values', () => {
    expect(VisibilityLevel.Overview).toBe('overview');
    expect(VisibilityLevel.Full).toBe('full');
  });

  it('should contain all expected levels', () => {
    const levels = Object.values(VisibilityLevel);
    expect(levels).toHaveLength(2);
  });
});

describe('PermissionAction Enum', () => {
  it('should have correct values', () => {
    expect(PermissionAction.View).toBe('view');
    expect(PermissionAction.Edit).toBe('edit');
  });

  it('should contain all expected actions', () => {
    const actions = Object.values(PermissionAction);
    expect(actions).toHaveLength(2);
  });
});

describe('SubjectType Enum', () => {
  it('should have correct values', () => {
    expect(SubjectType.User).toBe('user');
    expect(SubjectType.Organization).toBe('org');
    expect(SubjectType.Public).toBe('public');
  });

  it('should contain all expected types', () => {
    const types = Object.values(SubjectType);
    expect(types).toHaveLength(3);
  });
});

describe('PolicyEffect Enum', () => {
  it('should have correct values', () => {
    expect(PolicyEffect.Allow).toBe('ALLOW');
    expect(PolicyEffect.Deny).toBe('DENY');
  });

  it('should contain all expected effects', () => {
    const effects = Object.values(PolicyEffect);
    expect(effects).toHaveLength(2);
  });
});

describe('OrganizationType Enum', () => {
  it('should have correct values', () => {
    expect(OrganizationType.Company).toBe('company');
    expect(OrganizationType.EducationalInstitution).toBe('educational_institution');
    expect(OrganizationType.Other).toBe('other');
  });

  it('should contain all expected types', () => {
    const types = Object.values(OrganizationType);
    expect(types).toHaveLength(3);
  });
});

describe('OrgMemberRole Enum', () => {
  it('should have correct values', () => {
    expect(OrgMemberRole.Member).toBe('member');
    expect(OrgMemberRole.Admin).toBe('admin');
  });

  it('should contain all expected roles', () => {
    const roles = Object.values(OrgMemberRole);
    expect(roles).toHaveLength(2);
  });
});
