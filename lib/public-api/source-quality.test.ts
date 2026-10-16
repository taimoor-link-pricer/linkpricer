import { describe, it, expect } from "vitest";
import { isPlatformHost } from "@/lib/public-api/source-quality";
import { PLATFORM_DOMAINS } from "@/lib/public-api/platform-hosts";

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

  // The hosts a DR-sorted search opened with before they were listed.
  it("matches the hosting, document, profile and builder pages found in the catalogue", () => {
    for (const host of [
      "s3.amazonaws.com",
      "storage.googleapis.com",
      "archive.org",
      "jotform.com",
      "form.jotform.com",
      "sway.cloud.microsoft",
      "podcasts.apple.com",
      "administratoraccount.squarespace.com",
      "balink.bigcartel.com",
      "colab.research.google.com",
      "ledverlichting.jouwweb.nl",
      "agat.spb.ru",
      "fishingblog.co.ua",
      "weltinsider.com.de",
      "houzz.co.uk",
      "forsale.godaddy.com",
      "neena0611.blog.fc2.com",
    ]) {
      expect(isPlatformHost(host), host).toBe(true);
    }
  });

  it("matches university and government hosts on every country form", () => {
    for (const host of [
      "harvard.edu",
      "tagteam.harvard.edu",
      "canvas.curtin.edu.au",
      "open.ac.uk",
      "nh.gov",
      "gesund.bund.gov.de",
      "legifrance.gouv.fr",
      "commission.europa.eu",
    ]) {
      expect(isPlatformHost(host), host).toBe(true);
    }
  });

  it("does not match ordinary sites that merely end in the same letters", () => {
    for (const host of [
      "box.com",
      "myreddit.com",
      "notlinkedin.com",
      "techcrunch.com",
      "bbc.co.uk",
      "blogspotter.com",
      "mediumrare.com",
      "fruit.com",
      "telegraph.co.uk",
      "myedu.com",
      "govtech.com",
      "notgoogle.com",
      "freefr.com",
    ]) {
      expect(isPlatformHost(host), host).toBe(false);
    }
  });

  // Big publishers sit next to platforms on the same parent domains; only the
  // platform part is listed.
  it("keeps real publications, including sections of a platform's parent domain", () => {
    for (const host of [
      "apple.com",
      "finance.yahoo.com",
      "nytimes.com",
      "news.sky.com",
      "tecnologia.libero.it",
      "krakow.naszemiasto.pl",
      "economictimes.indiatimes.com",
      "godaddy.com",
    ]) {
      expect(isPlatformHost(host), host).toBe(false);
    }
  });
});

describe("PLATFORM_DOMAINS", () => {
  it("holds lower-case bare hosts, each once", () => {
    for (const d of PLATFORM_DOMAINS) expect(d, d).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
    expect(new Set(PLATFORM_DOMAINS).size).toBe(PLATFORM_DOMAINS.length);
  });

  it("has no entry already covered by another one", () => {
    // "blog.example.com" is redundant once "example.com" is listed, and any
    // entry is redundant under a family (an .edu name, a blogspot domain).
    const parents = (d: string) => d.split(".").slice(1).map((_, i, labels) => labels.slice(i).join("."));
    const set = new Set(PLATFORM_DOMAINS);
    const covered = PLATFORM_DOMAINS.filter((d) => parents(d).some((p) => set.has(p) || isPlatformHost(p)));
    expect(covered).toEqual([]);
  });
});
