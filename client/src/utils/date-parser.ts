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
      formatted: '',
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
    formatted: '',
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
                { date: new Date(), formatted: '', isValid: false, originalValue: '' };

  const end = typeof endDate === 'string' ? parseFlexibleDate(endDate) :
              endDate ? { date: endDate, formatted: format(endDate, 'MMM yyyy'), isValid: true, originalValue: endDate.toString() } :
              null;

  if (!start.isValid) {
    return ''; // Return empty string instead of 'Unknown'
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

// Timeline positioning constants  
const PRIMARY_Y = 300;
const BRANCH_SPACING = 250; // Increased vertical spacing between branches
const NODE_SPACING = 600; // Increased horizontal spacing between nodes
const MIN_NODE_DISTANCE = 450; // Minimum distance between any two nodes
const START_X = 200;

/**
 * Interface for timeline positioning result
 */
export interface TimelinePosition {
  x: number;
  y: number;
  branch: number;
}

/**
 * Interface for date range objects
 */
export interface DateRange {
  start: string | Date | null | undefined;
  end: string | Date | null | undefined;
}

/**
 * Detects if two date ranges overlap for branching logic
 * @param range1 - First date range to compare
 * @param range2 - Second date range to compare
 * @returns True if the ranges overlap, false otherwise
 */
export function detectDateOverlap(range1: DateRange, range2: DateRange): boolean {
  // Parse dates for both ranges
  const start1 = parseFlexibleDate(range1.start?.toString());
  const end1 = range1.end ? parseFlexibleDate(range1.end.toString()) : { date: new Date(), isValid: true };
  const start2 = parseFlexibleDate(range2.start?.toString());
  const end2 = range2.end ? parseFlexibleDate(range2.end.toString()) : { date: new Date(), isValid: true };

  // If any dates are invalid, consider no overlap to avoid positioning issues
  if (!start1.isValid || !start2.isValid) {
    return false;
  }

  // Use current date for invalid end dates (ongoing items)
  const end1Date = end1.isValid ? end1.date : new Date();
  const end2Date = end2.isValid ? end2.date : new Date();

  // Check for overlap: ranges overlap if start1 <= end2 AND start2 <= end1
  return start1.date.getTime() <= end2Date.getTime() && 
         start2.date.getTime() <= end1Date.getTime();
}

/**
 * Calculates timeline positioning on a single straight line
 * Based on vis.js timeline algorithms for optimal node placement
 * All items placed on same Y level with intelligent horizontal spacing
 * @param items - Array of items with start and end dates (must be sorted by start date)
 * @param index - Index of the current item to position
 * @returns Position object with x, y coordinates and branch number (always 0)
 */
export function calculateTimelinePosition(
  items: Array<DateRange>, 
  index: number
): TimelinePosition {
  if (index < 0 || index >= items.length) {
    return { x: START_X, y: PRIMARY_Y, branch: 0 };
  }

  const currentItem = items[index];
  
  // Calculate initial date-based X position
  let x = calculateDateBasedXPosition(currentItem, items);
  
  // Enhanced spacing algorithm with overlap detection
  // Build list of all previous positions with their associated items
  const previousPositions: Array<{ x: number, item: DateRange, index: number }> = [];
  
  for (let i = 0; i < index; i++) {
    const prevItem = items[i];
    const prevX = calculateDateBasedXPosition(prevItem, items);
    previousPositions.push({ x: prevX, item: prevItem, index: i });
  }
  
  // Sort by X position for easier conflict detection
  previousPositions.sort((a, b) => a.x - b.x);
  
  // Start with the date-based position
  let adjustedX = x;
  
  // Check for overlaps and adjust position accordingly
  let hasOverlap = false;
  
  // First, check if current item overlaps with any previous items
  for (const prevPos of previousPositions) {
    if (detectDateOverlap(currentItem, prevPos.item)) {
      hasOverlap = true;
      
      // Find the rightmost position of all overlapping items
      let rightmostX = prevPos.x;
      
      // Check all items that overlap with current item
      for (const checkPos of previousPositions) {
        if (detectDateOverlap(currentItem, checkPos.item)) {
          rightmostX = Math.max(rightmostX, checkPos.x);
        }
      }
      
      // Position current item to the right of all overlapping items
      adjustedX = Math.max(adjustedX, rightmostX + MIN_NODE_DISTANCE);
      break;
    }
  }
  
  // If no date overlap, still check for visual position conflicts
  if (!hasOverlap) {
    let attempts = 0;
    const maxAttempts = previousPositions.length + 1;
    
    while (attempts < maxAttempts) {
      let hasConflict = false;
      
      // Check for visual conflicts with all existing positions
      for (const prevPos of previousPositions) {
        if (Math.abs(adjustedX - prevPos.x) < MIN_NODE_DISTANCE) {
          hasConflict = true;
          // Move to the right of the conflicting position
          adjustedX = prevPos.x + MIN_NODE_DISTANCE;
          break;
        }
      }
      
      if (!hasConflict) {
        break;
      }
      
      attempts++;
    }
  }
  
  // Ensure minimum distance from timeline start
  adjustedX = Math.max(START_X, adjustedX);
  
  // All nodes on single straight timeline - same Y coordinate, branch 0
  return { x: adjustedX, y: PRIMARY_Y, branch: 0 };
}

/**
 * Calculates X position based on timeline position relative to start dates
 * @param currentItem - The item to position
 * @param allItems - All items for reference (to calculate timeline scale)
 * @returns X coordinate based on timeline position
 */
function calculateDateBasedXPosition(currentItem: DateRange, allItems: Array<DateRange>): number {
  // Parse dates for current item
  const startDate = parseFlexibleDate(currentItem.start?.toString());
  const endDate = currentItem.end ? parseFlexibleDate(currentItem.end.toString()) : null;
  
  if (!startDate.isValid) {
    return START_X; // Fallback to start position
  }

  // Calculate center point of current item's date range
  const currentStart = startDate.date.getTime();
  const currentEnd = endDate?.isValid ? endDate.date.getTime() : new Date().getTime();
  const currentCenter = currentStart + ((currentEnd - currentStart) / 2);

  // Get all timeline bounds (start and end dates)
  const allDates: Date[] = [];
  allItems.forEach(item => {
    const itemStart = parseFlexibleDate(item.start?.toString());
    if (itemStart.isValid) allDates.push(itemStart.date);
    
    const itemEnd = item.end ? parseFlexibleDate(item.end.toString()) : null;
    if (itemEnd?.isValid) allDates.push(itemEnd.date);
  });

  if (allDates.length === 0) {
    return START_X;
  }

  // Sort all dates to establish timeline bounds
  const sortedDates = allDates.sort((a, b) => a.getTime() - b.getTime());
  const minDate = sortedDates[0];
  const maxDate = sortedDates[sortedDates.length - 1];
  const timelineRange = maxDate.getTime() - minDate.getTime();

  if (timelineRange === 0) {
    // All items have the same start and end dates, space them evenly with extra margin
    const itemIndex = allItems.findIndex(item => {
      const itemStart = parseFlexibleDate(item.start?.toString());
      return itemStart?.isValid && itemStart.date.getTime() === startDate.date.getTime();
    });
    
    // Use larger spacing when all items have identical dates to prevent overlap
    const IDENTICAL_DATE_SPACING = Math.max(NODE_SPACING * 2, 600);
    return START_X + (itemIndex * IDENTICAL_DATE_SPACING);
  }

  // Calculate position based on center point of date range relative to timeline
  const timeProgress = (currentCenter - minDate.getTime()) / timelineRange;
  
  // Dynamic timeline width based on number of items and date spread
  const getOptimalTimelineWidth = (itemCount: number, hasDateSpread: boolean): number => {
    const MIN_WIDTH = 1200;   // Further increased minimum for better spacing
    const MAX_WIDTH = 3000;   // Increased maximum for more spread
    const BASE_SPACING = 450; // Further increased base spacing per item
    
    // If all items have same dates, use wider spacing to prevent overlap
    if (!hasDateSpread) {
      return Math.max(MIN_WIDTH, itemCount * BASE_SPACING * 2);
    }
    
    // For few items (1-3), use generous spacing
    if (itemCount <= 3) {
      return Math.max(MIN_WIDTH, itemCount * BASE_SPACING * 1.5);
    }
    
    // For medium count (4-8), use normal spacing
    if (itemCount <= 8) {
      return Math.min(MAX_WIDTH, itemCount * BASE_SPACING * 1.3);
    }
    
    // For many items (9+), still maintain reasonable spacing
    return Math.min(MAX_WIDTH, itemCount * BASE_SPACING);
  };
  
  const TIMELINE_WIDTH = getOptimalTimelineWidth(allItems.length, timelineRange > 0);
  
  return START_X + (timeProgress * TIMELINE_WIDTH);
}


/**
 * Enhanced sorting utility for timeline items with flexible date accessors
 * @param items - Array of items to sort
 * @param getStart - Function to extract start date from an item
 * @param getEnd - Optional function to extract end date from an item
 * @returns Sorted array of items by start date (and end date if provided)
 */
export function sortItemsByDate<T>(
  items: T[], 
  getStart: (item: T) => string | Date | null | undefined,
  getEnd?: (item: T) => string | Date | null | undefined
): T[] {
  return items.sort((a, b) => {
    const startA = parseFlexibleDate(getStart(a)?.toString());
    const startB = parseFlexibleDate(getStart(b)?.toString());
    
    // Put invalid start dates at the end
    if (!startA.isValid && !startB.isValid) {
      // If both start dates are invalid, try end dates if available
      if (getEnd) {
        const endA = parseFlexibleDate(getEnd(a)?.toString());
        const endB = parseFlexibleDate(getEnd(b)?.toString());
        
        if (!endA.isValid && !endB.isValid) return 0;
        if (!endA.isValid) return 1;
        if (!endB.isValid) return -1;
        
        return endA.date.getTime() - endB.date.getTime();
      }
      return 0;
    }
    if (!startA.isValid) return 1;
    if (!startB.isValid) return -1;
    
    // Compare start dates
    const startDiff = startA.date.getTime() - startB.date.getTime();
    
    // If start dates are the same and we have end date accessor, compare end dates
    if (startDiff === 0 && getEnd) {
      const endA = parseFlexibleDate(getEnd(a)?.toString());
      const endB = parseFlexibleDate(getEnd(b)?.toString());
      
      // Items without end dates (ongoing) should come after items with end dates
      if (!endA.isValid && !endB.isValid) return 0;
      if (!endA.isValid) return 1;
      if (!endB.isValid) return -1;
      
      return endA.date.getTime() - endB.date.getTime();
    }
    
    return startDiff;
  });
}