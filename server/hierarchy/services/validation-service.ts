import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { 
  HIERARCHY_RULES,
  nodeMetaSchema,
  jobMetaSchema,
  educationMetaSchema,
  projectMetaSchema,
  eventMetaSchema,
  actionMetaSchema,
  careerTransitionMetaSchema
} from '../../../shared/schema';
import { HIERARCHY_TOKENS } from '../di/tokens';
import type { Logger } from '../../core/logger';

export interface ValidationError {
  path: string[];
  message: string;
  code: string;
}

export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
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
   * Validate specific node type metadata with detailed error reporting
   */
  validateTypeSpecificMeta<T>(
    type: string, 
    meta: Record<string, unknown>
  ): ValidationResult<T> {
    try {
      let validatedMeta: T;

      switch (type) {
        case 'job':
          validatedMeta = jobMetaSchema.parse(meta) as T;
          break;
        case 'education':
          validatedMeta = educationMetaSchema.parse(meta) as T;
          break;
        case 'project':
          validatedMeta = projectMetaSchema.parse(meta) as T;
          break;
        case 'event':
          validatedMeta = eventMetaSchema.parse(meta) as T;
          break;
        case 'action':
          validatedMeta = actionMetaSchema.parse(meta) as T;
          break;
        case 'careerTransition':
          validatedMeta = careerTransitionMetaSchema.parse(meta) as T;
          break;
        default:
          return {
            success: false,
            errors: [{
              path: ['type'],
              message: `Unsupported node type: ${type}`,
              code: 'INVALID_TYPE'
            }]
          };
      }

      return {
        success: true,
        data: validatedMeta
      };

    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: this.formatZodErrors(error)
        };
      }

      return {
        success: false,
        errors: [{
          path: [],
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: 'VALIDATION_ERROR'
        }]
      };
    }
  }

  /**
   * Validate hierarchy relationship rules
   */
  validateHierarchyRules(parentType: string, childType: string): ValidationResult<boolean> {
    const allowedChildren = HIERARCHY_RULES[parentType];
    
    if (!allowedChildren) {
      return {
        success: false,
        errors: [{
          path: ['parentType'],
          message: `Unknown parent node type: ${parentType}`,
          code: 'INVALID_PARENT_TYPE'
        }]
      };
    }

    if (!allowedChildren.includes(childType)) {
      return {
        success: false,
        errors: [{
          path: ['childType'],
          message: `Node type '${childType}' cannot be a child of '${parentType}'. Allowed children: ${allowedChildren.join(', ')}`,
          code: 'INVALID_HIERARCHY_RELATIONSHIP'
        }]
      };
    }

    return {
      success: true,
      data: true
    };
  }

  /**
   * Validate node label according to business rules
   */
  validateNodeLabel(label: string): ValidationResult<string> {
    const errors: ValidationError[] = [];

    if (!label || typeof label !== 'string') {
      errors.push({
        path: ['label'],
        message: 'Label is required and must be a string',
        code: 'REQUIRED_FIELD'
      });
    } else {
      const trimmedLabel = label.trim();
      
      if (trimmedLabel.length === 0) {
        errors.push({
          path: ['label'],
          message: 'Label cannot be empty or contain only whitespace',
          code: 'EMPTY_FIELD'
        });
      } else if (trimmedLabel.length > 255) {
        errors.push({
          path: ['label'],
          message: 'Label cannot exceed 255 characters',
          code: 'FIELD_TOO_LONG'
        });
      } else if (trimmedLabel.length < 2) {
        errors.push({
          path: ['label'],
          message: 'Label must be at least 2 characters long',
          code: 'FIELD_TOO_SHORT'
        });
      }

      // Additional business rules for labels
      if (/^\s/.test(label) || /\s$/.test(label)) {
        errors.push({
          path: ['label'],
          message: 'Label cannot start or end with whitespace',
          code: 'INVALID_FORMAT'
        });
      }

      if (errors.length === 0) {
        return {
          success: true,
          data: trimmedLabel
        };
      }
    }

    return {
      success: false,
      errors
    };
  }

  /**
   * Validate date format for metadata fields
   */
  validateDateFormat(date: string | undefined, fieldName: string): ValidationResult<string> {
    if (!date) {
      return { success: true, data: undefined as any };
    }

    const dateRegex = /^\d{4}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return {
        success: false,
        errors: [{
          path: [fieldName],
          message: 'Date must be in YYYY-MM format',
          code: 'INVALID_DATE_FORMAT'
        }]
      };
    }

    // Validate actual date values
    const [year, month] = date.split('-').map(Number);
    
    if (year < 1900 || year > 2100) {
      return {
        success: false,
        errors: [{
          path: [fieldName],
          message: 'Year must be between 1900 and 2100',
          code: 'INVALID_DATE_RANGE'
        }]
      };
    }

    if (month < 1 || month > 12) {
      return {
        success: false,
        errors: [{
          path: [fieldName],
          message: 'Month must be between 01 and 12',
          code: 'INVALID_DATE_RANGE'
        }]
      };
    }

    return {
      success: true,
      data: date
    };
  }

  /**
   * Validate date range (startDate <= endDate)
   */
  validateDateRange(startDate?: string, endDate?: string): ValidationResult<boolean> {
    if (!startDate || !endDate) {
      return { success: true, data: true };
    }

    // Both dates should be in YYYY-MM format
    const startValidation = this.validateDateFormat(startDate, 'startDate');
    const endValidation = this.validateDateFormat(endDate, 'endDate');

    if (!startValidation.success) {
      return startValidation as ValidationResult<boolean>;
    }
    if (!endValidation.success) {
      return endValidation as ValidationResult<boolean>;
    }

    // Compare dates
    if (startDate > endDate) {
      return {
        success: false,
        errors: [{
          path: ['dateRange'],
          message: 'Start date cannot be after end date',
          code: 'INVALID_DATE_RANGE'
        }]
      };
    }

    return {
      success: true,
      data: true
    };
  }

  /**
   * Comprehensive validation for node creation
   */
  validateNodeCreation(data: {
    type: string;
    label: string;
    meta?: Record<string, unknown>;
    parentType?: string;
  }): ValidationResult<{
    type: string;
    label: string;
    meta: Record<string, unknown>;
  }> {
    const errors: ValidationError[] = [];

    // Validate label
    const labelValidation = this.validateNodeLabel(data.label);
    if (!labelValidation.success) {
      errors.push(...(labelValidation.errors || []));
    }

    // Validate meta
    const metaValidation = this.validateTypeSpecificMeta(data.type, data.meta || {});
    if (!metaValidation.success) {
      errors.push(...(metaValidation.errors || []));
    }

    // Validate hierarchy rules if parent is specified
    if (data.parentType) {
      const hierarchyValidation = this.validateHierarchyRules(data.parentType, data.type);
      if (!hierarchyValidation.success) {
        errors.push(...(hierarchyValidation.errors || []));
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors
      };
    }

    return {
      success: true,
      data: {
        type: data.type,
        label: labelValidation.data!,
        meta: metaValidation.data || {}
      }
    };
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

  /**
   * Get validation schema for a specific node type (for documentation/client use)
   */
  getSchemaForNodeType(type: string): z.ZodSchema | null {
    switch (type) {
      case 'job':
        return jobMetaSchema;
      case 'education':
        return educationMetaSchema;
      case 'project':
        return projectMetaSchema;
      case 'event':
        return eventMetaSchema;
      case 'action':
        return actionMetaSchema;
      case 'careerTransition':
        return careerTransitionMetaSchema;
      default:
        return null;
    }
  }

  /**
   * Get allowed children types for a parent type
   */
  getAllowedChildren(parentType: string): string[] {
    return HIERARCHY_RULES[parentType] || [];
  }

  /**
   * Check if a child type is valid for a parent type
   */
  isValidChildType(parentType: string, childType: string): boolean {
    const allowedChildren = HIERARCHY_RULES[parentType];
    return allowedChildren ? allowedChildren.includes(childType) : false;
  }
}