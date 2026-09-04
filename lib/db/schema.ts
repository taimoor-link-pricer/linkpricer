import { pgTable, index, foreignKey, varchar, text, integer, timestamp, unique, boolean, jsonb, uniqueIndex, bigint, numeric, char, bigserial, date, vector, uuid, check, pgPolicy, primaryKey, pgView, doublePrecision } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	stripeEventId: text("stripe_event_id").notNull(),
	eventType: text("event_type"),
	processedAt: timestamp("processed_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("stripe_webhook_events_stripe_event_id_unique").on(table.stripeEventId),
]);

export const apiRequestLogs = pgTable("api_request_logs", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	apiKeyId: varchar("api_key_id").notNull(),
	userId: varchar("user_id").notNull(),
	domain: text().notNull(),
	httpStatus: integer("http_status").notNull(),
	latencyMs: integer("latency_ms"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("api_request_logs_api_key_id_idx").using("btree", table.apiKeyId.asc().nullsLast().op("text_ops")),
	index("api_request_logs_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("api_request_logs_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	// Added in migration 0006 — the index GET /api/developers/me's monthly
	// usage count actually uses. Declared so db:push cannot drop it.
	index("api_request_logs_key_created_idx").using("btree", table.apiKeyId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.apiKeyId],
			foreignColumns: [apiKeys.id],
			name: "api_request_logs_api_key_id_api_keys_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "api_request_logs_user_id_users_id_fk"
		}),
]);

export const magicLinkTokens = pgTable("magic_link_tokens", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	email: varchar().notNull(),
	token: varchar().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("magic_link_tokens_token_unique").on(table.token),
]);

export const gdprDeletionRequests = pgTable("gdpr_deletion_requests", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	status: varchar().default('pending').notNull(),
	reason: text(),
	verificationToken: varchar("verification_token"),
	verifiedAt: timestamp("verified_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("gdpr_deletion_requests_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "gdpr_deletion_requests_user_id_users_id_fk"
		}),
]);

export const marketplaceApiConfigs = pgTable("marketplace_api_configs", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	marketplaceName: text("marketplace_name").notNull(),
	enabled: boolean().default(true).notNull(),
	apiType: text("api_type").notNull(),
	baseUrl: text("base_url").notNull(),
	authType: text("auth_type").notNull(),
	authConfig: jsonb("auth_config"),
	maxConcurrentRequests: integer("max_concurrent_requests").default(5),
	requestsPerMinute: integer("requests_per_minute").default(60),
	timeoutMs: integer("timeout_ms").default(10000),
	cacheTtlSeconds: integer("cache_ttl_seconds").default(300),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("marketplace_api_configs_marketplace_name_unique").on(table.marketplaceName),
]);

export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const blogPosts = pgTable("blog_posts", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	title: text().notNull(),
	slug: text().notNull(),
	excerpt: text().notNull(),
	contentType: text("content_type").default('text').notNull(),
	content: text().notNull(),
	htmlContent: text("html_content"),
	cssContent: text("css_content"),
	authorId: varchar("author_id"),
	author: text().default('LinkPricer Team').notNull(),
	authorTitle: text("author_title"),
	authorBio: text("author_bio"),
	authorTwitterUrl: text("author_twitter_url"),
	authorLinkedinUrl: text("author_linkedin_url"),
	authorWebsiteUrl: text("author_website_url"),
	category: text().notNull(),
	coverImageUrl: text("cover_image_url"),
	published: boolean().default(false).notNull(),
	publishedAt: timestamp("published_at", { mode: 'string' }),
	metaTitle: text("meta_title"),
	metaDescription: text("meta_description"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("blog_published_date_idx").using("btree", table.published.asc().nullsLast().op("timestamp_ops"), table.publishedAt.asc().nullsLast().op("bool_ops")),
	uniqueIndex("blog_slug_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [authors.id],
			name: "blog_posts_author_id_authors_id_fk"
		}),
	unique("blog_posts_slug_unique").on(table.slug),
]);

export const siteSettings = pgTable("site_settings", {
	id: varchar().default('site_config').primaryKey().notNull(),
	heroImageUrl: text("hero_image_url"),
	heroImageAlt: text("hero_image_alt"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	updatedBy: varchar("updated_by"),
}, (table) => [
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "site_settings_updated_by_users_id_fk"
		}),
]);

export const companies = pgTable("companies", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const lpDomainPrice = pgTable("lp_domain_price", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	domainId: bigint({ mode: "number" }).primaryKey().notNull(),
	price: numeric({ precision: 8, scale:  2 }).notNull(),
	secondPrice: numeric({ precision: 8, scale:  2 }),
	thirdPrice: numeric({ precision: 8, scale:  2 }),
	currency: char({ length: 255 }),
	gambling: numeric({ precision: 8, scale:  2 }),
	adult: numeric({ precision: 8, scale:  2 }),
	cbd: numeric({ precision: 8, scale:  2 }),
	loan: numeric({ precision: 8, scale:  2 }),
	dating: numeric({ precision: 8, scale:  2 }),
	crypto: numeric({ precision: 8, scale:  2 }),
	tradingForex: numeric({ precision: 8, scale:  2 }),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
	isActive: boolean().default(true).notNull(),
	lastSeenAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("idx_lp_price_active").using("btree", table.isActive.asc().nullsLast().op("numeric_ops"), table.price.asc().nullsLast().op("numeric_ops")),
	foreignKey({
			columns: [table.domainId],
			foreignColumns: [lpMarketplaceDomains.id],
			name: "lp_domain_price_domainid_foreign"
		}).onDelete("cascade"),
]);

export const lpUpdatesLog = pgTable("lp_updates_log", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	marketPlace: varchar({ length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	scrapedCount: bigint({ mode: "number" }).notNull(),
	scrapedDate: date().notNull(),
}, (table) => [
	index("idx_lp_marketplace_date").using("btree", table.marketPlace.asc().nullsLast().op("date_ops"), table.scrapedDate.asc().nullsLast().op("date_ops")),
	unique("lp_updates_log_marketPlace_scrapedDate_key").on(table.marketPlace, table.scrapedDate),
]);

export const lpMarketplaceDomains = pgTable("lp_marketplace_domains", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	w: varchar({ length: 255 }).notNull(),
	marketPlace: varchar({ length: 255 }).notNull(),
	sourceName: text(),
	// TODO: failed to parse database type 'bytea'
	showPrice: text("showPrice").notNull(),
	category: text(),
	country: varchar({ length: 255 }),
	language: varchar({ length: 255 }),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
	scrapedAt: timestamp({ mode: 'string' }).notNull(),
	embeddings: vector({ dimensions: 1536 }),
	isActive: boolean().default(true).notNull(),
	lastSeenAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	deletedAt: timestamp({ mode: 'string' }),
}, (table) => [
	index("idx_lp_active_domains").using("btree", table.isActive.asc().nullsLast().op("bool_ops"), table.lastSeenAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_lp_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("idx_lp_country").using("btree", table.country.asc().nullsLast().op("text_ops")),
	index("idx_lp_domain_name").using("btree", table.w.asc().nullsLast().op("text_ops")),
	index("idx_lp_marketplace").using("btree", table.marketPlace.asc().nullsLast().op("text_ops")),
	uniqueIndex("lp_marketplace_domains_unique").using("btree", sql`w`, sql`marketPlace`, sql`COALESCE("sourceName", ''::text)`),
]);

export const lpDomainCategories = pgTable("lp_domain_categories", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	w: text().notNull(),
	category: text(),
	tld: text().notNull(),
	summary: text(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("idx_lp_domain_lookup").using("btree", table.w.asc().nullsLast().op("text_ops")),
	index("idx_lp_tld").using("btree", table.tld.asc().nullsLast().op("text_ops")),
	unique("lp_domain_categories_w_key").on(table.w),
]);

export const marketBenchmarks = pgTable("market_benchmarks", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	country: text().notNull(),
	category: text().notNull(),
	avgPrice: numeric("avg_price", { precision: 10, scale:  2 }).notNull(),
	minPrice: numeric("min_price", { precision: 10, scale:  2 }),
	maxPrice: numeric("max_price", { precision: 10, scale:  2 }),
	stdDev: numeric("std_dev", { precision: 10, scale:  2 }),
	sampleSize: integer("sample_size").default(0).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	avgTraffic: numeric("avg_traffic", { precision: 14, scale:  2 }).notNull(),
	avgDr: numeric("avg_dr", { precision: 10, scale:  2 }).notNull(),
	avgGamblingPrice: numeric("avg_gambling_price", { precision: 10, scale:  2 }),
}, (table) => [
	uniqueIndex("unique_benchmark_idx").using("btree", table.country.asc().nullsLast().op("text_ops"), table.category.asc().nullsLast().op("text_ops")),
]);

export const authors = pgTable("authors", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: text().notNull(),
	title: text(),
	bio: text(),
	avatarUrl: text("avatar_url"),
	twitterUrl: text("twitter_url"),
	linkedinUrl: text("linkedin_url"),
	websiteUrl: text("website_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const domains = pgTable("domains", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	domain: text().notNull(),
	countryMainTraffic: text("country_main_traffic"),
	languageWrittenInWebsite: text("language_written_in_website"),
	category: text(),
	domainRating: integer("domain_rating"),
	// Set only when ahrefs-dr.ts's rolling job writes a *confirmed* DR here
	// (never on a fetch failure) — lets callers tell "fresh from Ahrefs" apart
	// from "still the old historical import" without touching the unrelated
	// generic `updatedAt` column below.
	domainRatingUpdatedAt: timestamp("domain_rating_updated_at", { withTimezone: true, mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	orgTraffic: bigint("org_traffic", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	orgKeywords: bigint("org_keywords", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	refDomains: bigint("ref_domains", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	linkedDomains: bigint("linked_domains", { mode: "number" }),
	allowedNiche: text("allowed_niche"),
	semanticCategory: text("semantic_category"),
	semanticSummary: text("semantic_summary"),
	categoryConfidence: numeric("category_confidence", { precision: 5, scale:  4 }),
	embedding: vector({ dimensions: 1536 }),
	createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	valueScore: numeric("value_score", { precision: 5, scale:  2 }),
	valueGrade: text("value_grade"),
	gamblingValueScore: numeric("gambling_value_score", { precision: 5, scale:  2 }),
	gamblingValueGrade: text("gambling_value_grade"),
}, (table) => [
	index("IDX_domains_country").using("btree", table.countryMainTraffic.asc().nullsLast().op("text_ops")),
	index("IDX_domains_embedding").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
	index("IDX_domains_keywords").using("btree", table.orgKeywords.asc().nullsLast().op("int8_ops")),
	index("IDX_domains_rating").using("btree", table.domainRating.asc().nullsLast().op("int4_ops")),
	index("IDX_domains_traffic").using("btree", table.orgTraffic.asc().nullsLast().op("int8_ops")),
	unique("domains_domain_unique").on(table.domain),
]);

export const gdprConsentEvents = pgTable("gdpr_consent_events", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id"),
	anonymousId: varchar("anonymous_id"),
	purpose: varchar().notNull(),
	status: varchar().notNull(),
	actor: varchar().default('user').notNull(),
	ipAddress: varchar("ip_address"),
	userAgent: text("user_agent"),
	consentSource: varchar("consent_source").default('cookie_banner').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("gdpr_consent_events_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("gdpr_consent_events_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "gdpr_consent_events_user_id_users_id_fk"
		}),
]);

export const gdprConsents = pgTable("gdpr_consents", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id"),
	anonymousId: varchar("anonymous_id"),
	analyticsConsent: boolean("analytics_consent").default(false).notNull(),
	marketingConsent: boolean("marketing_consent").default(false).notNull(),
	necessaryConsent: boolean("necessary_consent").default(true).notNull(),
	lawfulBasis: varchar("lawful_basis").default('consent').notNull(),
	consentSource: varchar("consent_source").default('cookie_banner').notNull(),
	ipAddress: varchar("ip_address"),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	revokedAt: timestamp("revoked_at", { mode: 'string' }),
}, (table) => [
	index("gdpr_consents_anonymous_id_idx").using("btree", table.anonymousId.asc().nullsLast().op("text_ops")),
	index("gdpr_consents_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "gdpr_consents_user_id_users_id_fk"
		}),
]);

export const gdprDataExports = pgTable("gdpr_data_exports", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	status: varchar().default('pending').notNull(),
	exportFormat: varchar("export_format").default('json').notNull(),
	downloadUrl: text("download_url"),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("gdpr_data_exports_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "gdpr_data_exports_user_id_users_id_fk"
		}),
]);

export const lpDomainMetrics = pgTable("lp_domain_metrics", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	domainId: bigint({ mode: "number" }).primaryKey().notNull(),
	domainRating: numeric({ precision: 8, scale:  2 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	orgTraffic: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	orgKeywords: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	refDomains: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	linkedDomains: bigint({ mode: "number" }),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("idx_lp_domain_rating").using("btree", table.domainRating.asc().nullsLast().op("numeric_ops")),
	index("idx_lp_org_traffic").using("btree", table.orgTraffic.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.domainId],
			foreignColumns: [lpMarketplaceDomains.id],
			name: "lp_domain_metrics_domainid_foreign"
		}).onDelete("cascade"),
]);

export const lpDomainInfo = pgTable("lp_domain_info", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	domainId: bigint({ mode: "number" }).primaryKey().notNull(),
	info: text(),
	allowedNiche: text(),
	rejectedNiche: text(),
	publicationType: text(),
	linkType: text(),
	tat: text("TAT"),
	linkNo: text(),
	wordCount: text(),
	sponsoredTag: text(),
	duration: text(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.domainId],
			foreignColumns: [lpMarketplaceDomains.id],
			name: "lp_domain_info_domainid_foreign"
		}).onDelete("cascade"),
]);

export const lpDomainAiMetrics = pgTable("lp_domain_ai_metrics", {
	domainUrl: varchar().primaryKey().notNull(),
	semanticCategory: text(),
	semanticSummary: text(),
	categoryConfidence: numeric(),
	valueScore: numeric(),
	valueGrade: text(),
	gamblingValueScore: numeric(),
	gamblingValueGrade: text(),
	embeddings: vector({ dimensions: 1536 }),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_lp_ai_metrics_embeddings_hnsw").using("hnsw", table.embeddings.asc().nullsLast().op("vector_cosine_ops")),
]);

export const apiClients = pgTable("api_clients", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	apiKeyHash: text("api_key_hash").notNull(),
	rateLimitPerMinute: integer("rate_limit_per_minute").default(100).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("api_clients_api_key_hash_key").on(table.apiKeyHash),
]);

export const apiKeys = pgTable("api_keys", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	keyHash: text("key_hash").notNull(),
	name: text().notNull(),
	dailyLimit: integer("daily_limit").default(1000).notNull(),
	perMinuteLimit: integer("per_minute_limit").default(60).notNull(),
	dataScope: text("data_scope").default('price_only').notNull(),
	requestCount: integer("request_count").default(0).notNull(),
	usageDate: varchar("usage_date"),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	// One-time plaintext reveal, cleared by POST /api/developers/ack-key-reveal
	// once the client has actually shown it. Never populated again afterwards.
	plainKeyTemp: text("plain_key_temp"),
	// Atomic rate-limit counters. These are not bookkeeping — the public API's
	// limits ARE these columns (conditional UPDATE ... WHERE count < limit), so
	// dropping them disables rate limiting outright rather than degrading it.
	minuteWindow: bigint("minute_window", { mode: 'number' }),
	minuteCount: integer("minute_count").default(0).notNull(),
	monthlyLimit: integer("monthly_limit"),
	monthCount: integer("month_count").default(0).notNull(),
	monthWindow: varchar("month_window"),
}, (table) => [
	index("api_keys_key_hash_idx").using("btree", table.keyHash.asc().nullsLast().op("text_ops")),
	index("api_keys_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	// Partial unique index — the invariant the checkout webhook and
	// regenerate-key both rely on to guarantee exactly one live key per user.
	uniqueIndex("api_keys_one_active_per_user").using("btree", table.userId.asc().nullsLast().op("text_ops")).where(sql`${table.isActive} = true`),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "api_keys_user_id_users_id_fk"
		}),
	unique("api_keys_key_hash_unique").on(table.keyHash),
]);

export const favorites = pgTable("favorites", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	domainId: varchar("domain_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("user_domain_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.domainId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "favorites_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.domainId],
			foreignColumns: [domains.id],
			name: "favorites_domain_id_domains_id_fk"
		}),
]);

export const linkMonitors = pgTable("link_monitors", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	orderId: varchar("order_id").notNull(),
	userId: varchar("user_id").notNull(),
	publishedUrl: text("published_url").notNull(),
	targetUrl: text("target_url").notNull(),
	anchorText: text("anchor_text").notNull(),
	domain: text().notNull(),
	status: text().default('pending').notNull(),
	lastCheckedAt: timestamp("last_checked_at", { mode: 'string' }),
	nextCheckAt: timestamp("next_check_at", { mode: 'string' }).notNull(),
	isIndexed: boolean("is_indexed"),
	indexedAt: timestamp("indexed_at", { mode: 'string' }),
	lastIndexCheck: timestamp("last_index_check", { mode: 'string' }),
	publishedAt: timestamp("published_at", { mode: 'string' }).defaultNow().notNull(),
	daysLive: integer("days_live").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("link_monitors_next_check_idx").using("btree", table.nextCheckAt.asc().nullsLast().op("timestamp_ops")),
	uniqueIndex("link_monitors_order_idx").using("btree", table.orderId.asc().nullsLast().op("text_ops")),
	index("link_monitors_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("link_monitors_user_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "link_monitors_order_id_orders_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "link_monitors_user_id_users_id_fk"
		}),
]);

export const marketplacePriceHistory = pgTable("marketplace_price_history", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	domainId: varchar("domain_id").notNull(),
	marketplaceName: text("marketplace_name").notNull(),
	priceType: text("price_type").notNull(),
	oldMinPrice: numeric("old_min_price", { precision: 10, scale:  2 }),
	oldMaxPrice: numeric("old_max_price", { precision: 10, scale:  2 }),
	newMinPrice: numeric("new_min_price", { precision: 10, scale:  2 }),
	newMaxPrice: numeric("new_max_price", { precision: 10, scale:  2 }),
	changeDate: timestamp("change_date", { mode: 'string' }).defaultNow(),
	changePercentage: numeric("change_percentage", { precision: 10, scale:  2 }),
}, (table) => [
	index("price_history_domain_date_idx").using("btree", table.domainId.asc().nullsLast().op("text_ops"), table.changeDate.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.domainId],
			foreignColumns: [domains.id],
			name: "marketplace_price_history_domain_id_domains_id_fk"
		}),
]);

export const orders = pgTable("orders", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id"),
	offerId: varchar("offer_id"),
	status: text().default('Writing').notNull(),
	orderType: text("order_type").notNull(),
	totalAmount: numeric("total_amount", { precision: 10, scale:  2 }).notNull(),
	snapshotDomain: text("snapshot_domain"),
	snapshotMarketplaceName: text("snapshot_marketplace_name"),
	snapshotMarketplaceUrl: text("snapshot_marketplace_url"),
	snapshotCurrency: text("snapshot_currency").default('USD'),
	snapshotOfferMetadata: jsonb("snapshot_offer_metadata"),
	priceCapturedAt: timestamp("price_captured_at", { mode: 'string' }),
	contentOption: text("content_option").default('provided').notNull(),
	wordCount: integer("word_count").default(750),
	contentPrice: numeric("content_price", { precision: 10, scale:  2 }).default('37.50'),
	uploadedFileName: text("uploaded_file_name"),
	originalFileName: text("original_file_name"),
	articleUrl: text("article_url"),
	email: text().notNull(),
	articleTitle: text("article_title"),
	targetUrl: text("target_url").notNull(),
	anchorText: text("anchor_text"),
	// Optional extra target-url/anchor-text pairs beyond the primary one above
	// (see OrderLinkPair in lib/orders/types.ts) — an array of {targetUrl,
	// anchorText}, or null/empty when the order only has the one primary link.
	additionalLinks: jsonb("additional_links"),
	requirements: text(),
	priceType: text("price_type").default('base').notNull(),
	selectedPrice: numeric("selected_price", { precision: 10, scale:  2 }).notNull(),
	reviewNotes: text("review_notes"),
	liveUrl: text("live_url"),
	createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	companyId: varchar("company_id"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "orders_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "orders_company_id_companies_id_fk"
		}),
]);

export const onboardingResponses = pgTable("onboarding_responses", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	userType: varchar("user_type").notNull(),
	userTypeOther: text("user_type_other"),
	monthlySpend: varchar("monthly_spend").notNull(),
	biggestChallenge: text("biggest_challenge").notNull(),
	priorityFactors: text("priority_factors").array().notNull(),
	currentMethod: text("current_method").array().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "onboarding_responses_user_id_users_id_fk"
		}),
	unique("onboarding_responses_user_id_unique").on(table.userId),
]);

export const passkeyCredentials = pgTable("passkey_credentials", {
	id: varchar().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	publicKey: text("public_key").notNull(),
	counter: integer().default(0).notNull(),
	transports: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "passkey_credentials_user_id_users_id_fk"
		}),
]);

export const marketplaceClicks = pgTable("marketplace_clicks", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id"),
	domainId: varchar("domain_id"),
	domain: text().notNull(),
	marketplaceName: text("marketplace_name").notNull(),
	marketplaceUrl: text("marketplace_url").notNull(),
	ipAddress: varchar("ip_address"),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "marketplace_clicks_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.domainId],
			foreignColumns: [domains.id],
			name: "marketplace_clicks_domain_id_domains_id_fk"
		}),
]);

export const userActivityEvents = pgTable("user_activity_events", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	eventType: varchar("event_type").notNull(),
	timestamp: timestamp({ mode: 'string' }).defaultNow().notNull(),
	metadata: jsonb(),
	sessionId: varchar("session_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("event_type_timestamp_idx").using("btree", table.eventType.asc().nullsLast().op("text_ops"), table.timestamp.asc().nullsLast().op("text_ops")),
	index("user_timestamp_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.timestamp.desc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_activity_events_user_id_users_id_fk"
		}),
]);

export const externalUrlEmbeddings = pgTable("external_url_embeddings", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	url: text().notNull(),
	title: text(),
	description: text(),
	summary: text(),
	embedding: vector({ dimensions: 1536 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("external_url_embeddings_url_idx").using("btree", table.url.asc().nullsLast().op("text_ops")),
	unique("external_url_embeddings_url_unique").on(table.url),
]);

export const linkMonitoringChecks = pgTable("link_monitoring_checks", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	linkMonitorId: varchar("link_monitor_id").notNull(),
	status: text().notNull(),
	statusMessage: text("status_message"),
	linkFound: boolean("link_found").notNull(),
	anchorMatched: boolean("anchor_matched"),
	urlMatched: boolean("url_matched"),
	relAttributes: text("rel_attributes"),
	isIndexed: boolean("is_indexed"),
	indexCheckError: text("index_check_error"),
	httpStatusCode: integer("http_status_code"),
	responseTimeMs: integer("response_time_ms"),
	checkedAt: timestamp("checked_at", { mode: 'string' }).defaultNow().notNull(),
	foundAnchorText: text("found_anchor_text"),
}, (table) => [
	index("link_checks_monitor_date_idx").using("btree", table.linkMonitorId.asc().nullsLast().op("text_ops"), table.checkedAt.desc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.linkMonitorId],
			foreignColumns: [linkMonitors.id],
			name: "link_monitoring_checks_link_monitor_id_link_monitors_id_fk"
		}),
]);

export const oauthAccounts = pgTable("oauth_accounts", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	provider: varchar().notNull(),
	providerAccountId: varchar("provider_account_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	accessToken: varchar("access_token"),
	refreshToken: varchar("refresh_token"),
	expiresAt: integer("expires_at"),
}, (table) => [
	uniqueIndex("oauth_accounts_provider_account_idx").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.providerAccountId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "oauth_accounts_user_id_users_id_fk"
		}),
]);

export const marketplaceOffers = pgTable("marketplace_offers", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	domainId: varchar("domain_id").notNull(),
	marketplaceName: text("marketplace_name").notNull(),
	marketplaceUrl: text("marketplace_url"),
	showPrice: boolean("show_price").default(true).notNull(),
	minPrice: numeric("min_price", { precision: 10, scale:  2 }),
	maxPrice: numeric("max_price", { precision: 10, scale:  2 }),
	currency: text().default('USD').notNull(),
	gamblingMinPrice: numeric("gambling_min_price", { precision: 10, scale:  2 }),
	gamblingMaxPrice: numeric("gambling_max_price", { precision: 10, scale:  2 }),
	adultMinPrice: numeric("adult_min_price", { precision: 10, scale:  2 }),
	adultMaxPrice: numeric("adult_max_price", { precision: 10, scale:  2 }),
	cbdMinPrice: numeric("cbd_min_price", { precision: 10, scale:  2 }),
	cbdMaxPrice: numeric("cbd_max_price", { precision: 10, scale:  2 }),
	loanMinPrice: numeric("loan_min_price", { precision: 10, scale:  2 }),
	loanMaxPrice: numeric("loan_max_price", { precision: 10, scale:  2 }),
	datingMinPrice: numeric("dating_min_price", { precision: 10, scale:  2 }),
	datingMaxPrice: numeric("dating_max_price", { precision: 10, scale:  2 }),
	cryptoMinPrice: numeric("crypto_min_price", { precision: 10, scale:  2 }),
	cryptoMaxPrice: numeric("crypto_max_price", { precision: 10, scale:  2 }),
	tradingForexMinPrice: numeric("trading_forex_min_price", { precision: 10, scale:  2 }),
	tradingForexMaxPrice: numeric("trading_forex_max_price", { precision: 10, scale:  2 }),
	deliveryTimeDays: integer("delivery_time_days"),
	requirements: text(),
	qualityScore: integer("quality_score"),
	available: boolean().default(true).notNull(),
	priceSource: text("price_source").default('database'),
	lastFetchedAt: timestamp("last_fetched_at", { mode: 'string' }),
	syncRunId: text("sync_run_id"),
	createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	publicationType: text("publication_type"),
	linkType: text("link_type"),
	wordCount: text("word_count"),
	sponsoredTag: text("sponsored_tag"),
	duration: text(),
	linkNo: text("link_no"),
	rejectedNiche: text("rejected_niche"),
	tat: text(),
	linkInsertionMinPrice: numeric("link_insertion_min_price", { precision: 10, scale:  2 }),
	linkInsertionMaxPrice: numeric("link_insertion_max_price", { precision: 10, scale:  2 }),
}, (table) => [
	uniqueIndex("domain_marketplace_idx").using("btree", table.domainId.asc().nullsLast().op("text_ops"), table.marketplaceName.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.domainId],
			foreignColumns: [domains.id],
			name: "marketplace_offers_domain_id_domains_id_fk"
		}),
]);

// Canonical per-marketplace registry -- see migration
// 0005_create_marketplaces.sql for why this exists and why the destination
// URL is split into affiliate (revenue-bearing) vs homepage (fallback).
export const marketplaces = pgTable("marketplaces", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: text().notNull(),
	displayName: text("display_name"),
	homepageUrl: text("homepage_url").notNull(),
	affiliateUrl: text("affiliate_url"),
	enabled: boolean().default(true).notNull(),
	// Admin-set trust flag. The public API's recommended_price is the cheapest
	// offer among trusted marketplaces only — see migration 0006.
	trusted: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	// Both of these exist in the database (migrations 0005 and 0006). They were
	// never declared here, so `npm run db:push` would have silently dropped
	// them — the same class of drift that once threatened the rate-limiter
	// columns on api_keys.
	index("marketplaces_enabled_idx").using("btree", table.enabled.asc().nullsLast()),
	index("marketplaces_trusted_idx").using("btree", table.trusted.asc().nullsLast()).where(sql`${table.trusted}`),
	unique("marketplaces_name_unique").on(table.name),
]);

export const syncState = pgTable("sync_state", {
	id: varchar().default('mysql_sync').primaryKey().notNull(),
	lastProcessedMysqlId: integer("last_processed_mysql_id").default(0).notNull(),
	totalRecordsProcessed: integer("total_records_processed").default(0).notNull(),
	totalDomainsCreated: integer("total_domains_created").default(0).notNull(),
	totalOffersCreated: integer("total_offers_created").default(0).notNull(),
	lastSyncStartedAt: timestamp("last_sync_started_at", { mode: 'string' }),
	lastSyncCompletedAt: timestamp("last_sync_completed_at", { mode: 'string' }),
	isRunning: boolean("is_running").default(false).notNull(),
	currentSyncRunId: text("current_sync_run_id"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const users = pgTable("users", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	email: varchar(),
	password: varchar(),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	profileImageUrl: varchar("profile_image_url"),
	preferredCurrency: varchar("preferred_currency").default('USD').notNull(),
	hasCompletedOnboarding: boolean("has_completed_onboarding").default(false).notNull(),
	welcomeEmailSent: boolean("welcome_email_sent").default(false).notNull(),
	lastLoginAt: timestamp("last_login_at", { mode: 'string' }),
	loginCount: integer("login_count").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	role: varchar().default('client').notNull(),
	status: varchar().default('live').notNull(),
	// Durable grant of admin capability, decoupled from `role` -- lets a
	// genuine client account (role stays "client", own company/orders/data
	// intact) also be permitted into /admin. requireAdminSession() checks
	// this, not `role`. Legacy vendor-role admins are backfilled to true by
	// migration 0004 so their access doesn't change.
	isAdmin: boolean("is_admin").default(false).notNull(),
	vendorName: varchar("vendor_name"),
	companyId: varchar("company_id"),
	stripeCustomerId: varchar("stripe_customer_id"),
	stripeSubscriptionId: varchar("stripe_subscription_id"),
	stripePlan: varchar("stripe_plan"),
	// NULL = use the global WEEKLY_LIMIT default (see app/api/related-sites/route.ts);
	// set to give this specific user a different weekly Related Sites search quota.
	relatedSitesQuotaOverride: integer("related_sites_quota_override"),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "users_company_id_companies_id_fk"
		}),
	unique("users_email_unique").on(table.email),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	token: varchar().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "password_reset_tokens_user_id_users_id_fk"
		}),
	unique("password_reset_tokens_token_unique").on(table.token),
]);

export const supportTickets = pgTable("support_tickets", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	topic: varchar().notNull(),
	subject: text().notNull(),
	message: text().notNull(),
	status: varchar().default('open').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "support_tickets_user_id_users_id_fk"
		}),
]);

export const supplierInvitations = pgTable("supplier_invitations", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	clientUserId: varchar("client_user_id").notNull(),
	vendorUserId: varchar("vendor_user_id"),
	inviteToken: varchar("invite_token").notNull(),
	vendorName: text("vendor_name").notNull(),
	vendorEmail: text("vendor_email"),
	status: varchar().default('pending').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("supplier_invitations_client_user_id_idx").using("btree", table.clientUserId.asc().nullsLast().op("text_ops")),
	index("supplier_invitations_token_idx").using("btree", table.inviteToken.asc().nullsLast().op("text_ops")),
	index("supplier_invitations_vendor_user_id_idx").using("btree", table.vendorUserId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientUserId],
			foreignColumns: [users.id],
			name: "supplier_invitations_client_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.vendorUserId],
			foreignColumns: [users.id],
			name: "supplier_invitations_vendor_user_id_users_id_fk"
		}),
	unique("supplier_invitations_invite_token_unique").on(table.inviteToken),
]);

export const supplierOffers = pgTable("supplier_offers", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	vendorUserId: varchar("vendor_user_id").notNull(),
	domainId: varchar("domain_id"),
	domain: text().notNull(),
	minPrice: numeric("min_price", { precision: 10, scale:  2 }).notNull(),
	maxPrice: numeric("max_price", { precision: 10, scale:  2 }),
	currency: text().default('EUR').notNull(),
	gamblingMinPrice: numeric("gambling_min_price", { precision: 10, scale:  2 }),
	gamblingMaxPrice: numeric("gambling_max_price", { precision: 10, scale:  2 }),
	adultMinPrice: numeric("adult_min_price", { precision: 10, scale:  2 }),
	adultMaxPrice: numeric("adult_max_price", { precision: 10, scale:  2 }),
	cbdMinPrice: numeric("cbd_min_price", { precision: 10, scale:  2 }),
	cbdMaxPrice: numeric("cbd_max_price", { precision: 10, scale:  2 }),
	loanMinPrice: numeric("loan_min_price", { precision: 10, scale:  2 }),
	loanMaxPrice: numeric("loan_max_price", { precision: 10, scale:  2 }),
	datingMinPrice: numeric("dating_min_price", { precision: 10, scale:  2 }),
	datingMaxPrice: numeric("dating_max_price", { precision: 10, scale:  2 }),
	cryptoMinPrice: numeric("crypto_min_price", { precision: 10, scale:  2 }),
	cryptoMaxPrice: numeric("crypto_max_price", { precision: 10, scale:  2 }),
	tradingForexMinPrice: numeric("trading_forex_min_price", { precision: 10, scale:  2 }),
	tradingForexMaxPrice: numeric("trading_forex_max_price", { precision: 10, scale:  2 }),
	deliveryTimeDays: integer("delivery_time_days"),
	contentIncluded: boolean("content_included").default(false).notNull(),
	notes: text(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	status: text().default('pending').notNull(),
	linkInsertionMinPrice: numeric("link_insertion_min_price", { precision: 10, scale:  2 }),
	linkInsertionMaxPrice: numeric("link_insertion_max_price", { precision: 10, scale:  2 }),
}, (table) => [
	index("supplier_offers_domain_id_idx").using("btree", table.domainId.asc().nullsLast().op("text_ops")),
	index("supplier_offers_domain_idx").using("btree", table.domain.asc().nullsLast().op("text_ops")),
	index("supplier_offers_vendor_user_id_idx").using("btree", table.vendorUserId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.vendorUserId],
			foreignColumns: [users.id],
			name: "supplier_offers_vendor_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.domainId],
			foreignColumns: [domains.id],
			name: "supplier_offers_domain_id_domains_id_fk"
		}),
]);

// Buyer-submitted 1-5 star rating left on an order after it completes. One
// row per order (unique orderId) — ratings are aggregated live via a plain
// GROUP BY at search-query time (see lib/search/catalog-search.ts), not a
// precomputed metrics table, since this stays small.
export const orderRatings = pgTable("order_ratings", {
	id: varchar().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	// Nullable: a buyer review always has orderId set (unique — one review
	// per order); an admin-added marketplace review has orderId null and
	// marketplaceName set directly instead (admins have no order to attach
	// to). Postgres treats each NULL as distinct under a plain UNIQUE
	// constraint, so this same column/constraint permits unlimited
	// admin (order_id-null) rows without weakening the one-per-order rule
	// for real buyer rows.
	orderId: varchar("order_id"),
	userId: varchar("user_id").notNull(),
	rating: integer().notNull(),
	comment: text(),
	marketplaceName: text("marketplace_name"),
	source: text().default('buyer').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("order_ratings_order_id_unique").on(table.orderId),
	// One admin review per (admin, marketplace) — only applies to admin rows
	// (order_id IS NULL); buyer rows are unconstrained by this index.
	uniqueIndex("order_ratings_admin_marketplace_idx")
		.using("btree", table.userId.asc(), table.marketplaceName.asc())
		.where(sql`${table.orderId} IS NULL`),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_ratings_order_id_orders_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "order_ratings_user_id_users_id_fk"
		}),
	check("order_ratings_rating_check", sql`rating >= 1 AND rating <= 5`),
	check("order_ratings_source_check", sql`source IN ('buyer', 'admin')`),
	check("order_ratings_attribution_check", sql`order_id IS NOT NULL OR marketplace_name IS NOT NULL`),
]);

export const apiBillingLedger = pgTable("api_billing_ledger", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orderId: uuid("order_id").notNull(),
	clientId: uuid("client_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	domainId: bigint("domain_id", { mode: "number" }).notNull(),
	domain: text().notNull(),
	priceAtOrder: numeric("price_at_order", { precision: 10, scale:  2 }).notNull(),
	currency: varchar({ length: 3 }).default('EUR').notNull(),
	billedAt: timestamp("billed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("api_billing_ledger_billed_at_idx").using("btree", table.billedAt.asc().nullsLast().op("timestamptz_ops")),
	index("api_billing_ledger_client_id_idx").using("btree", table.clientId.asc().nullsLast().op("uuid_ops")),
	index("api_billing_ledger_order_id_idx").using("btree", table.orderId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [apiOrders.id],
			name: "api_billing_ledger_order_id_fkey"
		}),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [apiClients.id],
			name: "api_billing_ledger_client_id_fkey"
		}),
]);

export const agencyDbUsers = pgTable("agency_db_users", {
	dbUsername: text("db_username").primaryKey().notNull(),
	clientId: uuid("client_id"),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [apiClients.id],
			name: "agency_db_users_client_id_fkey"
		}),
]);

export const apiPriceNotifications = pgTable("api_price_notifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orderId: uuid("order_id").notNull(),
	clientId: uuid("client_id").notNull(),
	notificationType: text("notification_type").notNull(),
	oldPrice: numeric("old_price", { precision: 10, scale:  2 }),
	newPrice: numeric("new_price", { precision: 10, scale:  2 }),
	details: text(),
	status: text().default('unread').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("api_price_notifications_client_idx").using("btree", table.clientId.asc().nullsLast().op("uuid_ops")),
	index("api_price_notifications_order_idx").using("btree", table.orderId.asc().nullsLast().op("uuid_ops")),
	index("api_price_notifications_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [apiOrders.id],
			name: "api_price_notifications_order_id_fkey"
		}),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [apiClients.id],
			name: "api_price_notifications_client_id_fkey"
		}),
	check("api_price_notifications_notification_type_check", sql`notification_type = ANY (ARRAY['price_increase'::text, 'order_cancelled'::text])`),
	check("api_price_notifications_status_check", sql`status = ANY (ARRAY['unread'::text, 'acknowledged'::text, 'resolved'::text])`),
]);

export const apiCuratedDomains = pgTable("api_curated_domains", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clientId: uuid("client_id"),
	domain: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	orgTraffic: bigint("org_traffic", { mode: "number" }),
	domainRating: integer("domain_rating"),
	category: text(),
	allowedNiche: text("allowed_niche"),
	price: numeric({ precision: 10, scale:  2 }).notNull(),
	currency: varchar({ length: 3 }).default('USD').notNull(),
	deliveryTimeDays: integer("delivery_time_days"),
	validUntil: timestamp("valid_until", { withTimezone: true, mode: 'string' }),
	lastUpdated: timestamp("last_updated", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("api_curated_domains_client_idx").using("btree", table.clientId.asc().nullsLast().op("uuid_ops")),
	index("api_curated_domains_domain_idx").using("btree", table.domain.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [apiClients.id],
			name: "api_curated_domains_client_id_fkey"
		}),
	unique("api_curated_domains_client_id_domain_key").on(table.clientId, table.domain),
	pgPolicy("agency_catalog_policy", { as: "permissive", for: "select", to: ["agency_readonly_client"], using: sql`((client_id IS NULL) OR (client_id = ( SELECT agency_db_users.client_id
   FROM agency_db_users
  WHERE (agency_db_users.db_username = CURRENT_USER))))` }),
]);

export const apiOrders = pgTable("api_orders", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clientId: uuid("client_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	domainId: bigint("domain_id", { mode: "number" }),
	domain: text().notNull(),
	targetUrl: text("target_url").notNull(),
	anchorText: text("anchor_text").notNull(),
	articleBody: text("article_body"),
	callbackUrl: text("callback_url"),
	status: text().default('received').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	articleUrl: text("article_url"),
	clientOrderRef: text("client_order_ref"),
	offerId: text("offer_id"),
	publishedUrl: text("published_url"),
	finalPrice: numeric("final_price", { precision: 10, scale:  2 }),
	finalCurrency: varchar("final_currency", { length: 3 }),
	rejectedReason: text("rejected_reason"),
	placedAt: timestamp("placed_at", { withTimezone: true, mode: 'string' }),
	idempotencyKey: text("idempotency_key"),
	metadata: jsonb(),
}, (table) => [
	index("api_orders_client_id_idx").using("btree", table.clientId.asc().nullsLast().op("uuid_ops")),
	index("api_orders_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [apiClients.id],
			name: "api_orders_client_id_fkey"
		}),
	check("api_orders_status_check", sql`status = ANY (ARRAY['received'::text, 'processing'::text, 'submitted_to_publisher'::text, 'live'::text, 'rejected'::text])`),
]);

export const lpDomainMetricsHistory = pgTable("lp_domain_metrics_history", {
	snapshotDate: date().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	domainId: bigint({ mode: "number" }).notNull(),
	domainRating: numeric({ precision: 8, scale:  2 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	orgTraffic: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	orgKeywords: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	refDomains: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	linkedDomains: bigint({ mode: "number" }),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("idx_lp_metrics_history_domain").using("btree", table.domainId.asc().nullsLast().op("date_ops"), table.snapshotDate.asc().nullsLast().op("int8_ops")),
	index("idx_lp_metrics_history_snapshot").using("btree", table.snapshotDate.asc().nullsLast().op("date_ops")),
	primaryKey({ columns: [table.snapshotDate, table.domainId], name: "lp_domain_metrics_history_pkey"}),
]);

export const lpDomainInfoHistory = pgTable("lp_domain_info_history", {
	snapshotDate: date().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	domainId: bigint({ mode: "number" }).notNull(),
	info: text(),
	allowedNiche: text(),
	rejectedNiche: text(),
	publicationType: text(),
	linkType: text(),
	tat: text("TAT"),
	linkNo: text(),
	wordCount: text(),
	sponsoredTag: text(),
	duration: text(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("idx_lp_info_history_domain").using("btree", table.domainId.asc().nullsLast().op("date_ops"), table.snapshotDate.asc().nullsLast().op("int8_ops")),
	index("idx_lp_info_history_snapshot").using("btree", table.snapshotDate.asc().nullsLast().op("date_ops")),
	primaryKey({ columns: [table.snapshotDate, table.domainId], name: "lp_domain_info_history_pkey"}),
]);

export const lpMarketplaceDomainsHistory = pgTable("lp_marketplace_domains_history", {
	snapshotDate: date().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).notNull(),
	w: varchar({ length: 255 }).notNull(),
	marketPlace: varchar({ length: 255 }).notNull(),
	sourceName: text(),
	// TODO: failed to parse database type 'bytea'
	showPrice: text("showPrice").notNull(),
	category: text(),
	country: varchar({ length: 255 }),
	language: varchar({ length: 255 }),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
	scrapedAt: timestamp({ mode: 'string' }).notNull(),
	embeddings: vector({ dimensions: 1536 }),
	isActive: boolean().notNull(),
	lastSeenAt: timestamp({ mode: 'string' }).notNull(),
	deletedAt: timestamp({ mode: 'string' }),
}, (table) => [
	index("idx_lp_domains_history_domain").using("btree", table.w.asc().nullsLast().op("text_ops"), table.snapshotDate.asc().nullsLast().op("date_ops")),
	index("idx_lp_domains_history_snapshot").using("btree", table.snapshotDate.asc().nullsLast().op("date_ops")),
	primaryKey({ columns: [table.snapshotDate, table.id], name: "lp_marketplace_domains_history_pkey"}),
]);

export const lpDomainPriceHistory = pgTable("lp_domain_price_history", {
	snapshotDate: date().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	domainId: bigint({ mode: "number" }).notNull(),
	price: numeric({ precision: 8, scale:  2 }).notNull(),
	secondPrice: numeric({ precision: 8, scale:  2 }),
	thirdPrice: numeric({ precision: 8, scale:  2 }),
	currency: char({ length: 255 }),
	gambling: numeric({ precision: 8, scale:  2 }),
	adult: numeric({ precision: 8, scale:  2 }),
	cbd: numeric({ precision: 8, scale:  2 }),
	loan: numeric({ precision: 8, scale:  2 }),
	dating: numeric({ precision: 8, scale:  2 }),
	crypto: numeric({ precision: 8, scale:  2 }),
	tradingForex: numeric({ precision: 8, scale:  2 }),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
	isActive: boolean().notNull(),
	lastSeenAt: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("idx_lp_price_history_domain").using("btree", table.domainId.asc().nullsLast().op("date_ops"), table.snapshotDate.asc().nullsLast().op("int8_ops")),
	index("idx_lp_price_history_snapshot").using("btree", table.snapshotDate.asc().nullsLast().op("date_ops")),
	primaryKey({ columns: [table.snapshotDate, table.domainId], name: "lp_domain_price_history_pkey"}),
]);
export const dominicLiveCatalog = pgView("dominic_live_catalog", {	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	domainId: bigint("domain_id", { mode: "number" }),
	domain: varchar({ length: 255 }),
	price: doublePrecision(),
	currency: text(),
	dr: doublePrecision(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthlyTraffic: bigint("monthly_traffic", { mode: "number" }),
	nicheCategory: text("niche_category"),
	country: varchar({ length: 255 }),
}).as(sql`SELECT d.id AS domain_id, d.w AS domain, min(p.price::double precision) AS price, TRIM(BOTH FROM COALESCE(max(p.currency), 'EUR'::bpchar)) AS currency, m."domainRating"::double precision AS dr, m."orgTraffic" AS monthly_traffic, d.category AS niche_category, d.country FROM lp_marketplace_domains d JOIN lp_domain_price p ON p."domainId" = d.id LEFT JOIN lp_domain_metrics m ON m."domainId" = d.id WHERE d."isActive" = true AND p."isActive" = true AND d."deletedAt" IS NULL GROUP BY d.id, d.w, m."domainRating", m."orgTraffic", d.category, d.country`);

export const adaptifyGuestPostOffers = pgView("adaptify_guest_post_offers", {	offerId: text("offer_id"),
	domain: varchar({ length: 255 }),
	orderable: boolean(),
	isGuestPost: boolean("is_guest_post"),
	placementType: text("placement_type"),
	price: numeric(),
	currency: text(),
	dr: numeric(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthlyTraffic: bigint("monthly_traffic", { mode: "number" }),
	niche: text(),
	language: varchar({ length: 255 }),
	countryCode: varchar("country_code", { length: 255 }),
	turnaroundDays: integer("turnaround_days"),
	acceptsClientArticle: boolean("accepts_client_article"),
	willWriteArticle: boolean("will_write_article"),
	maxLinks: integer("max_links"),
	lastVerifiedAt: timestamp("last_verified_at", { mode: 'string' }),
}).as(sql`SELECT concat('lp_', d.id::text) AS offer_id, d.w AS domain, true AS orderable, true AS is_guest_post, 'guest_post'::text AS placement_type, min(p.price::numeric) AS price, TRIM(BOTH FROM COALESCE(max(p.currency), 'EUR'::bpchar)) AS currency, m."domainRating"::numeric AS dr, m."orgTraffic" AS monthly_traffic, d.category AS niche, d.language, d.country AS country_code, 14 AS turnaround_days, true AS accepts_client_article, true AS will_write_article, 1 AS max_links, max(p."updatedAt") AS last_verified_at FROM lp_marketplace_domains d JOIN lp_domain_price p ON p."domainId" = d.id LEFT JOIN lp_domain_metrics m ON m."domainId" = d.id WHERE d."isActive" = true AND p."isActive" = true AND d."deletedAt" IS NULL GROUP BY d.id, d.w, m."domainRating", m."orgTraffic", d.category, d.language, d.country`);