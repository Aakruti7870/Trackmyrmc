---
name: RMC shift windows cross midnight
description: How to compute shift time-windows (incl. night shift) and persist per-shift data correctly
---

The plant runs three shifts: Morning 06:00–14:00, Afternoon 14:00–22:00, Night 22:00–06:00 (next day).

Rule: compute shift boundaries as absolute `Date` objects (start/end datetimes), NOT hour-of-day numbers.

**Why:** the night shift spans midnight. Filtering batches/challans by `isToday()` or by hour-of-day silently drops the
22:00–23:59 portion once the clock passes midnight, so a night-shift report viewed after 00:00 shows a wrong
score/timeline/mix. A previous implementation had exactly this bug.

**How to apply:**
- Derive `{ start, end }` Dates from `now` (when 00:00 ≤ now < 06:00 the night shift started *yesterday* at 22:00).
- Filter records by `time.getTime() >= start && <= end`; compute timeline % from the ms span.
- Anchor any per-shift persistence key (e.g. localStorage memo) to `start`'s date, not `now`'s date, so one night
  shift keeps one key across midnight.
