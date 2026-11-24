import assert from "node:assert/strict";
import test from "node:test";
import { formatDateOnly, parseDateOnly } from "./date-only";

test("calendar date parsing rejects incomplete and impossible dates", () => {
  for (const value of ["", "11/30/2026", "2026-1-01", "2026-11", "2026-02-30", "2026-13-01", "2026-11-30T00:00:00Z"]) {
    assert.equal(parseDateOnly(value), undefined, value);
  }
  assert.equal(formatDateOnly(parseDateOnly("2028-02-29")!), "2028-02-29");
});

test("calendar dates round trip without shifting across timezones or daylight saving", () => {
  const previous = process.env.TZ;
  try {
    for (const timezone of ["America/New_York", "America/Los_Angeles", "Pacific/Auckland", "UTC"]) {
      process.env.TZ = timezone;
      for (const value of ["2026-11-30", "2026-03-08", "2026-11-01", "2027-01-01"]) {
        const date = parseDateOnly(value)!;
        assert.equal(formatDateOnly(date), value, `${timezone}: ${value}`);
        assert.equal(date.getDate(), Number(value.slice(-2)));
      }
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
