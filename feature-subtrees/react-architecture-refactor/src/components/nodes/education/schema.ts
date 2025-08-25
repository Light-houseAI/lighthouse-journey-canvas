import { z } from 'zod';
import { educationMetaSchema } from '@shared/schema';
import { withDateValidation } from '../../../validation';

// Apply date validation to educationMetaSchema
export const educationFormSchema = withDateValidation(educationMetaSchema);

export type EducationFormData = z.infer<typeof educationFormSchema>;