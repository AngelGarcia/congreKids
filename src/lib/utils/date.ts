import { differenceInMonths, startOfDay, endOfDay, setHours, setMinutes, previousThursday, isBefore } from 'date-fns';

export function calculateAgeInMonths(birthDate: Date, targetDate: Date): number {
  return differenceInMonths(targetDate, birthDate);
}

export function getDefaultDeadline(meetingDate: Date): Date {
  // Default to Thursday 23:59 before the meeting
  const thursday = previousThursday(meetingDate);
  return endOfDay(thursday);
}

export function isRegistrationOpen(deadline: Date): boolean {
  return isBefore(new Date(), deadline);
}

export function formatDate(date: Date | any): string {
  if (!date) return '';
  const d = date instanceof Date ? date : date.toDate();
  return d.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
