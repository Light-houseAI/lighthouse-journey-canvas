import { z } from 'zod';
import { jobMetaSchema } from '@shared/schema';
import { withDateValidation } from '../../../validation';

// Apply date validation to jobMetaSchema
export const jobFormSchema = withDateValidation(jobMetaSchema);

export type JobFormData = z.infer<typeof jobFormSchema>;