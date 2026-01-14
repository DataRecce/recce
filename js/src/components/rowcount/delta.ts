export function deltaPercentageString(base: number, current: number) {
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
