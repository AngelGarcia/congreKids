import { differenceInMonths, startOfDay, endOfDay, previousThursday, isBefore, format, addDays, subDays, isFriday, nextFriday, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

export function calculateAgeInMonths(birthDate: Date, targetDate: Date): number {
  return differenceInMonths(targetDate, birthDate);
}

export function getDefaultDeadline(meetingDate: Date): Date {
  // Por defecto: Jueves anterior a las 23:59
  const thursday = previousThursday(meetingDate);
  return endOfDay(thursday);
}

/**
 * La inscripción abre 5 días antes de la reunión por defecto.
 */
export function getRegistrationOpeningDate(meetingDate: Date): Date {
  return startOfDay(subDays(meetingDate, 5));
}

export function isRegistrationOpen(deadline: Date, openingDate?: Date): boolean {
  const now = new Date();
  if (openingDate && isBefore(now, openingDate)) return false;
  return isBefore(now, deadline);
}

export function isTooEarlyForRegistration(openingDate: Date): boolean {
  return isBefore(new Date(), openingDate);
}

export function formatDate(date: Date | any): string {
  if (!date) return '';
  const d = date instanceof Date ? date : date.toDate();
  return format(d, "eeee, d 'de' MMMM 'de' yyyy", { locale: es });
}

export function formatDateTime(date: Date | any): string {
  if (!date) return '';
  const d = date instanceof Date ? date : date.toDate();
  return format(d, "eeee, d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });
}

/**
 * Genera una lista de viernes a las 17:30 para un mes específico.
 */
export function generateFridaysForMonth(year: number, month: number): Date[] {
  const start = startOfMonth(new Date(year, month));
  const end = endOfMonth(start);
  
  return eachDayOfInterval({ start, end })
    .filter(date => isFriday(date))
    .map(date => {
      const d = new Date(date);
      d.setHours(17, 30, 0, 0);
      return d;
    });
}
