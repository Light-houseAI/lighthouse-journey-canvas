import { parse, isValid, format } from 'date-fns';

// Common date formats we might encounter
const DATE_FORMATS = [
  'MMM yyyy',        // "Jan 2023"
  'MMMM yyyy',       // "January 2023"
  'MM/yyyy',         // "01/2023"
  'MM-yyyy',         // "01-2023"
  'yyyy-MM',         // "2023-01"
  'yyyy/MM',         // "2023/01"
  'yyyy',            // "2023"
  'MMM dd, yyyy',    // "Jan 15, 2023"
  'MMMM dd, yyyy',   // "January 15, 2023"
  'dd/MM/yyyy',      // "15/01/2023"
  'MM/dd/yyyy',      // "01/15/2023"
  'yyyy-MM-dd',      // "2023-01-15"
  'dd-MM-yyyy',      // "15-01-2023"
  'dd.MM.yyyy',      // "15.01.2023"
];

export interface ParsedDate {
  date: Date;
  formatted: string;
  isValid: boolean;
  originalValue: string;
}

/**
 * Attempts to parse a date string using multiple common formats
 */
export function parseFlexibleDate(dateString: string | null | undefined): ParsedDate {
  const originalValue = dateString?.toString() || '';
  
  // Handle special cases
  if (!dateString || dateString === '' || dateString === 'null' || dateString === 'undefined') {
    return {
      date: new Date(),
      formatted: 'Unknown',
      isValid: false,
      originalValue
    };
  }

  // Handle "Present" case
  if (dateString.toLowerCase().includes('present') || dateString.toLowerCase().includes('current')) {
    const now = new Date();
    return {
      date: now,
      formatted: 'Present',
      isValid: true,
      originalValue
    };
  }

  // Clean the input string
  const cleanDateString = dateString.toString().trim();
  
  // Try parsing with each format
  for (const formatString of DATE_FORMATS) {
    try {
      const parsedDate = parse(cleanDateString, formatString, new Date());
      
      if (isValid(parsedDate)) {
        return {
          date: parsedDate,
          formatted: format(parsedDate, 'MMM yyyy'),
          isValid: true,
          originalValue
        };
      }
    } catch (error) {
      // Continue to next format
      continue;
    }
  }

  // Try parsing as a direct Date constructor
  try {
    const directDate = new Date(cleanDateString);
    if (isValid(directDate) && !isNaN(directDate.getTime())) {
      return {
        date: directDate,
        formatted: format(directDate, 'MMM yyyy'),
        isValid: true,
        originalValue
      };
    }
  } catch (error) {
    // Continue to fallback
  }

  // Try extracting year from string if it contains one
  const yearMatch = cleanDateString.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    try {
      const year = parseInt(yearMatch[0]);
      const fallbackDate = new Date(year, 0, 1); // January 1st of that year
      
      return {
        date: fallbackDate,
        formatted: `${year}`,
        isValid: true,
        originalValue
      };
    } catch (error) {
      // Continue to final fallback
    }
  }

  // Final fallback - return current date but mark as invalid
  console.warn(`Could not parse date: "${originalValue}"`);
  return {
    date: new Date(),
    formatted: 'Unknown',
    isValid: false,
    originalValue
  };
}

/**
 * Formats a date range for display
 */
export function formatDateRange(startDate: string | Date | null | undefined, endDate: string | Date | null | undefined): string {
  const start = typeof startDate === 'string' ? parseFlexibleDate(startDate) : 
                startDate ? { date: startDate, formatted: format(startDate, 'MMM yyyy'), isValid: true, originalValue: startDate.toString() } :
                { date: new Date(), formatted: 'Unknown', isValid: false, originalValue: '' };

  const end = typeof endDate === 'string' ? parseFlexibleDate(endDate) :
              endDate ? { date: endDate, formatted: format(endDate, 'MMM yyyy'), isValid: true, originalValue: endDate.toString() } :
              null;

  if (!start.isValid) {
    return 'Unknown';
  }

  if (!end || !end.isValid || end.formatted === 'Present') {
    return `${start.formatted} - Present`;
  }

  return `${start.formatted} - ${end.formatted}`;
}

/**
 * Calculates duration between two dates
 */
export function calculateDuration(startDate: string | Date | null | undefined, endDate: string | Date | null | undefined): string {
  const start = typeof startDate === 'string' ? parseFlexibleDate(startDate) : 
                startDate ? { date: startDate, isValid: true } :
                { date: new Date(), isValid: false };

  const end = typeof endDate === 'string' ? parseFlexibleDate(endDate) :
              endDate ? { date: endDate, isValid: true } :
              { date: new Date(), isValid: true }; // Use current date if no end date

  if (!start.isValid) {
    return '';
  }

  const diffTime = Math.abs(end.date.getTime() - start.date.getTime());
  const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44)); // Average days per month

  if (diffMonths === 0) {
    return '1 month'; // Minimum duration
  }

  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;
  }

  const years = Math.floor(diffMonths / 12);
  const remainingMonths = diffMonths % 12;

  if (remainingMonths === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`;
  }

  return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
}

/**
 * Sorts an array of items by their date fields
 */
export function sortByDate<T>(items: T[], getDateField: (item: T) => string | Date | null | undefined): T[] {
  return items.sort((a, b) => {
    const dateA = parseFlexibleDate(getDateField(a)?.toString());
    const dateB = parseFlexibleDate(getDateField(b)?.toString());
    
    // Put invalid dates at the end
    if (!dateA.isValid && !dateB.isValid) return 0;
    if (!dateA.isValid) return 1;
    if (!dateB.isValid) return -1;
    
    return dateA.date.getTime() - dateB.date.getTime();
  });
}