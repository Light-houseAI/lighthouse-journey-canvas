import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import { MultiSourceExtractor } from '../multi-source-extractor';
import { PeopleDataLabsService } from '../people-data-labs';

// Mock PeopleDataLabsService
vi.mock('../people-data-labs', () => ({
  PeopleDataLabsService: vi.fn(),
}));

describe('MultiSourceExtractor', () => {
  const mockPeopleDataLabsService = mockDeep<PeopleDataLabsService>();
  let multiSourceExtractor: MultiSourceExtractor;

  beforeEach(() => {
    mockReset(mockPeopleDataLabsService);

    // Mock the constructor
    (PeopleDataLabsService as any).mockImplementation(
      () => mockPeopleDataLabsService
    );

    multiSourceExtractor = new MultiSourceExtractor();
  });

  describe('extractComprehensiveProfile', () => {
    it('should extract profile data from People Data Labs when available', async () => {
      // Arrange
      const username = 'johndoe';
      const mockProfileData = {
        name: 'John Doe',
        headline: 'Software Engineer',
        experiences: [{ title: 'Developer', company: 'Tech Corp' }],
        education: [{ school: 'University', degree: 'BS' }],
        skills: ['JavaScript', 'TypeScript'],
      };

      mockPeopleDataLabsService.isAvailable.mockReturnValue(true);
      mockPeopleDataLabsService.searchPersonByLinkedIn.mockResolvedValue(
        mockProfileData
      );

      // Act
      const result =
        await multiSourceExtractor.extractComprehensiveProfile(username);

      // Assert
      expect(mockPeopleDataLabsService.isAvailable).toHaveBeenCalled();
      expect(
        mockPeopleDataLabsService.searchPersonByLinkedIn
      ).toHaveBeenCalledWith(username);
      expect(result).toEqual(mockProfileData);
    });
  });
});
