import { describe, it, expect } from "vitest";
import { isPlatformHost } from "@/lib/public-api/source-quality";

describe("isPlatformHost", () => {
  it("matches platforms and every subdomain of them", () => {
    for (const host of [
      "motherhood-moment.blogspot.com",
      "example.blogspot.co.uk",
      "example.blogspot.de",
      "someone.wordpress.com",
      "reddit.com",
      "uk.linkedin.com",
      "x.com",
      "user.github.io",
      "Quora.com",
      "discountcode.uk.com",
      "globleanswer.it.com",
    ]) {
      expect(isPlatformHost(host), host).toBe(true);
    }
  });

  it("does not match ordinary sites that merely end in the same letters", () => {
    for (const host of ["box.com", "myreddit.com", "notlinkedin.com", "techcrunch.com", "bbc.co.uk", "blogspotter.com", "mediumrare.com", "fruit.com", "telegraph.co.uk"]) {
      expect(isPlatformHost(host), host).toBe(false);
    }
  });
});
