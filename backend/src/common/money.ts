
export function percentOfCents(cents: number, percent: number): number {
  return Math.round((cents * Math.round(percent * 100)) / 10000);
}
