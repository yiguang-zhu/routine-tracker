import test from 'node:test';
import assert from 'node:assert/strict';
import { activityFrequency, approximateFrequency, createTapGuard, localDay } from '../metrics.js';
import { parseBackup, toBackup } from '../storage.js';

const now = new Date(2026, 10, 10, 18);
function daysAgo(days, hour = 12) { return new Date(2026, 10, 10 - days, hour).toISOString(); }
const activity = { id: 'a', name: 'Laundry', emoji: '🧺', createdAt: daysAgo(60), order: 0, archived: false };
function logs(count, days = 30) {
  return Array.from({ length: count }, (_, i) => ({ id: `l${i}`, activityId: 'a', occurredAt: daysAgo(i % days), recordedAt: daysAgo(i % days) }));
}

test('agreed integer day, week and month examples', () => {
  for (const [rate, label] of [[3, '约 3 次/天'], [1.5, '约 11 次/周'], [1.2, '约 8 次/周'], [2/7, '约 2 次/周'], [1/15, '约 2 次/月']]) {
    assert.equal(approximateFrequency(rate).label, label);
  }
});
test('counts every same-day event instead of measuring gaps', () => {
  const result = activityFrequency(activity, logs(90), now);
  assert.equal(result.count, 90);
  assert.equal(result.label, '约 3 次/天');
});
test('window includes today and day 29 but excludes day 30 and future dates', () => {
  const rows = [0, 29, 30, -1].map((d, i) => ({ id: `${i}`, activityId: 'a', occurredAt: daysAgo(d), recordedAt: daysAgo(0) }));
  rows.push({ ...rows[0], activityId: 'other' }, { ...rows[0], occurredAt: 'invalid' });
  const result = activityFrequency(activity, rows, now);
  assert.equal(result.count, 2);
  assert.equal(result.label, '约 2 次/月');
});
test('partial observation divides by actual calendar days and labels it', () => {
  const result = activityFrequency({ ...activity, createdAt: daysAgo(9) }, logs(15, 10), now);
  assert.equal(result.days, 10);
  assert.equal(result.label, '约 11 次/周');
  assert.equal(result.note, '仅观察 10 天');
});
test('too few days, a single record, and a same-day burst are insufficient', () => {
  assert.equal(activityFrequency({ ...activity, createdAt: daysAgo(5) }, logs(18, 6), now).label, '记录不足');
  assert.equal(activityFrequency(activity, logs(1), now).label, '记录不足');
  assert.equal(activityFrequency(activity, logs(50, 1), now).label, '记录不足');
});
test('seven observed days with two different dates can be estimated', () => {
  assert.equal(activityFrequency({ ...activity, createdAt: daysAgo(6) }, logs(2), now).label, '约 2 次/周');
});
test('zero records distinguishes a full window from insufficient observation', () => {
  assert.equal(activityFrequency(activity, [], now).label, '近 30 天无记录');
  assert.equal(activityFrequency({ ...activity, createdAt: daysAgo(2) }, [], now).label, '记录不足');
});
test('backfill before tracking began does not invent a longer observation period', () => {
  const rows = logs(3).map(log => ({ ...log, occurredAt: daysAgo(20), recordedAt: daysAgo(0) }));
  const result = activityFrequency({ ...activity, createdAt: daysAgo(0) }, rows, now);
  assert.equal(result.days, 1);
  assert.equal(result.count, 0);
  assert.equal(result.label, '记录不足');
});
test('recordedAt can establish observation for legacy missing creation dates', () => {
  const result = activityFrequency({ ...activity, createdAt: undefined }, logs(14, 7), now);
  assert.equal(result.days, 7);
  assert.equal(result.label, '约 2 次/天');
});
test('invalid or future observation dates do not fabricate 30 days', () => {
  for (const createdAt of [null, undefined, '', 'invalid', daysAgo(-3)]) {
    assert.equal(activityFrequency({ ...activity, createdAt }, [], now).days, 1);
  }
});
test('local date windows work across month/year boundaries and DST', () => {
  assert.equal(localDay(new Date(2026, 10, 2, 0)) - localDay(new Date(2026, 9, 31, 23)), 2);
  assert.equal(localDay(new Date(2027, 0, 1)) - localDay(new Date(2026, 11, 31)), 1);
  const spring = new Date(2026, 2, 8, 12);
  const springRows = [7, 8].map(d => ({ activityId: 'a', occurredAt: new Date(2026, 2, d, 12).toISOString() }));
  assert.equal(activityFrequency({ ...activity, createdAt: new Date(2026, 2, 1).toISOString() }, springRows, spring).days, 8);
});
test('unit hysteresis avoids flicker but changes units when needed', () => {
  assert.equal(approximateFrequency(1.12).unit, 'week');
  assert.equal(approximateFrequency(1.12, 'day').unit, 'day');
  assert.equal(approximateFrequency(1.2, 'day').unit, 'week');
  assert.equal(approximateFrequency(1.08, 'week').unit, 'week');
  assert.equal(approximateFrequency(1, 'week').unit, 'day');
});
test('tap guard is immediate, per activity, and permits unlimited deliberate repeats', () => {
  let time = 0;
  const accept = createTapGuard(600, () => time);
  assert.equal(accept('a'), true);
  assert.equal(accept('a'), false);
  assert.equal(accept('b'), true);
  time = 599; assert.equal(accept('a'), false);
  time = 600; assert.equal(accept('a'), true);
  for (let i = 0; i < 1000; i++) { time += 600; assert.equal(accept('a'), true); }
});
test('V2 backups round trip without losing repeated same-date records or metadata', () => {
  const state = { schema: 2, activities: [activity], logs: logs(3, 1), meta: { createdAt: daysAgo(60), readOnly: false } };
  const restored = parseBackup(JSON.parse(JSON.stringify(toBackup(state))));
  assert.deepEqual(restored.activities, state.activities);
  assert.deepEqual(restored.logs, state.logs);
  assert.equal(restored.meta.createdAt, state.meta.createdAt);
  assert.equal(restored.schema, 2);
  assert.equal(toBackup(restored).version, 2);
});
