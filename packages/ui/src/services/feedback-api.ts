/**
 * User Feedback API Service
 *
 * Client-side API functions for user feedback endpoints (thumbs up/down)
 */

import type {
  FeedbackFeatureType,
  FeedbackRating,
  SubmitUserFeedbackRequest,
  SubmitUserFeedbackResponse,
  ListFeedbackQuery,
  ListFeedbackResponse,
  FeedbackItem,
} from '@journey/schema';

import { httpClient } from './http-client';

const BASE_URL = '/api/v2/feedback';

/**
 * Submit feedback for a feature
 */
export async function submitFeedback(
  request: SubmitUserFeedbackRequest
): Promise<{ feedback: FeedbackItem; message: string }> {
  const data = await httpClient.post<SubmitUserFeedbackResponse['data']>(
    BASE_URL,
    request
  );

  return data;
}

/**
 * List feedback for the authenticated user
 */
export async function listFeedback(
  query?: Partial<ListFeedbackQuery>
): Promise<{ feedback: FeedbackItem[]; total: number; hasMore: boolean }> {
  const params = new URLSearchParams();

  if (query?.featureType) {
    params.set('featureType', query.featureType);
  }
  if (query?.rating) {
    params.set('rating', query.rating);
  }
  if (query?.nodeId) {
    params.set('nodeId', query.nodeId);
  }
  if (query?.limit) {
    params.set('limit', query.limit.toString());
  }
  if (query?.offset) {
    params.set('offset', query.offset.toString());
  }

  const queryString = params.toString();
  const url = queryString ? `${BASE_URL}?${queryString}` : BASE_URL;

  const data = await httpClient.get<ListFeedbackResponse['data']>(url);

  return data;
}

/**
 * Get feedback statistics
 */
export async function getFeedbackStats(
  featureType?: FeedbackFeatureType
): Promise<{
  thumbsUp: number;
  thumbsDown: number;
  total: number;
  positiveRate: number;
}> {
  const params = featureType ? `?featureType=${featureType}` : '';
  const data = await httpClient.get<{
    thumbsUp: number;
    thumbsDown: number;
    total: number;
    positiveRate: number;
  }>(`${BASE_URL}/stats${params}`);

  return data;
}

/**
 * Delete a feedback entry
 */
export async function deleteFeedback(id: string): Promise<boolean> {
  await httpClient.delete(`${BASE_URL}/${id}`);
  return true;
}
