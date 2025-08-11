import { z } from 'zod';
import { careerTransitionMetaSchema } from '@shared/schema';
import { withDateValidation } from '../../../validation';

// Apply date validation to careerTransitionMetaSchema
export const careerTransitionFormSchema = withDateValidation(careerTransitionMetaSchema);

export type CareerTransitionFormData = z.infer<typeof careerTransitionFormSchema>;