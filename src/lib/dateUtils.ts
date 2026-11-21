import { ReportingPeriod } from '../types/business';

export const REFERENCE_TODAY = '2026-11-21';

export function formatDisplayDate(
  isoDate: string,
  format: 'YYYY-MM-DD' | 'MMM D, YYYY' | 'DD/MM/YYYY' = 'MMM D, YYYY'
): string {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return isoDate;

  if (format === 'YYYY-MM-DD') {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  if (format === 'DD/MM/YYYY') {
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
}

export function getPeriodDateRange(
  period: ReportingPeriod,
  referenceISO: string = REFERENCE_TODAY
): { start: string | null; end: string | null; prevStart: string | null; prevEnd: string | null; label: string } {
  const ref = new Date(`${referenceISO}T00:00:00Z`);
  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth();

  const toISO = (dt: Date) => dt.toISOString().slice(0, 10);

  if (period === 'this_month') {
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0));
    const prevStart = new Date(Date.UTC(year, month - 1, 1));
    const prevEnd = new Date(Date.UTC(year, month, 0));
    return {
      start: toISO(start),
      end: toISO(end),
      prevStart: toISO(prevStart),
      prevEnd: toISO(prevEnd),
      label: 'This Month',
    };
  }

  if (period === 'last_30_days') {
    const start = new Date(ref);
    start.setUTCDate(ref.getUTCDate() - 29);
    const prevEnd = new Date(start);
    prevEnd.setUTCDate(start.getUTCDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setUTCDate(prevEnd.getUTCDate() - 29);
    return {
      start: toISO(start),
      end: referenceISO,
      prevStart: toISO(prevStart),
      prevEnd: toISO(prevEnd),
      label: 'Last 30 Days',
    };
  }

  if (period === 'this_quarter') {
    const qStartMonth = Math.floor(month / 3) * 3;
    const start = new Date(Date.UTC(year, qStartMonth, 1));
    const end = new Date(Date.UTC(year, qStartMonth + 3, 0));
    const prevStart = new Date(Date.UTC(year, qStartMonth - 3, 1));
    const prevEnd = new Date(Date.UTC(year, qStartMonth, 0));
    return {
      start: toISO(start),
      end: toISO(end),
      prevStart: toISO(prevStart),
      prevEnd: toISO(prevEnd),
      label: 'This Quarter',
    };
  }

  if (period === 'year_to_date') {
    const start = new Date(Date.UTC(year, 0, 1));
    const prevStart = new Date(Date.UTC(year - 1, 0, 1));
    const prevEnd = new Date(Date.UTC(year - 1, month, ref.getUTCDate()));
    return {
      start: toISO(start),
      end: referenceISO,
      prevStart: toISO(prevStart),
      prevEnd: toISO(prevEnd),
      label: 'Year to Date',
    };
  }

  return {
    start: null,
    end: null,
    prevStart: null,
    prevEnd: null,
    label: 'All Time',
  };
}

export function isDateInRange(isoDate: string, start: string | null, end: string | null): boolean {
  if (!isoDate) return false;
  const d = isoDate.slice(0, 10);
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

export function formatMinutesToHours(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}
