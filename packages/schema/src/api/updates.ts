import type { Update } from '../types';

// ============================================================================
// UPDATE CRUD ENDPOINTS
// ============================================================================

export interface CreateUpdateSuccessResponse {
  success: true;
  data: {
    update: Update;
  };
}

export interface GetUpdateSuccessResponse {
  success: true;
  data: {
    update: Update;
  };
}

export interface GetUpdatesSuccessResponse {
  success: true;
  data: {
    updates: Update[];
    count: number;
  };
}

export interface UpdateUpdateSuccessResponse {
  success: true;
  data: {
    update: Update;
  };
}
