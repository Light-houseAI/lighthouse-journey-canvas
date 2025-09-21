import { educationMetaSchema } from '@journey/schema';
import { z } from 'zod';

import { withDateValidation } from '../../../validation';

// Apply date validation to educationMetaSchema
export const educationFormSchema = withDateValidation(educationMetaSchema);

export type EducationFormData = z.infer<typeof educationFormSchema>;