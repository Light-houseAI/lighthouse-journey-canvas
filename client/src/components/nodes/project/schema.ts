import { z } from 'zod';
import { projectMetaSchema } from '@shared/schema';
import { withDateValidation } from '../../../validation';

// Apply date validation to projectMetaSchema
export const projectFormSchema = withDateValidation(projectMetaSchema);

export type ProjectFormData = z.infer<typeof projectFormSchema>;