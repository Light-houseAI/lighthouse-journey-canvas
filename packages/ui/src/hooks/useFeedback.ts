/**
 * useFeedback Hook
 *
 * React hook for submitting and managing user feedback (thumbs up/down)
 */

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FeedbackFeatureType, FeedbackRating } from '@journey/schema';

import { submitFeedback } from '../services/feedback-api';

export interface UseFeedbackOptions {
  featureType: FeedbackFeatureType;
  nodeId?: string;
  contextData?: Record<string, any>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface UseFeedbackReturn {
  rating: FeedbackRating | null;
  isSubmitting: boolean;
  showSuccess: boolean;
  submitRating: (rating: FeedbackRating) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for managing feedback state and submission
 */
export function useFeedback(options: UseFeedbackOptions): UseFeedbackReturn {
  const { featureType, nodeId, contextData, onSuccess, onError } = options;

  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (newRating: FeedbackRating) =>
      submitFeedback({
        featureType,
        rating: newRating,
        nodeId,
        contextData,
      }),
    onSuccess: () => {
      setShowSuccess(true);
      // Reset success message after 2 seconds
      setTimeout(() => setShowSuccess(false), 2000);
      onSuccess?.();
    },
    onError: (error: Error) => {
      console.error('Failed to submit feedback:', error);
      onError?.(error);
    },
  });

  const submitRating = useCallback(
    async (newRating: FeedbackRating) => {
      setRating(newRating);
      await mutation.mutateAsync(newRating);
    },
    [mutation]
  );

  const reset = useCallback(() => {
    setRating(null);
    setShowSuccess(false);
  }, []);

  return {
    rating,
    isSubmitting: mutation.isPending,
    showSuccess,
    submitRating,
    reset,
  };
}

export default useFeedback;
