import { describe, expect, it } from "vitest";
import { getLastNepalCalendarDays, getNepalDateKey, inclusiveNepalRangeToIso, startOfNepalDayIso } from "./nepalTime";

describe("Nepal calendar helpers", () => {
  it("converts Nepal midnight to the correct ISO instant", () => {
    expect(startOfNepalDayIso("2026-07-01")).toBe("2026-06-30T18:15:00.000Z");
  });

  it("uses the day after the visible end as the exclusive to boundary", () => {
    expect(inclusiveNepalRangeToIso("2026-07-01", "2026-07-19")).toEqual({ from: "2026-06-30T18:15:00.000Z", to: "2026-07-19T18:15:00.000Z" });
  });

  it("rejects invalid or reversed ranges", () => {
    expect(inclusiveNepalRangeToIso("2026-02-30", "2026-03-02")).toBeNull();
    expect(inclusiveNepalRangeToIso("2026-07-20", "2026-07-19")).toBeNull();
  });

  it("builds a 30-day Nepal range across UTC date boundaries", () => {
    const now = new Date("2026-07-18T19:00:00.000Z");
    expect(getNepalDateKey(now)).toBe("2026-07-19");
    expect(getLastNepalCalendarDays(30, now)).toEqual({ from: "2026-06-20", to: "2026-07-19" });
  });
});