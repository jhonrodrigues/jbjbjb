export type PeriodKey = "today" | "7d" | "30d" | "90d" | "custom";
export type DateRange = { key: PeriodKey; from: Date; to: Date; fromIso: string; toIso: string; label: string };

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Sao_Paulo";

export function toAppLocalInput(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`;
}

export function parseAppLocalInput(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("INVALID_LOCAL_DATE");
  const wall = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(wall)) throw new Error("INVALID_LOCAL_DATE");
  let instant = wall;
  for (let i = 0; i < 3; i++) {
    const rendered = Date.parse(`${toAppLocalInput(new Date(instant))}:00Z`);
    instant += wall - rendered;
  }
  const result = new Date(instant);
  // Reject invalid calendar dates and nonexistent local times at DST boundaries.
  if (toAppLocalInput(result) !== value) throw new Error("INVALID_LOCAL_DATE");
  return result;
}

export function addCalendarDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calendarDaysInRange(from: Date, to: Date, timeZone = APP_TIMEZONE): string[] {
  if (to <= from) return [];
  const dayKey = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const pick = (type: string) => parts.find((part) => part.type === type)!.value;
    return `${pick("year")}-${pick("month")}-${pick("day")}`;
  };

  const last = dayKey(new Date(to.getTime() - 1));
  const days: string[] = [];
  for (let day = dayKey(from); day <= last; day = addCalendarDays(day, 1)) {
    days.push(day);
  }
  return days;
}

export function appDay(date = new Date()): string {
  return toAppLocalInput(date).slice(0, 10);
}

function midnight(day: string): Date {
  return parseAppLocalInput(`${day}T00:00`);
}

export function resolvePeriod(period: string | undefined, fromParam?: string, toParam?: string): DateRange {
  const key: PeriodKey = ["today", "7d", "30d", "90d", "custom"].includes(period ?? "") ? period as PeriodKey : "30d";
  const today = appDay();
  let first = addCalendarDays(today, key === "today" ? 0 : key === "7d" ? -6 : key === "90d" ? -89 : -29);
  let end = addCalendarDays(today, 1);
  let label = key === "today" ? "Hoje" : key === "7d" ? "Últimos 7 dias" : key === "90d" ? "Últimos 90 dias" : "Últimos 30 dias";
  if (key === "custom" && fromParam && toParam) {
    try {
      const from = midnight(fromParam);
      const to = midnight(toParam);
      if (from <= to && to.getTime() - from.getTime() <= 366 * 86400000) {
        first = fromParam;
        end = addCalendarDays(toParam, 1);
        const format = (day: string) => day.split("-").reverse().join("/");
        label = `${format(fromParam)} a ${format(toParam)}`;
      }
    } catch { /* Invalid custom range retains the bounded default. */ }
  }
  const from = midnight(first);
  const to = midnight(end);
  return { key, from, to, fromIso: from.toISOString(), toIso: to.toISOString(), label };
}

export function periodQuery(range: DateRange): string {
  return `period=${range.key}`;
}
