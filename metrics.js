const DAY = 86400000;
const UNITS = [{ key: 'day', days: 1, label: '天' }, { key: 'week', days: 7, label: '周' }, { key: 'month', days: 30, label: '月' }];

// Calendar days in the device's timezone, without DST changing the denominator.
export function localDay(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
}

export function approximateFrequency(rate, previousUnit) {
  const choices = UNITS.map(unit => {
    const exact = rate * unit.days;
    const count = Math.round(exact);
    return { ...unit, count, error: count > 0 ? Math.abs(count - exact) / exact : Infinity };
  });
  let selected = choices.find(unit => unit.error <= 0.10) || choices[2];
  const previous = choices.find(unit => unit.key === previousUnit);
  // A wider exit threshold and narrower entry threshold reduce unit flicker.
  if (previous && previous.error <= 0.15 &&
      (previous.days < selected.days || (previous.days > selected.days && selected.error > 0.05))) selected = previous;
  return { unit: selected.key, label: `约 ${selected.count} 次/${selected.label}` };
}

export function activityFrequency(activity, logs, now = new Date(), previousUnit) {
  const today = localDay(now);
  const entries = logs.filter(log => log.activityId === activity.id);
  // A backfilled occurrence does not prove continuous observation before tracking began.
  // recordedAt also supports old backups whose activity creation date is missing.
  let observedStart = today;
  for (const value of [activity.createdAt, ...entries.map(log => log.recordedAt)]) {
    const day = localDay(value);
    if (day !== null && day <= today) observedStart = Math.min(observedStart, day);
  }
  const start = Math.max(today - 29, observedStart);
  const days = today - start + 1;
  const occurrenceDays = entries.map(log => localDay(log.occurredAt)).filter(day => day !== null && day >= start && day <= today);
  const count = occurrenceDays.length;
  const distinctDays = new Set(occurrenceDays).size;
  const note = days < 30 ? `仅观察 ${days} 天` : '';
  if (days === 30 && count === 0) return { label: '近 30 天无记录', days, count, note };
  if (days < 7 || count < 2 || distinctDays < 2) return { label: '记录不足', days, count, note };
  return { ...approximateFrequency(count / days, previousUnit), days, count, note };
}

// Only suppress rapid taps on the same quick-log button. Backfill is independent.
export function createTapGuard(interval = 600, clock = () => performance.now()) {
  const acceptedAt = new Map();
  return id => {
    const now = clock();
    const previous = acceptedAt.get(id);
    if (previous !== undefined && now - previous < interval) return false;
    acceptedAt.set(id, now);
    return true;
  };
}
