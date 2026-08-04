import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatTimeAgo, formatDate } from "./utils";

describe("formatTimeAgo", () => {
  const mockNow = new Date("2024-01-15T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'ahora' for time differences less than 1 minute", () => {
    expect(formatTimeAgo(mockNow)).toBe("ahora");
    expect(formatTimeAgo(mockNow - 59999)).toBe("ahora");
  });

  it("returns minutes for time differences between 1 and 59 minutes", () => {
    // Exactly 1 minute
    expect(formatTimeAgo(mockNow - 60000)).toBe("hace 1m");
    // Just under 60 minutes
    expect(formatTimeAgo(mockNow - (60 * 60000 - 1))).toBe("hace 59m");
  });

  it("returns hours for time differences between 1 and 23 hours", () => {
    // Exactly 60 minutes (1 hour)
    expect(formatTimeAgo(mockNow - 60 * 60000)).toBe("hace 1h");
    // Just under 24 hours
    expect(formatTimeAgo(mockNow - (24 * 3600000 - 1))).toBe("hace 23h");
  });

  it("returns days for time differences between 1 and 6 days", () => {
    // Exactly 24 hours (1 day)
    expect(formatTimeAgo(mockNow - 24 * 3600000)).toBe("hace 1d");
    // Just under 7 days
    expect(formatTimeAgo(mockNow - (7 * 86400000 - 1))).toBe("hace 6d");
  });

  it("returns formatted date for time differences 7 days or more", () => {
    // Exactly 7 days
    const sevenDaysAgo = mockNow - 7 * 86400000;
    expect(formatTimeAgo(sevenDaysAgo)).toBe(formatDate(sevenDaysAgo));

    // More than 7 days
    const thirtyDaysAgo = mockNow - 30 * 86400000;
    expect(formatTimeAgo(thirtyDaysAgo)).toBe(formatDate(thirtyDaysAgo));
  });
});
