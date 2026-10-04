import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRecentSoldProperties } from '../../src/data/cms-content.ts';

const property = (id, updatedAt, listingStatus = 'sold') => ({ _id: id, _type: 'property', _updatedAt: updatedAt, listingStatus, title: id });

test('Home sold selection excludes non-sold properties, returns at most five, and follows newest edits', () => {
  const records = [
    property('active', '2026-10-04T10:00:00Z', 'active'),
    property('cancelled', '2026-10-04T11:00:00Z', 'expiredCancelled'),
    property('sold-1', '2026-10-04T01:00:00Z'), property('sold-2', '2026-10-04T02:00:00Z'),
    property('sold-3', '2026-10-04T03:00:00Z'), property('sold-4', '2026-10-04T04:00:00Z'),
    property('sold-5', '2026-10-04T05:00:00Z'), property('sold-6', '2026-10-04T06:00:00Z'),
  ];
  assert.deepEqual(selectRecentSoldProperties(records).map((record) => record._id), ['sold-6', 'sold-5', 'sold-4', 'sold-3', 'sold-2']);
});

test('a status or update edit changes the Home sold selection without legacy fallback identity', () => {
  const records = [property('older', '2026-10-03T00:00:00Z'), property('newly-sold', '2026-10-04T00:00:00Z', 'active')];
  assert.deepEqual(selectRecentSoldProperties(records).map((record) => record._id), ['older']);
  records[1].listingStatus = 'sold';
  assert.deepEqual(selectRecentSoldProperties(records).map((record) => record._id), ['newly-sold', 'older']);
});

test('equal update timestamps use _id as a stable deterministic tie-breaker', () => {
  const timestamp = '2026-10-04T00:00:00Z';
  assert.deepEqual(selectRecentSoldProperties([property('z', timestamp), property('a', timestamp), property('m', timestamp)]).map((record) => record._id), ['a', 'm', 'z']);
});
