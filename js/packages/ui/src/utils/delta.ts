/**
 * @file delta.ts
 * @description Utility functions for calculating and formatting delta percentages
 *
 * These utilities are used to display percentage changes between base and current values
 * in data comparison views (row counts, value diffs, etc.)
 */

/**
 * Calculate and format the percentage change between two values.
 *
 * @param base - The baseline value (denominator for percentage calculation)
 * @param current - The current value to compare against baseline
 * @returns Formatted percentage string with sign (+/-) or special values for edge cases
 *
 * @example
 * deltaPercentageString(100, 110) // "+10.0%"
 * deltaPercentageString(100, 90)  // "-10.0%"
 * deltaPercentageString(100, 100) // "0"
 * deltaPercentageString(0, 100)   // "N/A" (division by zero)
 * deltaPercentageString(1000, 1000.5) // "+ <0.1 %" (very small change)
 */
export function deltaPercentageString(base: number, current: number): string {
  // Handle divide by zero - percentage change from 0 is undefined
  if (base === 0 && current !== 0) {
    return "N/A";
  }

  if (base < current) {
    const p = ((current - base) / base) * 100;
    return `+${p >= 0.1 ? p.toFixed(1) : " <0.1 "}%`;
  } else if (base > current) {
    const p = ((base - current) / base) * 100;
    return `-${p >= 0.1 ? p.toFixed(1) : " <0.1 "}%`;
  } else {
    return "0";
  }
}
