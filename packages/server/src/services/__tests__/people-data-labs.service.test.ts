import axios, { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import { PeopleDataLabsService } from '../people-data-labs';

// Mock axios
vi.mock('axios');
const mockAxios = mockDeep<typeof axios>();

describe('PeopleDataLabsService', () => {
  let peopleDataLabsService: PeopleDataLabsService;
  const originalEnv = process.env.PEOPLE_DATA_LABS_API_KEY;

  beforeEach(() => {
    mockReset(mockAxios);
    vi.clearAllMocks();

    // Set up environment variable
    process.env.PEOPLE_DATA_LABS_API_KEY = 'test-api-key';

    // Mock axios default export
    (axios.get as any).mockImplementation(mockAxios.get);

    peopleDataLabsService = new PeopleDataLabsService();
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv) {
      process.env.PEOPLE_DATA_LABS_API_KEY = originalEnv;
    } else {
      delete process.env.PEOPLE_DATA_LABS_API_KEY;
    }
  });

  describe('searchPersonByLinkedIn', () => {
    it('should successfully find and convert LinkedIn profile data', async () => {
      // Arrange
      const linkedinUsername = 'john-doe';
      const mockPDLResponse = {
        status: 200,
        data: {
          status: 200,
          data: {
            full_name: 'John Doe',
            headline: 'Software Engineer at Tech Corp',
            job_title: 'Senior Developer',
            location_names: ['San Francisco, CA'],
            summary:
              'Experienced software engineer with 5+ years in web development',
            experience: [
              {
                title: { name: 'Senior Developer' },
                company: { name: 'Tech Corp' },
                summary: 'Built scalable web applications',
                start_date: '2020-01-01',
                end_date: null,
              },
            ],
            education: [
              {
                school: { name: 'University of California' },
                degrees: ['Bachelor of Science'],
                majors: ['Computer Science'],
                start_date: '2016-09-01',
                end_date: '2020-05-01',
              },
            ],
            skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
          },
        },
      };

      mockAxios.get.mockResolvedValue(mockPDLResponse);

      // Act
      const result =
        await peopleDataLabsService.searchPersonByLinkedIn(linkedinUsername);

      // Assert
      expect(result).toBeDefined();
      expect(result?.name).toBe('John Doe');
      expect(result?.headline).toBe('Software Engineer at Tech Corp');
      expect(result?.location).toBe('San Francisco, CA');
      expect(result?.about).toBe(
        'Experienced software engineer with 5+ years in web development'
      );
      expect(result?.experiences).toHaveLength(1);
      expect(result?.experiences?.[0].title).toBe('Senior Developer');
      expect(result?.experiences?.[0].company).toBe('Tech Corp');
      expect(result?.education).toHaveLength(1);
      expect(result?.education?.[0].school).toBe('University of California');
      expect(result?.skills).toEqual([
        'JavaScript',
        'TypeScript',
        'React',
        'Node.js',
      ]);

      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://api.peopledatalabs.com/v5/person/enrich',
        {
          params: {
            api_key: 'test-api-key',
            profile: 'linkedin.com/in/john-doe',
            min_likelihood: 6,
            pretty: true,
          },
          timeout: 10000,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'ProfileExtractor/1.0',
          },
        }
      );
    });

    it('should return null when API key is missing', async () => {
      // Arrange
      delete process.env.PEOPLE_DATA_LABS_API_KEY;
      peopleDataLabsService = new PeopleDataLabsService();

      // Act
      const result =
        await peopleDataLabsService.searchPersonByLinkedIn('john-doe');

      // Assert
      expect(result).toBeNull();
      expect(mockAxios.get).not.toHaveBeenCalled();
    });

    it('should handle 404 not found error gracefully', async () => {
      // Arrange
      const linkedinUsername = 'nonexistent-user';
      const axiosError = new AxiosError('Not Found');
      axiosError.response = {
        status: 404,
        data: {},
        headers: {},
        config: {} as any,
        statusText: 'Not Found',
      };

      mockAxios.get.mockRejectedValue(axiosError);

      // Act
      const result =
        await peopleDataLabsService.searchPersonByLinkedIn(linkedinUsername);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle 400 bad request error gracefully', async () => {
      // Arrange
      const linkedinUsername = 'invalid-username';
      const axiosError = new AxiosError('Bad Request');
      axiosError.response = {
        status: 400,
        data: { error: 'Invalid profile format' },
        headers: {},
        config: {
          url: 'https://api.peopledatalabs.com/v5/person/enrich',
          params: { profile: 'linkedin.com/in/invalid-username' },
        } as any,
        statusText: 'Bad Request',
      };

      mockAxios.get.mockRejectedValue(axiosError);

      // Act
      const result =
        await peopleDataLabsService.searchPersonByLinkedIn(linkedinUsername);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('isAvailable', () => {
    it('should return true when API key is present', () => {
      // Arrange
      process.env.PEOPLE_DATA_LABS_API_KEY = 'test-api-key';
      const service = new PeopleDataLabsService();

      // Act
      const result = service.isAvailable();

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when API key is missing', () => {
      // Arrange
      delete process.env.PEOPLE_DATA_LABS_API_KEY;
      const service = new PeopleDataLabsService();

      // Act
      const result = service.isAvailable();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('searchPersonByName', () => {
    it('should successfully find person by name with location', async () => {
      // Arrange
      const fullName = 'Jane Smith';
      const location = 'New York, NY';
      const mockPDLResponse = {
        status: 200,
        data: {
          status: 200,
          data: {
            full_name: 'Jane Smith',
            headline: 'Product Manager',
            location_names: ['New York, NY'],
            experience: [
              {
                title: 'Product Manager',
                company: { name: 'Product Corp' },
                summary: 'Led product development',
                start_date: '2021-01-01',
                end_date: null,
              },
            ],
          },
        },
      };

      mockAxios.get.mockResolvedValue(mockPDLResponse);

      // Act
      const result = await peopleDataLabsService.searchPersonByName(
        fullName,
        location
      );

      // Assert
      expect(result).toBeDefined();
      expect(result?.name).toBe('Jane Smith');
      expect(result?.headline).toBe('Product Manager');
      expect(result?.location).toBe('New York, NY');
      expect(result?.experiences).toHaveLength(1);
      expect(result?.experiences?.[0].title).toBe('Product Manager');
      expect(result?.experiences?.[0].company).toBe('Product Corp');

      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://api.peopledatalabs.com/v5/person/enrich',
        {
          params: {
            api_key: 'test-api-key',
            name: fullName,
            location: location,
            min_likelihood: 6,
            pretty: true,
          },
          timeout: 10000,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'ProfileExtractor/1.0',
          },
        }
      );
    });

    it('should use US default when no location provided', async () => {
      // Arrange
      const fullName = 'Bob Johnson';
      const mockPDLResponse = {
        status: 200,
        data: {
          status: 200,
          data: {
            full_name: 'Bob Johnson',
            headline: 'Software Developer',
          },
        },
      };

      mockAxios.get.mockResolvedValue(mockPDLResponse);

      // Act
      const result = await peopleDataLabsService.searchPersonByName(fullName);

      // Assert
      expect(result).toBeDefined();
      expect(result?.name).toBe('Bob Johnson');

      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://api.peopledatalabs.com/v5/person/enrich',
        {
          params: {
            api_key: 'test-api-key',
            name: fullName,
            country: 'US', // Should default to US
            min_likelihood: 6,
            pretty: true,
          },
          timeout: 10000,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'ProfileExtractor/1.0',
          },
        }
      );
    });

    it('should return null when API key is missing', async () => {
      // Arrange
      delete process.env.PEOPLE_DATA_LABS_API_KEY;
      const service = new PeopleDataLabsService();

      // Act
      const result = await service.searchPersonByName('Test User');

      // Assert
      expect(result).toBeNull();
      expect(mockAxios.get).not.toHaveBeenCalled();
    });
  });
});
