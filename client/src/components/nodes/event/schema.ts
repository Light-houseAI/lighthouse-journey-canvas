import { z } from 'zod';
import { eventMetaSchema } from '@shared/schema';
import { withDateValidation } from '../../../validation';

// Apply date validation to eventMetaSchema
export const eventFormSchema = withDateValidation(eventMetaSchema);

export type EventFormData = z.infer<typeof eventFormSchema>;