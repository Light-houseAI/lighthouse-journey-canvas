import { z } from 'zod';

// Date validation decorator that can be applied to any schema with date fields
export function withDateValidation<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.refine((data: any) => {
    // Validate end date is after start date if both are provided
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate + '-01');
      const end = new Date(data.endDate + '-01');
      return end > start;
    }
    return true;
  }, {
    message: "End date must be after start date",
    path: ["endDate"]
  });
}