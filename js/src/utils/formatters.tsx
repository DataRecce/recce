import { formatInTimeZone } from '@jeromefitz/date-fns-tz';
import { TopKResult } from '@/lib/api/profile';

const NO_VALUE = '-';

/**
 * "Formatters" -- these are your data formatting that returns a formatted value for UI presentation (e.g. number, string, falsey)
 */

/**
 * Source: https://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
 * @param bytes
 * @param decimals
 * @returns a string that matches nearest byte unit (e.g. kb, mb, gb, etc)
 */
export function formatBytes(bytes?: number, decimals = 2) {
  if (bytes === undefined) return;
  if (!bytes) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
/**
 * @param dateStr ISO date string
 * @returns a formatted date string in 'yyyy/MM/dd HH:mm:ss'
 */
export function formatReportTime(dateStr?: string) {
  if (!dateStr) return;
  const date = new Date(dateStr);
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return formatInTimeZone(date, userTimezone, 'yyyy-MM-dd HH:mm:ss zzz');
}

/**
 *
 * @param num number type input
 * @param locales locale string
 * @param options
 * @returns a formatted string number, based on locale & options
 */
export function formatNumber(
  num: number | string | undefined,
  locales = 'en-US',
  options?: Intl.NumberFormatOptions,
) {
  if (typeof num !== 'number') return num;
  return new Intl.NumberFormat(locales, options).format(num);
}

/**
 * @param num fractional number type input
 * @returns a formatted percentage string, based on its percentage proximity to either ends (<0.1% and >99.9%)
 */
export function formatIntervalMinMax(num: number) {
  // *  should show <0.1 % if the value is between (0%, 0.1%]
  const isLowerBound = num > 0 && num <= 0.001;
  // *  should show >99.9% if the value is between [99.9%, 100%) .
  const isUpperBound = num < 1 && num >= 0.999;

  const formatter = (newArg = num) =>
    formatNumber(newArg, 'en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
    });

  if (isLowerBound) {
    const result = formatter(0.001);
    return `<${result}`;
  } else if (isUpperBound) {
    const result = formatter(0.999);
    return `>${result}`;
  }
  return formatter();
}

// SR side: No need for object record handling
// CR side: needs record handling
export function formatTestExpectedOrActual(value?: unknown): any {
  if (!value) {
    return NO_VALUE;
  }

  // Needed due to comparison's get assertions DS
  if (typeof value === 'object') {
    return JSON.stringify(value);
    // return Object.keys(value).map((key) =>
    //   typeof value[key] === 'string' ? value[key] : JSON.stringify(value[key]),
    // );
  }

  return value;
}

/**
  show the most common values (aka Mode)
  * give null if type invalids
  * skip null value
  * show top 2 if the values share the same counting, examples:
     (more than 2) a:100, b:100, c:100 => a, b, ...
     (2) a:100, b:100 => a
     (2) null:100, a:100, b:100 => a, b
     (2) null:101, a:100, b:100 => a, b
     (2) a:100, b:100 => a, b
     (1) a:100 => a
     (1) a:100, b:99, c:99 => a
 */
export function formatTopKMetrics(topK: TopKResult) {
  if (!topK) return {};
  const { counts, values } = topK;
  const topValues = `${values[0]}`;
  const topCounts = `${counts[0]}`;

  return {
    topValues,
    topCounts,
  };
}
/**
 * A method to handle falsey non-numbers (relevant for comparison reports with column shifts, where base/target values can be undefined)
 * @param input any value that will be checked as number
 * @param fn any function to format the valid number
 * @param emptyLabel the return value if falsey value
 */
export function formatColumnValueWith(
  input: any,
  fn: Function,
  emptyLabel = NO_VALUE,
): string {
  if (typeof input === 'string') return input;
  return isNaN(input) ? emptyLabel : fn(input);
}

/**
 *
 * @param input string to check for truncation with '...'
 * @param end position at which to truncate
 * @returns original or tooltip-wrapped truncated string
 */
export function formatTruncateString(input: string, end: number) {
  const shouldTruncate = input.length >= end;
  return shouldTruncate ? input.slice(0, end) + '...' : input;
}
/**
 * base < -2 => 2dp, scientific (small decimals)
 * base < 0 => 3dp (big decimals)
 * base < 3 => 2dp (ones, tens, hundreds)
 * base < 6 => 1dp, K (thousands)
 * base < 9 => 1dp, M (millions)
 * base < 12 => 1dp, T (trillions)
 * base < 15 => 1dp, B (billions)
 * base >= 15 => 0dp, B (billions)
 * @param input
 * @returns a formatted number by abbreviation, based on its order of magnitude
 */
export function formatAsAbbreviatedNumber(input: number | string) {
  // type guard for numbers (e.g. datetime strings)
  if (typeof input !== 'number') return input;
  else {
    // convert negatives
    const inputAsPositive = Math.abs(input);

    const twoDecimal = 10 ** -2;
    const thousand = 10 ** 3;
    const million = 10 ** 6;
    const billion = 10 ** 9;
    const trillion = 10 ** 12;
    const trillionPlus = 10 ** 15;

    const isLargeFractionals = inputAsPositive >= twoDecimal;
    const isOnesTensHundreds = inputAsPositive >= 1;
    const isThousands = inputAsPositive >= thousand;
    const isMillions = inputAsPositive >= million;
    const isBillions = inputAsPositive >= billion;
    const isSmallTrillions = inputAsPositive >= trillion;
    const isLargeTrillions = inputAsPositive >= trillionPlus;

    // format as 'T' and beyond (trillions+)
    if (isLargeTrillions || isSmallTrillions)
      return new Intl.NumberFormat('en-US', {
        style: 'unit',
        unit: 'liter', //just a placeholder
        unitDisplay: 'narrow',
        maximumFractionDigits: isLargeTrillions ? 0 : 2,
      })
        .format(input / 1.0e12)
        .replace('L', 'T');
    // format as 'B', 'M', 'K' (billions to thousands)
    else if (isBillions || isMillions || isThousands) {
      const lookup = {
        base: isBillions ? billion : isMillions ? million : thousand,
        unit: isBillions ? 'B' : isMillions ? 'M' : 'K',
      };
      return new Intl.NumberFormat('en-US', {
        style: 'unit',
        unit: 'liter', //just a placeholder
        unitDisplay: 'narrow',
        maximumFractionDigits: 1,
      })
        .format(input / lookup.base)
        .replace('L', lookup.unit);
    }
    // format as unlabeled (1 to 999)
    else if (isOnesTensHundreds)
      return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
      }).format(input);
    // format as fractionals (< 1)
    else
      return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: isLargeFractionals ? 3 : 2,
        notation:
          isLargeFractionals || inputAsPositive === 0
            ? 'standard'
            : 'scientific',
      }).format(input);
  }
}

/**
 * formats as 'Category' instead of 'category' or 'CATEGORY'
 */
export function formatTitleCase(input?: string) {
  if (!input) return NO_VALUE;
  const start = input.slice(0, 1).toUpperCase();
  const rest = input.slice(1).toLowerCase();
  return `${start}${rest}`;
}
