import Order from "../models/order.js";

export const ACTIVE_TABLE_STATUSES = ["New", "Preparing", "Ready"];
export const DEFAULT_RESERVATION_MINUTES = 60;

export function parseTimeLabelTo24Hour(value) {
  const raw = String(value || "").trim().toUpperCase();
  const match = raw.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const amPm = match[3];
  if (hour < 1 || hour > 12) return null;
  if (hour === 12) hour = 0;
  if (amPm === "PM") hour += 12;
  return { hour, minute };
}

export function parseTime24(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function buildLocalDate(dateStr, timeStr) {
  const dateMatch = String(dateStr || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const time = parseTime24(timeStr);
  if (!dateMatch || !time) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]) - 1;
  const day = Number(dateMatch[3]);
  return new Date(year, month, day, time.hour, time.minute, 0, 0);
}

export function deriveReservationStart({
  reservationStart,
  reservationDate,
  reservationTime,
  timeSlotLabel,
  fallbackDate
}) {
  if (reservationStart) {
    const parsed = new Date(reservationStart);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  if (reservationDate && reservationTime) {
    const built = buildLocalDate(reservationDate, reservationTime);
    if (built && !Number.isNaN(built.getTime())) return built;
  }

  if (timeSlotLabel) {
    const parts = parseTimeLabelTo24Hour(timeSlotLabel);
    if (!parts) return null;
    const base = fallbackDate instanceof Date && !Number.isNaN(fallbackDate.getTime())
      ? fallbackDate
      : new Date();
    const candidate = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      parts.hour,
      parts.minute,
      0,
      0
    );
    if (candidate.getTime() < base.getTime()) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate;
  }

  return null;
}

export function buildReservationWindow({ start, durationMin = DEFAULT_RESERVATION_MINUTES }) {
  if (!start || Number.isNaN(start.getTime())) return null;
  const minutes = Number(durationMin || DEFAULT_RESERVATION_MINUTES);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const end = new Date(start.getTime() + minutes * 60 * 1000);
  return { start, end, durationMin: minutes };
}

export function normalizeTimeLabel(value) {
  return String(value || "").trim();
}

export async function expireTableReservations(now = new Date()) {
  if (!now || Number.isNaN(now.getTime())) return;
  await Order.updateMany(
    {
      orderType: "table",
      status: { $in: ACTIVE_TABLE_STATUSES },
      reservationEnd: { $exists: true, $lte: now }
    },
    { $set: { status: "Cancelled" } }
  );
}
