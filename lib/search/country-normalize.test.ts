import { describe, expect, it } from "vitest";
import { countryMatchRules, countryValueMatches } from "@/lib/search/country-normalize";

describe("countryValueMatches", () => {
  it("matches every stored spelling of a country", () => {
    for (const v of ["United States", "United states", "USA", "United States of America (the)", "U.S.A."]) {
      expect(countryValueMatches(v, "US"), v).toBe(true);
    }
    for (const v of ["United Kingdom", "UK", "England", "United Kingdom of Great Britain and Northern Ireland (the)"]) {
      expect(countryValueMatches(v, "GB"), v).toBe(true);
    }
    expect(countryValueMatches("Netherlands (the)", "NL")).toBe(true);
  });

  // Each of these matched the wrong country while matching was a bare prefix.
  it.each([
    ["Ukraine", "GB"],
    ["Nigeria", "NE"],
    ["Dominican Republic", "DM"],
    ["Guinea-Bissau", "GN"],
    ["Congo (Brazzaville)", "CD"],
    ["American Samoa", "US"],
    ["United States Virgin Islands", "US"],
    ["United Kingdom Overseas Territories", "GB"],
  ])("does not match %s as %s", (stored, code) => {
    expect(countryValueMatches(stored, code)).toBe(false);
  });

  it("still matches the shorter country itself", () => {
    expect(countryValueMatches("Ukraine", "UA")).toBe(true);
    expect(countryValueMatches("Niger", "NE")).toBe(true);
    expect(countryValueMatches("Nigeria", "NG")).toBe(true);
    expect(countryValueMatches("Dominica", "DM")).toBe(true);
    expect(countryValueMatches("Guinea", "GN")).toBe(true);
    expect(countryValueMatches("Guinea-Bissau", "GW")).toBe(true);
  });

  it("no code's names collide with another's once excludes apply", () => {
    const codes = ["US", "GB", "UA", "NE", "NG", "DM", "DO", "GN", "GW", "CD", "CG", "KR", "KP", "AE", "IE", "NL", "DE"];
    for (const a of codes) {
      for (const b of codes) {
        if (a === b) continue;
        for (const name of countryMatchRules(b)!.prefixes) {
          // A name that is literally shared (e.g. "congo") is ambiguous data, not a collision.
          if (countryMatchRules(a)!.prefixes.includes(name)) continue;
          expect(countryValueMatches(name, a), `${b} name "${name}" matched ${a}`).toBe(false);
        }
      }
    }
  });
});
