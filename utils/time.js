// Time helpers for prayer schedules.
//
// KEY INVARIANT: prayer times are expressed in the timezone of the
// SELECTED CITY, which may differ from the device timezone
// (e.g. GPS in Helsinki, selected city Mecca -> schedule is Asia/Riyadh).
// All "now" computations below take the city timezone into account.

// Returns the current time in `timeZone` as parts:
// { year, month, day, hours, minutes, seconds, weekday }
// Uses the Intl API which understands IANA timezone names incl. DST.
export function nowInTimeZone(timeZone) {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || undefined,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const parts = {};
  for (const p of dtf.formatToParts(now)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  const hours = Number(parts.hour) % 24; // Intl may return "24" for midnight
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hours,
    minutes: Number(parts.minute),
    seconds: Number(parts.second),
    weekday: parts.weekday,
  };
}

// How many ms the device clock is ahead of the city clock.
// Positive result: city time = device time - offsetMs.
export function timeZoneOffsetMs(timeZone) {
  const cityNow = nowInTimeZone(timeZone);
  const asUtc = Date.UTC(
    cityNow.year,
    cityNow.month - 1,
    cityNow.day,
    cityNow.hours,
    cityNow.minutes,
    cityNow.seconds
  );
  return Date.now() - asUtc;
}

// Current date (YYYY-MM-DD) in the city timezone.
export function todayInTimeZone(timeZone) {
  const p = nowInTimeZone(timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

// "HH:MM" -> minutes since midnight. Returns null for malformed values.
export function timeToMinutes(time) {
  if (!time || typeof time !== "string") return null;
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!isFinite(h) || !isFinite(m)) return null;
  return h * 60 + m;
}

export function minutesToTime(totalMinutes) {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// Next prayer among PRAYER names only (Sunrise is never a "next prayer").
// prayers: [{ name, time }]; timeZone: IANA name of the schedule.
export function getNextPrayer(prayers, timeZone) {
  if (!prayers || prayers.length === 0) return null;
  const cityNow = nowInTimeZone(timeZone);
  const nowMinutes = cityNow.hours * 60 + cityNow.minutes + cityNow.seconds / 60;

  for (let i = 0; i < prayers.length; i++) {
    const mins = timeToMinutes(prayers[i].time);
    if (mins !== null && mins > nowMinutes) {
      return { ...prayers[i], index: i, tomorrow: false };
    }
  }
  // All prayers passed today -> next is tomorrow's Fajr
  return { ...prayers[0], index: 0, tomorrow: true };
}

// Milliseconds from "now in city timezone" until the given prayer time.
// Handles the midnight rollover via the `tomorrow` flag.
export function getMsUntilPrayer(prayerTime, timeZone, tomorrow = false) {
  const mins = timeToMinutes(prayerTime);
  if (mins === null) return 0;
  const cityNow = nowInTimeZone(timeZone);
  const nowMs =
    (cityNow.hours * 60 + cityNow.minutes) * 60 * 1000 + cityNow.seconds * 1000;
  const targetMs = mins * 60 * 1000;
  let diff = targetMs - nowMs;
  if (tomorrow) diff += 24 * 60 * 60 * 1000;
  return Math.max(0, diff);
}

export function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// Human date for the schedule header, rendered in the city timezone.
export function formatDateInTimeZone(timeZone, locale = "ru-RU") {
  const now = new Date();
  try {
    return now.toLocaleDateString(locale, {
      timeZone: timeZone || undefined,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch (e) {
    return now.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
}
