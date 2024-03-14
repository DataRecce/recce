export function deltaPercentageString(base: number, current: number) {
  if (base < current) {
    const p = ((current - base) / base) * 100;
    return `+${p >= 0.1 ? p.toFixed(1) : " <0.1 "}%`;
  } else if (base > current) {
    const p = ((base - current) / base) * 100;
    return `-${p >= 0.1 ? p.toFixed(1) : " <0.1 "}%`;
  } else {
    return "0 %";
  }
}
