// The `lp_marketplace_domains.language` column is raw free text scraped from
// ~22 different marketplace sources with no shared convention: full English
// names ("Spanish"), native names ("Español"), other-language names
// ("Espagnol", "Anglais"), bare ISO 639-1 codes ("es"), region-tagged codes
// ("pt-BR"), and outright country names bleeding in from the source data
// ("Spain", "France"). The Related Sites language filter sends a 2-letter
// code (see RS_FILTERS.language in app/dashboard/related-sites/page.tsx), so
// a naive `LOWER(lang) = LOWER(code)` SQL comparison only ever matches the
// small minority of rows that happen to already store a bare code — e.g. of
// ~93k Spanish-language rows, only ~8.5k literally store "es"/"ES".
//
// This maps the long tail of raw values down to a single canonical
// lowercase ISO 639-1 code so filtering and display are consistent. Deliberately
// applied in application code (not a DB migration) so the underlying scraped
// data is never touched — this is purely a read-path fix.
const LANGUAGE_ALIASES: Record<string, string> = {
  // English
  english: "en", en: "en", anglais: "en", englisch: "en", "en-us": "en", "en-gb": "en",
  "united states": "en", "united kingdom": "en", australia: "en", ireland: "en",
  "new zealand": "en", "south africa": "en", singapore: "en", india: "en",

  // Spanish
  spanish: "es", es: "es", espanol: "es", "español": "es", espagnol: "es",
  "spanish; castilian": "es", castilian: "es", spain: "es", mexico: "es",
  argentina: "es", colombia: "es", chile: "es", peru: "es", venezuela: "es",
  "costa rica": "es", "español (castellano)": "es",

  // Catalan
  "catalán": "ca", catalan: "ca", "catalan; valencian": "ca",

  // French
  french: "fr", fr: "fr", "français": "fr", francais: "fr", france: "fr",
  "french guiana": "fr", belgium: "fr",

  // German
  german: "de", de: "de", deutsch: "de", allemand: "de", germany: "de",
  austria: "de", switzerland: "de",

  // Italian
  italian: "it", it: "it", italiano: "it", italien: "it", italy: "it",

  // Portuguese
  portuguese: "pt", pt: "pt", "português": "pt", portugais: "pt", portugal: "pt",
  brazil: "pt", "portuguese (brazil)": "pt", "portuguese (portugal)": "pt",
  "pt-br": "pt", "pt-pt": "pt", "português (brasil)": "pt", portuguesse: "pt",

  // Dutch
  dutch: "nl", nl: "nl", nederlands: "nl", "néerlandais": "nl", netherlands: "nl",

  // Swedish
  swedish: "sv", sv: "sv", svenska: "sv", "suédois": "sv", sweden: "sv", sweedish: "sv",

  // Norwegian
  norwegian: "no", no: "no", nb: "no", nn: "no", "norvégien": "no", norway: "no",
  "norwegian bokmål": "no", "norwegian bokmal": "no", "norwegian (bokmål)": "no",
  "norwegian nynorsk": "no",

  // Danish
  danish: "da", da: "da", dansk: "da", danois: "da", denmark: "da", dk: "da",

  // Finnish
  finnish: "fi", fi: "fi", suomi: "fi", finnois: "fi", finlandais: "fi", finland: "fi", finn: "fi",

  // Polish
  polish: "pl", pl: "pl", polski: "pl", polonais: "pl", poland: "pl",

  // Lithuanian
  lithuanian: "lt", lt: "lt", lituanien: "lt", lithuania: "lt",

  // Latvian
  latvian: "lv", lv: "lv", letton: "lv",

  // Russian
  russian: "ru", ru: "ru", "русский": "ru", russe: "ru", russia: "ru",
  "russian federation": "ru",

  // Turkish
  turkish: "tr", tr: "tr", "türkçe": "tr", turkey: "tr", turc: "tr",

  // Arabic
  arabic: "ar", ar: "ar", arabe: "ar", "العربية": "ar", egypt: "ar",
  "saudi arabia": "ar", "united arab emirates": "ar", morocco: "ar", algeria: "ar",
  tunisia: "ar", iraq: "ar", bahrain: "ar", oman: "ar",

  // Hindi
  hindi: "hi", hi: "hi",

  // Japanese
  japanese: "ja", ja: "ja", japonais: "ja", jp: "ja", japan: "ja",

  // Chinese
  chinese: "zh", zh: "zh", cn: "zh", tw: "zh", china: "zh", taiwan: "zh",
  "chinese (simplified)": "zh", "chinese (traditional)": "zh",

  // Korean
  korean: "ko", ko: "ko", kr: "ko", "south korea": "ko", "korea, republic of": "ko",

  // Romanian
  romanian: "ro", ro: "ro", roumain: "ro", romania: "ro",

  // Czech
  czech: "cs", cs: "cs", cz: "cs", "tchèque": "cs", "czech republic": "cs", "češka": "cs",

  // Slovak
  slovak: "sk", sk: "sk", slovaque: "sk", slovakia: "sk",

  // Bulgarian
  bulgarian: "bg", bg: "bg", bulgare: "bg", bulgaria: "bg",

  // Greek
  greek: "el", el: "el", grec: "el", greece: "el", "modern greek (1453-)": "el",
  "greek, modern": "el",

  // Croatian
  croatian: "hr", hr: "hr", croate: "hr", croatia: "hr",

  // Serbian
  serbian: "sr", sr: "sr", serbe: "sr", serbia: "sr",

  // Bosnian
  bosnian: "bs", bs: "bs", bosniaque: "bs", "bosnia and herzegovina": "bs",

  // Slovenian
  slovenian: "sl", sl: "sl", slovene: "sl", "slovène": "sl", slovenia: "sl",

  // Ukrainian
  ukrainian: "uk", uk: "uk", ukrainien: "uk", ukraine: "uk",

  // Hungarian
  hungarian: "hu", hu: "hu", hongrois: "hu", hungary: "hu", magyar: "hu",

  // Estonian
  estonian: "et", et: "et", estonien: "et", estonia: "et",

  // Vietnamese
  vietnamese: "vi", vi: "vi", vietnamien: "vi", vietnam: "vi", "viet nam": "vi", vitenam: "vi",

  // Thai
  thai: "th", th: "th", "thaï": "th", thailand: "th",

  // Indonesian
  indonesian: "id", id: "id", "indonésien": "id", indonesia: "id", "bahasa indonesia": "id",

  // Malay
  malay: "ms", ms: "ms", malaysia: "ms", "malay (macrolanguage)": "ms",

  // Tagalog / Filipino
  tagalog: "tl", filipino: "tl", philippines: "tl",

  // Hebrew
  hebrew: "he", he: "he", israel: "he",

  // Persian
  persian: "fa", fa: "fa", iran: "fa", "persian/farsi": "fa",

  // Urdu
  urdu: "ur", ur: "ur", pakistan: "ur",

  // Bengali
  bengali: "bn", bn: "bn", bangla: "bn", bangladesh: "bn", "bengali; bangla": "bn",

  // Other South/Southeast Asian
  tamil: "ta", ta: "ta",
  telugu: "te", te: "te",
  marathi: "mr", mr: "mr",
  gujarati: "gu", gu: "gu",
  kannada: "kn", kn: "kn",
  malayalam: "ml", ml: "ml",
  sinhala: "si", si: "si",
  punjabi: "pa",
  khmer: "km", km: "km", cambodia: "km",
  burmese: "my", my: "my", "burmese (myanmar)": "my",

  // Swahili
  swahili: "sw", sw: "sw", swahilli: "sw", "swahili (macrolanguage)": "sw",
  kenya: "sw", tanzania: "sw",

  // Misc European
  afrikaans: "af", af: "af",
  basque: "eu", eu: "eu",
  galician: "gl", gl: "gl", gallego: "gl",
  icelandic: "is", is: "is",
  irish: "ga",
  welsh: "cy", cy: "cy",
  maltese: "mt", mt: "mt", malta: "mt",
  albanian: "sq", sq: "sq", albania: "sq",
  macedonian: "mk", mk: "mk",

  // Caucasus / Central Asia
  armenian: "hy", hy: "hy",
  georgian: "ka", ka: "ka",
  azerbaijani: "az", az: "az", azerbaijanian: "az", azerbaijan: "az",
  kazakh: "kk", kk: "kk",
  uzbek: "uz",
  mongolian: "mn",
  belarusian: "be", be: "be", belarus: "be",
  amharic: "am", am: "am", ethiopia: "am",
};

/**
 * Normalizes a raw scraped `language` value (full name, native name,
 * region-tagged code, country name, or bare code) down to a lowercase
 * ISO 639-1 code. For values listing several languages ("Spanish, English")
 * only the first (primary) one is considered. Returns null when the value
 * is missing or unrecognized (garbage like "Dofollow", "-", "None", or a
 * long-tail single-occurrence value) — callers should treat null as
 * "unknown" rather than guessing.
 */
export function normalizeLanguage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim().toLowerCase();
  if (!first) return null;
  if (LANGUAGE_ALIASES[first]) return LANGUAGE_ALIASES[first];
  // Bare, unrecognized 2-letter token: assume it's already a valid ISO code
  // (covers the long tail of real codes we didn't enumerate above, e.g. rare
  // languages) rather than silently dropping it.
  if (/^[a-z]{2}$/.test(first)) return first;
  return null;
}

// Mirrors the labels in RS_FILTERS.language (app/dashboard/related-sites/page.tsx)
// so a recognized code always displays the same friendly name a user picked
// from the filter dropdown, regardless of how messy the underlying raw value was.
const LANGUAGE_LABELS: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", nl: "Dutch", sv: "Swedish", no: "Norwegian", da: "Danish",
  fi: "Finnish", pl: "Polish", lt: "Lithuanian", ru: "Russian", tr: "Turkish",
  ar: "Arabic", hi: "Hindi", ja: "Japanese", zh: "Chinese", ko: "Korean",
};

/**
 * Best-effort display label for a result row's language: a clean name when
 * the code is recognized, otherwise the original raw value (trimmed) so we
 * never show a blank where the raw data at least had *something* — this
 * only affects wording, and preserves prior behavior when unrecognized.
 */
export function languageDisplayLabel(raw: string | null | undefined): string {
  const code = normalizeLanguage(raw);
  if (code && LANGUAGE_LABELS[code]) return LANGUAGE_LABELS[code];
  return raw?.trim() || "—";
}
