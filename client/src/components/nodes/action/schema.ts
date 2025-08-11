import { z } from 'zod';
import { actionMetaSchema } from '@shared/schema';
import { withDateValidation } from '../../../validation';

// Apply date validation to actionMetaSchema
export const actionFormSchema = withDateValidation(actionMetaSchema);

export type ActionFormData = z.infer<typeof actionFormSchema>;