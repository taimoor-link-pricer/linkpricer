import { describe, expect, it } from "vitest";
import {
  countryCode,
  countryMatchRules,
  countryName,
  countryValueMatches,
  nationalTldsOf,
  publishedCountry,
  tldCountry,
} from "@/lib/search/country-normalize";

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

describe("countryCode", () => {
  // Every one of these is a stored spelling that matched no country filter.
  it.each([
    ["US", "US"], ["DK", "DK"], ["nl", "NL"], ["États-Unis", "US"], ["Danemark", "DK"],
    ["Royaume-Uni", "GB"], ["Allemagne", "DE"], ["Russian Federation", "RU"],
    ["Russian Federation (the)", "RU"], ["Türkiye", "TR"], ["Viet Nam", "VN"],
    ["Republic of Korea", "KR"], ["Bosnia & Herzegovina", "BA"], ["Cote D'Ivoire", "CI"],
    ["Émirats arabes unis", "AE"], ["Corée du Sud", "KR"],
  ])("reads %s as %s, and the filter finds it there", (stored, code) => {
    expect(countryCode(stored)).toBe(code);
    expect(countryValueMatches(stored, code)).toBe(true);
  });

  it("reads the spellings of one country as one code", () => {
    for (const v of ["United States", "United states", "USA", "US", "United States of America (the)", "États-Unis"]) {
      expect(countryCode(v), v).toBe("US");
    }
    expect(countryName("US")).toBe("United States");
  });

  it("names no country for a placeholder or a spelling it does not know", () => {
    for (const v of ["-", "", "- - Select --", "23817892-0d32-4771-9059-304337e96ac4", "European Union", null]) {
      expect(countryCode(v), String(v)).toBeNull();
    }
  });

  it("keeps the longer name's country", () => {
    expect(countryCode("Ukraine")).toBe("UA");
    expect(countryCode("Guinea-Bissau")).toBe("GW");
    expect(countryCode("Nigeria")).toBe("NG");
  });
});

describe("publishedCountry — no country the site's own domain contradicts", () => {
  it("drops a stored country that a national ending contradicts", () => {
    expect(publishedCountry("kurier.at", "Germany")).toBeNull();
    expect(publishedCountry("lentanews.kyiv.ua", "United States")).toBeNull();
    expect(publishedCountry("libero.it", "United Kingdom")).toBeNull();
  });

  it("keeps one the ending agrees with, and any on a generic ending", () => {
    expect(publishedCountry("kurier.at", "Austria")).toBe("AT");
    expect(publishedCountry("bbc.co.uk", "UK")).toBe("GB");
    expect(publishedCountry("bitcoin.com", "Germany")).toBe("DE");
    expect(publishedCountry("example.io", "India")).toBe("IN");
  });

  it("reads national endings only", () => {
    expect(tldCountry("x.co.uk")).toBe("GB");
    expect(tldCountry("x.com")).toBeNull();
    expect(tldCountry("x.tv")).toBeNull();
    expect(nationalTldsOf("GB")).toEqual(["uk"]);
  });
});
