import type { IsoDate, Period } from "@/domain/types";

// Fixed locale and UTC so server and client render identical strings (no hydration mismatch).
const LOCALE = "en-GB";

const krFormat = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const periodFormat = new Intl.DateTimeFormat(LOCALE, { month: "short", year: "numeric", timeZone: "UTC" });
const dayMonthFormat = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone: "UTC" });
const fullDateFormat = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const formatKr = (amount: number) => `${krFormat.format(amount)} kr`;

/** "2026-08" → "Aug 2026" */
export const formatPeriod = (period: Period) => periodFormat.format(new Date(`${period}-01T00:00:00Z`));

/** ISO date or timestamp → "5 Aug" */
export const formatDayMonth = (iso: string) => dayMonthFormat.format(new Date(iso));

/** "2026-10-13" → "13 Oct 2026" */
export const formatDate = (date: IsoDate) => fullDateFormat.format(new Date(`${date}T00:00:00Z`));

export const formatDays = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;
