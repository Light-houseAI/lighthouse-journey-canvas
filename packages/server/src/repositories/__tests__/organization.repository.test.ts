import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger';
import { OrganizationRepository } from '../organization.repository';

describe('OrganizationRepository', () => {
  const mockDatabase = mockDeep<NodePgDatabase<any>>();
  const mockLogger = mockDeep<Logger>();
  let organizationRepository: OrganizationRepository;

  beforeEach(() => {
    mockReset(mockDatabase);
    mockReset(mockLogger);

    // Setup query chain mocks
    mockDatabase.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    organizationRepository = new OrganizationRepository({
      database: mockDatabase,
      logger: mockLogger,
    });
  });

  describe('getById', () => {
    it('should return organization when found', async () => {
      // Arrange
      const orgId = 1;
      const mockOrganization = {
        id: orgId,
        name: 'Test Organization',
        type: 'Company',
        createdAt: new Date(),
      };

      mockDatabase
        .select()
        .from()
        .where()
        .limit.mockResolvedValue([mockOrganization]);

      // Act
      const result = await organizationRepository.getById(orgId);

      // Assert
      expect(result).toEqual(mockOrganization);
      expect(mockDatabase.select).toHaveBeenCalled();
    });
  });
});
