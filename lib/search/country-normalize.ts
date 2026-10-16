// Maps the ISO-2 country code the filter dropdown emits onto the free-text
// country names actually stored in domains.country_main_traffic.
//
// The filter sent "US" and the column holds "United States" (52,561 rows),
// "United states" (2,550), "USA" (885) and "United States of America (the)"
// (752), so an equality comparison matched almost nothing — the Country
// filter returned zero results for topics with plenty of US inventory, while
// the same search unfiltered worked fine. This is the same class of problem
// the language column already works around (see language-normalize.ts): the
// data is scraped free text, and the filter is a clean code.
//
// Matching is by normalized prefix rather than equality, so
// "united states of america (the)" is caught by "united states", plus an
// alias table for names that share no prefix with the canonical form.
const CODE_TO_NAME: Record<string, string> = {
  AF: "Afghanistan",
  AL: "Albania",
  DZ: "Algeria",
  AD: "Andorra",
  AO: "Angola",
  AG: "Antigua and Barbuda",
  AR: "Argentina",
  AM: "Armenia",
  AU: "Australia",
  AT: "Austria",
  AZ: "Azerbaijan",
  BS: "Bahamas",
  BH: "Bahrain",
  BD: "Bangladesh",
  BB: "Barbados",
  BY: "Belarus",
  BE: "Belgium",
  BZ: "Belize",
  BJ: "Benin",
  BT: "Bhutan",
  BO: "Bolivia",
  BA: "Bosnia and Herzegovina",
  BW: "Botswana",
  BR: "Brazil",
  BN: "Brunei",
  BG: "Bulgaria",
  BF: "Burkina Faso",
  BI: "Burundi",
  CV: "Cabo Verde",
  KH: "Cambodia",
  CM: "Cameroon",
  CA: "Canada",
  CF: "Central African Republic",
  TD: "Chad",
  CL: "Chile",
  CN: "China",
  CO: "Colombia",
  KM: "Comoros",
  CG: "Congo (Brazzaville)",
  CD: "Congo (DRC)",
  CR: "Costa Rica",
  CI: "Côte d'Ivoire",
  HR: "Croatia",
  CU: "Cuba",
  CY: "Cyprus",
  CZ: "Czechia",
  DK: "Denmark",
  DJ: "Djibouti",
  DM: "Dominica",
  DO: "Dominican Republic",
  EC: "Ecuador",
  EG: "Egypt",
  SV: "El Salvador",
  GQ: "Equatorial Guinea",
  ER: "Eritrea",
  EE: "Estonia",
  SZ: "Eswatini",
  ET: "Ethiopia",
  FJ: "Fiji",
  FI: "Finland",
  FR: "France",
  GA: "Gabon",
  GM: "Gambia",
  GE: "Georgia",
  DE: "Germany",
  GH: "Ghana",
  GR: "Greece",
  GD: "Grenada",
  GT: "Guatemala",
  GN: "Guinea",
  GW: "Guinea-Bissau",
  GY: "Guyana",
  HT: "Haiti",
  HN: "Honduras",
  HK: "Hong Kong",
  HU: "Hungary",
  IS: "Iceland",
  IN: "India",
  ID: "Indonesia",
  IR: "Iran",
  IQ: "Iraq",
  IE: "Ireland",
  IL: "Israel",
  IT: "Italy",
  JM: "Jamaica",
  JP: "Japan",
  JO: "Jordan",
  KZ: "Kazakhstan",
  KE: "Kenya",
  KI: "Kiribati",
  XK: "Kosovo",
  KW: "Kuwait",
  KG: "Kyrgyzstan",
  LA: "Laos",
  LV: "Latvia",
  LB: "Lebanon",
  LS: "Lesotho",
  LR: "Liberia",
  LY: "Libya",
  LI: "Liechtenstein",
  LT: "Lithuania",
  LU: "Luxembourg",
  MO: "Macao",
  MG: "Madagascar",
  MW: "Malawi",
  MY: "Malaysia",
  MV: "Maldives",
  ML: "Mali",
  MT: "Malta",
  MH: "Marshall Islands",
  MR: "Mauritania",
  MU: "Mauritius",
  MX: "Mexico",
  FM: "Micronesia",
  MD: "Moldova",
  MC: "Monaco",
  MN: "Mongolia",
  ME: "Montenegro",
  MA: "Morocco",
  MZ: "Mozambique",
  MM: "Myanmar",
  NA: "Namibia",
  NR: "Nauru",
  NP: "Nepal",
  NL: "Netherlands",
  NZ: "New Zealand",
  NI: "Nicaragua",
  NE: "Niger",
  NG: "Nigeria",
  KP: "North Korea",
  MK: "North Macedonia",
  NO: "Norway",
  OM: "Oman",
  PK: "Pakistan",
  PW: "Palau",
  PS: "Palestine",
  PA: "Panama",
  PG: "Papua New Guinea",
  PY: "Paraguay",
  PE: "Peru",
  PH: "Philippines",
  PL: "Poland",
  PT: "Portugal",
  QA: "Qatar",
  RO: "Romania",
  RU: "Russia",
  RW: "Rwanda",
  KN: "Saint Kitts and Nevis",
  LC: "Saint Lucia",
  VC: "Saint Vincent and the Grenadines",
  WS: "Samoa",
  SM: "San Marino",
  ST: "Sao Tome and Principe",
  SA: "Saudi Arabia",
  SN: "Senegal",
  RS: "Serbia",
  SC: "Seychelles",
  SL: "Sierra Leone",
  SG: "Singapore",
  SK: "Slovakia",
  SI: "Slovenia",
  SB: "Solomon Islands",
  SO: "Somalia",
  ZA: "South Africa",
  KR: "South Korea",
  SS: "South Sudan",
  ES: "Spain",
  LK: "Sri Lanka",
  SD: "Sudan",
  SR: "Suriname",
  SE: "Sweden",
  CH: "Switzerland",
  SY: "Syria",
  TW: "Taiwan",
  TJ: "Tajikistan",
  TZ: "Tanzania",
  TH: "Thailand",
  TL: "Timor-Leste",
  TG: "Togo",
  TO: "Tonga",
  TT: "Trinidad and Tobago",
  TN: "Tunisia",
  TR: "Turkey",
  TM: "Turkmenistan",
  TV: "Tuvalu",
  UG: "Uganda",
  UA: "Ukraine",
  AE: "United Arab Emirates",
  GB: "United Kingdom",
  US: "United States",
  UY: "Uruguay",
  UZ: "Uzbekistan",
  VU: "Vanuatu",
  VA: "Vatican City",
  VE: "Venezuela",
  VN: "Vietnam",
  YE: "Yemen",
  ZM: "Zambia",
  ZW: "Zimbabwe"
};

// Stored spellings that do not begin with the canonical name.
const ALIASES: Record<string, string[]> = {
  US: ["usa", "u.s.", "u.s.a.", "america"],
  GB: ["uk", "u.k.", "great britain", "england", "scotland", "wales", "northern ireland"],
  AE: ["uae", "u.a.e."],
  KR: ["south korea", "korea", "republic of korea"],
  KP: ["north korea"],
  // "russia" does not reach "russian federation" as a whole word: 10,135
  // sites stored that way never matched RU.
  RU: ["russia", "russian federation"],
  CZ: ["czechia", "czech republic"],
  VN: ["vietnam", "viet nam"],
  LA: ["laos", "lao"],
  BA: ["bosnia"],
  CI: ["cote d'ivoire", "ivory coast"],
  CV: ["cape verde"],
  TT: ["trinidad"],
  PS: ["palestinian territory"],
  SY: ["syria"],
  IR: ["iran"],
  BO: ["bolivia"],
  TZ: ["tanzania"],
  VE: ["venezuela"],
  MD: ["moldova"],
  MK: ["macedonia", "northern macedonia"],
  CD: ["congo", "drc"],
  NL: ["holland", "the netherlands"],
  TR: ["turkiye"],
};

/**
 * Stored spellings in other languages. One source writes French names
 * ("États-Unis" 3,318 rows, "Danemark" 2,988, "Royaume-Uni" 2,041 in Oct
 * 2026), which no English prefix reaches, so those sites never matched a
 * country filter. Written as stored; normalize() reduces them the same way
 * the SQL twin reduces the column (accented letters become spaces).
 */
const FOREIGN_NAMES: Record<string, string[]> = {
  AE: ["Émirats arabes unis"], AL: ["Albanie"], AR: ["Argentine"], AT: ["Autriche"], AU: ["Australie"],
  BE: ["Belgique"], BG: ["Bulgarie"], BO: ["Bolivie"], BR: ["Brésil"], CH: ["Suisse"], CN: ["Chine"],
  CO: ["Colombie"], CY: ["Chypre"], CZ: ["Tchéquie", "République tchèque"], DE: ["Allemagne"],
  DK: ["Danemark"], DZ: ["Algérie"], EC: ["Équateur"], EE: ["Estonie"], EG: ["Égypte"], ES: ["Espagne"],
  FI: ["Finlande"], GB: ["Royaume-Uni"], GR: ["Grèce"], HR: ["Croatie"], HU: ["Hongrie"],
  ID: ["Indonésie"], IE: ["Irlande"], IL: ["Israël"], IN: ["Inde"], IS: ["Islande"], IT: ["Italie"],
  JP: ["Japon"], KR: ["Corée du Sud"], LT: ["Lituanie"], LV: ["Lettonie"], MA: ["Maroc"], MN: ["Mongolie"],
  MT: ["Malte"], MX: ["Mexique"], MY: ["Malaisie"], NL: ["Pays-Bas"], NO: ["Norvège"],
  NZ: ["Nouvelle-Zélande"], PE: ["Pérou"], PL: ["Pologne"], RO: ["Roumanie"], RS: ["Serbie"],
  RU: ["Russie"], SA: ["Arabie saoudite"], SE: ["Suède"], SG: ["Singapour"], SI: ["Slovénie"],
  SK: ["Slovaquie"], TH: ["Thaïlande"], TN: ["Tunisie"], TR: ["Turquie", "Türkiye"], TW: ["Taïwan"],
  UG: ["Ouganda"], US: ["États-Unis"], VN: ["Viêt Nam"], ZA: ["Afrique du Sud"],
};

/**
 * Every spelling a stored value may start with, besides the canonical name:
 * the aliases, the foreign names, and the bare ISO code — several sources
 * store "DK", "US" or "NL" (5,646, 4,001 and 3,908 rows), and those never
 * matched either.
 */
function aliasesOf(code: string): string[] {
  return [code.toLowerCase(), ...(ALIASES[code] ?? []), ...(FOREIGN_NAMES[code] ?? [])];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(the\)|\bthe\b/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lowercase prefixes that a stored country value may start with to count as
 * the given ISO-2 code. Returns null for an unknown code so callers can skip
 * filtering rather than silently matching nothing — the failure mode this
 * whole module exists to prevent.
 */
export function countryMatchPrefixes(isoCode: string): string[] | null {
  const code = isoCode.trim().toUpperCase();
  const canonical = CODE_TO_NAME[code];
  if (!canonical) return null;
  return [...new Set([normalize(canonical), ...aliasesOf(code).map(normalize)].filter(Boolean))];
}

/**
 * Whether a normalized value starts with `prefix` as whole words: equal to
 * it, or followed by a space. A bare string prefix let "uk" match "ukraine"
 * (5,501 Ukrainian sites in every UK search), "niger" match "nigeria" and
 * "dominica" match "dominican republic".
 */
function startsWithWords(value: string, prefix: string): boolean {
  return value === prefix || value.startsWith(prefix + " ");
}

/**
 * Stored names that start with one country's name as whole words but belong
 * to another country, and are not in CODE_TO_NAME/ALIASES to be derived.
 */
const EXTRA_EXCLUDES: Record<string, string[]> = {
  US: ["united states virgin islands", "united states minor outlying islands"],
  GB: ["united kingdom overseas territories"],
  KR: ["korea democratic"],
};

/**
 * How a stored country value is matched against an ISO-2 code: it must
 * start with one of `prefixes` as whole words, and with none of `excludes`.
 *
 * `excludes` are the other countries' names that begin with one of this
 * country's — "guinea bissau" for GN, "congo brazzaville" for CD — so the
 * longer, more specific name wins. Derived from the tables above rather than
 * listed by hand, so a new alias cannot reintroduce a collision unnoticed.
 * Returns null for an unknown code, as countryMatchPrefixes does.
 */
const rulesCache = new Map<string, { prefixes: string[]; excludes: string[] } | null>();

export function countryMatchRules(isoCode: string): { prefixes: string[]; excludes: string[] } | null {
  const code = isoCode.trim().toUpperCase();
  // Pure in the tables above, and costly: every other country's names are
  // compared against this one's.
  if (rulesCache.has(code)) return rulesCache.get(code)!;
  const rules = buildMatchRules(code);
  rulesCache.set(code, rules);
  return rules;
}

function buildMatchRules(code: string): { prefixes: string[]; excludes: string[] } | null {
  const prefixes = countryMatchPrefixes(code);
  if (!prefixes) return null;
  const excludes = new Set((EXTRA_EXCLUDES[code] ?? []).map(normalize));
  for (const other of Object.keys(CODE_TO_NAME)) {
    if (other === code) continue;
    for (const name of countryMatchPrefixes(other) ?? []) {
      if (prefixes.some((p) => name !== p && startsWithWords(name, p))) excludes.add(name);
    }
  }
  return { prefixes, excludes: [...excludes] };
}

/** Whether a stored country value (raw, as scraped) is the given ISO-2 code. */
export function countryValueMatches(stored: string | null | undefined, isoCode: string): boolean {
  const rules = countryMatchRules(isoCode);
  if (!rules || !stored) return false;
  const v = normalize(stored);
  return rules.prefixes.some((p) => startsWithWords(v, p)) && !rules.excludes.some((e) => startsWithWords(v, e));
}

const codeCache = new Map<string, string | null>();

/**
 * The ISO-2 code a stored country value names, or null when it names none —
 * the scrapers' "-" placeholder, or a spelling no table here covers. The
 * exact inverse of countryValueMatches, so the country a result reports is
 * always the one a country filter would find it under.
 */
export function countryCode(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const key = normalize(stored);
  if (codeCache.has(key)) return codeCache.get(key)!;
  const code = Object.keys(CODE_TO_NAME).find((c) => countryValueMatches(stored, c)) ?? null;
  codeCache.set(key, code);
  return code;
}

/** The English name of an ISO-2 code, as CODE_TO_NAME spells it. */
export function countryName(isoCode: string): string | null {
  return CODE_TO_NAME[isoCode.toUpperCase()] ?? null;
}
