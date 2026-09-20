import { describe, expect, it } from "vitest";
import { sanitizeLocation } from "./index";

describe("sanitizeLocation", () => {
  it("drops credentials and redirects from auth URLs", () => {
    expect(sanitizeLocation("https://linkpricer.com/reset-password?mode=resetPassword&oobCode=SECRET&apiKey=x")).toBe(
      "https://linkpricer.com/reset-password",
    );
    expect(sanitizeLocation("https://linkpricer.com/login?redirect=%2Fdashboard%2Fsearch%3Fdomain%3Da.com")).toBe(
      "https://linkpricer.com/login",
    );
  });

  it("keeps campaign attribution, case-insensitively, and drops the hash", () => {
    expect(sanitizeLocation("https://linkpricer.com/?UTM_source=news&gclid=abc&email=a@b.com#top")).toBe(
      "https://linkpricer.com/?UTM_source=news&gclid=abc",
    );
  });

  it("drops unknown params by default", () => {
    expect(sanitizeLocation("https://linkpricer.com/dashboard/search?domain=example.com")).toBe(
      "https://linkpricer.com/dashboard/search",
    );
  });
});
