import { describe, expect, it } from "vitest";
import { applyCurrencyMarkup } from "../worker/pricing";

describe("currency-specific order markup", () => {
  it("leaves USD micro charges unchanged at zero markup", () => {
    expect(applyCurrencyMarkup(123456, 0)).toBe(123456);
  });
  it("rounds fractional micro-units upward so markup cannot undercharge", () => {
    expect(applyCurrencyMarkup(10001, 10)).toBe(11002);
  });
  it("clamps invalid and excessive markup values", () => {
    expect(applyCurrencyMarkup(100, Number.NaN)).toBe(100);
    expect(applyCurrencyMarkup(100, 900)).toBe(600);
  });
});
