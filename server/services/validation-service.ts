import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { nodeMetaSchema } from '../../shared/schema';
import { HIERARCHY_TOKENS } from '../core/hierarchy-tokens';
import type { Logger } from '../core/logger';

export interface ValidationError {
  path: string[];
  message: string;
  code: string;
}

@injectable()
export class ValidationService {
  constructor(
    @inject(HIERARCHY_TOKENS.LOGGER) private logger: Logger
  ) {}

  /**
   * Validate node metadata against type-specific schema
   */
  validateNodeMeta(data: { type: string; meta: Record<string, unknown> }): Record<string, unknown> {
    try {
      const validationResult = nodeMetaSchema.parse(data);
      return validationResult.meta;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = this.formatZodErrors(error);
        this.logger.warn('Node metadata validation failed', { 
          type: data.type, 
          errors: formattedErrors 
        });
        
        throw new Error(`Validation failed: ${formattedErrors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Format Zod validation errors into consistent structure
   */
  private formatZodErrors(error: z.ZodError): ValidationError[] {
    return error.issues.map(issue => ({
      path: issue.path.map(p => String(p)),
      message: issue.message,
      code: issue.code
    }));
  }
}