/**
 * "Formatters" -- these are your data formatting that returns a formatted value for UI presentation (e.g. number, string, falsey)
 */

/**
 *
 * @param num number type input
 * @param locales locale string
 * @param options
 * @returns a formatted string number, based on locale & options
 */
export function formatNumber(
  num: number | string | undefined,
  locales = "en-US",
  options?: Intl.NumberFormatOptions,
) {
  if (typeof num !== "number") return num;
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
    formatNumber(newArg, "en-US", {
      style: "percent",
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
  if (typeof input !== "number") return input;
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
      return new Intl.NumberFormat("en-US", {
        style: "unit",
        unit: "liter", //just a placeholder
        unitDisplay: "narrow",
        maximumFractionDigits: isLargeTrillions ? 0 : 2,
      })
        .format(input / 1.0e12)
        .replace("L", "T");
    // format as 'B', 'M', 'K' (billions to thousands)
    else if (isBillions || isMillions || isThousands) {
      const lookup = {
        base: isBillions ? billion : isMillions ? million : thousand,
        unit: isBillions ? "B" : isMillions ? "M" : "K",
      };
      return new Intl.NumberFormat("en-US", {
        style: "unit",
        unit: "liter", //just a placeholder
        unitDisplay: "narrow",
        maximumFractionDigits: 1,
      })
        .format(input / lookup.base)
        .replace("L", lookup.unit);
    }
    // format as unlabeled (1 to 999)
    else if (isOnesTensHundreds)
      return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
      }).format(input);
    // format as fractionals (< 1)
    else
      return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: isLargeFractionals ? 3 : 2,
        notation:
          isLargeFractionals || inputAsPositive === 0
            ? "standard"
            : "scientific",
      }).format(input);
  }
}
