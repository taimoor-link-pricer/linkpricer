// Filter/sort option lists for the "Related Sites" demo, ported from
// v1-interactive/home-demo.jsx.

import type { RelatedSearchFilters } from "@/lib/design-v1/related-data";
import type { SortState } from "@/lib/design-v1/types";

export interface FilterOption {
  id: string;
  label: string;
}

export const RS_FILTERS: Record<"country" | "language" | "traffic" | "dr" | "price" | "grade", FilterOption[]> = {
  country: [
    { id: "any", label: "All countries" }, { id: "US", label: "United States" }, { id: "GB", label: "United Kingdom" },
    { id: "CA", label: "Canada" }, { id: "AU", label: "Australia" }, { id: "IE", label: "Ireland" }, { id: "DE", label: "Germany" },
    { id: "FR", label: "France" }, { id: "ES", label: "Spain" }, { id: "IT", label: "Italy" }, { id: "PT", label: "Portugal" },
    { id: "NL", label: "Netherlands" }, { id: "BE", label: "Belgium" }, { id: "CH", label: "Switzerland" }, { id: "AT", label: "Austria" },
    { id: "SE", label: "Sweden" }, { id: "NO", label: "Norway" }, { id: "DK", label: "Denmark" }, { id: "FI", label: "Finland" },
    { id: "PL", label: "Poland" }, { id: "LT", label: "Lithuania" }, { id: "BR", label: "Brazil" }, { id: "MX", label: "Mexico" },
    { id: "IN", label: "India" }, { id: "JP", label: "Japan" }, { id: "CN", label: "China" }, { id: "KR", label: "South Korea" },
    { id: "SG", label: "Singapore" }, { id: "AE", label: "United Arab Emirates" }, { id: "ZA", label: "South Africa" }, { id: "NZ", label: "New Zealand" },
  ],
  language: [
    { id: "any", label: "All languages" }, { id: "EN", label: "English" }, { id: "ES", label: "Spanish" }, { id: "FR", label: "French" },
    { id: "DE", label: "German" }, { id: "IT", label: "Italian" }, { id: "PT", label: "Portuguese" }, { id: "NL", label: "Dutch" },
    { id: "SV", label: "Swedish" }, { id: "NO", label: "Norwegian" }, { id: "DA", label: "Danish" }, { id: "FI", label: "Finnish" },
    { id: "PL", label: "Polish" }, { id: "LT", label: "Lithuanian" }, { id: "RU", label: "Russian" }, { id: "TR", label: "Turkish" },
    { id: "AR", label: "Arabic" }, { id: "HI", label: "Hindi" }, { id: "JA", label: "Japanese" }, { id: "ZH", label: "Chinese" }, { id: "KO", label: "Korean" },
  ],
  traffic: [
    { id: "any", label: "Any traffic" }, { id: "10000", label: "10K+" }, { id: "100000", label: "100K+" }, { id: "1000000", label: "1M+" },
  ],
  dr: [
    { id: "any", label: "Any DR" }, { id: "30", label: "DR 30+" }, { id: "50", label: "DR 50+" }, { id: "70", label: "DR 70+" }, { id: "90", label: "DR 90+" },
  ],
  price: [
    { id: "any", label: "Any price" }, { id: "lt300", label: "Under $300" }, { id: "300-700", label: "$300 – $700" },
    { id: "700-1200", label: "$700 – $1,200" }, { id: "gt1200", label: "$1,200+" },
  ],
  grade: [
    { id: "any", label: "Any grade" }, { id: "A+", label: "A+ only" }, { id: "A", label: "A & above" }, { id: "B+", label: "B+ & above" },
  ],
};

export const RS_PRICE_MAP: Record<string, Partial<RelatedSearchFilters>> = {
  any: {}, lt300: { priceMax: 300 }, "300-700": { priceMin: 300, priceMax: 700 },
  "700-1200": { priceMin: 700, priceMax: 1200 }, gt1200: { priceMin: 1200 },
};

export const RS_SORTS: { id: string; label: string; sort: SortState }[] = [
  { id: "match", label: "Best match", sort: { key: "match", dir: "desc" } },
  { id: "dr", label: "Highest DR", sort: { key: "dr", dir: "desc" } },
  { id: "traffic", label: "Most traffic", sort: { key: "traffic", dir: "desc" } },
  { id: "bestPrice", label: "Lowest price", sort: { key: "bestPrice", dir: "asc" } },
];

export interface RSFilterValues {
  country: string;
  language: string;
  traffic: string;
  dr: string;
  price: string;
  grade: string;
}

export const RS_DEFAULTS: RSFilterValues = { country: "any", language: "any", traffic: "any", dr: "any", price: "any", grade: "any" };
