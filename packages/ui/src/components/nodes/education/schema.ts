import { educationMetaSchema } from '@journey/schema';

import { withDateValidation } from '../../../validation';

// Apply date validation to educationMetaSchema
export const educationFormSchema = withDateValidation(educationMetaSchema);
