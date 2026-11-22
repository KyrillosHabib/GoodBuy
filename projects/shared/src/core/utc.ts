// The API stores UTC but may serialize DateTime without a "Z". Always treat it as UTC.
export function parseUtc(value: string): Date {
  return new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value + 'Z');
}
