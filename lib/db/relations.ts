import { relations } from "drizzle-orm/relations";
import { apiKeys, apiRequestLogs, users, gdprDeletionRequests, authors, blogPosts, siteSettings, lpMarketplaceDomains, lpDomainPrice, gdprConsentEvents, gdprConsents, gdprDataExports, lpDomainMetrics, lpDomainInfo, favorites, domains, orders, linkMonitors, marketplacePriceHistory, companies, onboardingResponses, passkeyCredentials, marketplaceClicks, userActivityEvents, linkMonitoringChecks, oauthAccounts, marketplaceOffers, passwordResetTokens, supportTickets, supplierInvitations, supplierOffers, apiOrders, apiBillingLedger, apiClients, agencyDbUsers, apiPriceNotifications, apiCuratedDomains } from "./schema";

export const apiRequestLogsRelations = relations(apiRequestLogs, ({one}) => ({
	apiKey: one(apiKeys, {
		fields: [apiRequestLogs.apiKeyId],
		references: [apiKeys.id]
	}),
	user: one(users, {
		fields: [apiRequestLogs.userId],
		references: [users.id]
	}),
}));

export const apiKeysRelations = relations(apiKeys, ({one, many}) => ({
	apiRequestLogs: many(apiRequestLogs),
	user: one(users, {
		fields: [apiKeys.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	apiRequestLogs: many(apiRequestLogs),
	gdprDeletionRequests: many(gdprDeletionRequests),
	siteSettings: many(siteSettings),
	gdprConsentEvents: many(gdprConsentEvents),
	gdprConsents: many(gdprConsents),
	gdprDataExports: many(gdprDataExports),
	apiKeys: many(apiKeys),
	favorites: many(favorites),
	linkMonitors: many(linkMonitors),
	orders: many(orders),
	onboardingResponses: many(onboardingResponses),
	passkeyCredentials: many(passkeyCredentials),
	marketplaceClicks: many(marketplaceClicks),
	userActivityEvents: many(userActivityEvents),
	oauthAccounts: many(oauthAccounts),
	company: one(companies, {
		fields: [users.companyId],
		references: [companies.id]
	}),
	passwordResetTokens: many(passwordResetTokens),
	supportTickets: many(supportTickets),
	supplierInvitations_clientUserId: many(supplierInvitations, {
		relationName: "supplierInvitations_clientUserId_users_id"
	}),
	supplierInvitations_vendorUserId: many(supplierInvitations, {
		relationName: "supplierInvitations_vendorUserId_users_id"
	}),
	supplierOffers: many(supplierOffers),
}));

export const gdprDeletionRequestsRelations = relations(gdprDeletionRequests, ({one}) => ({
	user: one(users, {
		fields: [gdprDeletionRequests.userId],
		references: [users.id]
	}),
}));

export const blogPostsRelations = relations(blogPosts, ({one}) => ({
	author: one(authors, {
		fields: [blogPosts.authorId],
		references: [authors.id]
	}),
}));

export const authorsRelations = relations(authors, ({many}) => ({
	blogPosts: many(blogPosts),
}));

export const siteSettingsRelations = relations(siteSettings, ({one}) => ({
	user: one(users, {
		fields: [siteSettings.updatedBy],
		references: [users.id]
	}),
}));

export const lpDomainPriceRelations = relations(lpDomainPrice, ({one}) => ({
	lpMarketplaceDomain: one(lpMarketplaceDomains, {
		fields: [lpDomainPrice.domainId],
		references: [lpMarketplaceDomains.id]
	}),
}));

export const lpMarketplaceDomainsRelations = relations(lpMarketplaceDomains, ({many}) => ({
	lpDomainPrices: many(lpDomainPrice),
	lpDomainMetrics: many(lpDomainMetrics),
	lpDomainInfos: many(lpDomainInfo),
}));

export const gdprConsentEventsRelations = relations(gdprConsentEvents, ({one}) => ({
	user: one(users, {
		fields: [gdprConsentEvents.userId],
		references: [users.id]
	}),
}));

export const gdprConsentsRelations = relations(gdprConsents, ({one}) => ({
	user: one(users, {
		fields: [gdprConsents.userId],
		references: [users.id]
	}),
}));

export const gdprDataExportsRelations = relations(gdprDataExports, ({one}) => ({
	user: one(users, {
		fields: [gdprDataExports.userId],
		references: [users.id]
	}),
}));

export const lpDomainMetricsRelations = relations(lpDomainMetrics, ({one}) => ({
	lpMarketplaceDomain: one(lpMarketplaceDomains, {
		fields: [lpDomainMetrics.domainId],
		references: [lpMarketplaceDomains.id]
	}),
}));

export const lpDomainInfoRelations = relations(lpDomainInfo, ({one}) => ({
	lpMarketplaceDomain: one(lpMarketplaceDomains, {
		fields: [lpDomainInfo.domainId],
		references: [lpMarketplaceDomains.id]
	}),
}));

export const favoritesRelations = relations(favorites, ({one}) => ({
	user: one(users, {
		fields: [favorites.userId],
		references: [users.id]
	}),
	domain: one(domains, {
		fields: [favorites.domainId],
		references: [domains.id]
	}),
}));

export const domainsRelations = relations(domains, ({many}) => ({
	favorites: many(favorites),
	marketplacePriceHistories: many(marketplacePriceHistory),
	marketplaceClicks: many(marketplaceClicks),
	marketplaceOffers: many(marketplaceOffers),
	supplierOffers: many(supplierOffers),
}));

export const linkMonitorsRelations = relations(linkMonitors, ({one, many}) => ({
	order: one(orders, {
		fields: [linkMonitors.orderId],
		references: [orders.id]
	}),
	user: one(users, {
		fields: [linkMonitors.userId],
		references: [users.id]
	}),
	linkMonitoringChecks: many(linkMonitoringChecks),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	linkMonitors: many(linkMonitors),
	user: one(users, {
		fields: [orders.userId],
		references: [users.id]
	}),
	company: one(companies, {
		fields: [orders.companyId],
		references: [companies.id]
	}),
}));

export const marketplacePriceHistoryRelations = relations(marketplacePriceHistory, ({one}) => ({
	domain: one(domains, {
		fields: [marketplacePriceHistory.domainId],
		references: [domains.id]
	}),
}));

export const companiesRelations = relations(companies, ({many}) => ({
	orders: many(orders),
	users: many(users),
}));

export const onboardingResponsesRelations = relations(onboardingResponses, ({one}) => ({
	user: one(users, {
		fields: [onboardingResponses.userId],
		references: [users.id]
	}),
}));

export const passkeyCredentialsRelations = relations(passkeyCredentials, ({one}) => ({
	user: one(users, {
		fields: [passkeyCredentials.userId],
		references: [users.id]
	}),
}));

export const marketplaceClicksRelations = relations(marketplaceClicks, ({one}) => ({
	user: one(users, {
		fields: [marketplaceClicks.userId],
		references: [users.id]
	}),
	domain: one(domains, {
		fields: [marketplaceClicks.domainId],
		references: [domains.id]
	}),
}));

export const userActivityEventsRelations = relations(userActivityEvents, ({one}) => ({
	user: one(users, {
		fields: [userActivityEvents.userId],
		references: [users.id]
	}),
}));

export const linkMonitoringChecksRelations = relations(linkMonitoringChecks, ({one}) => ({
	linkMonitor: one(linkMonitors, {
		fields: [linkMonitoringChecks.linkMonitorId],
		references: [linkMonitors.id]
	}),
}));

export const oauthAccountsRelations = relations(oauthAccounts, ({one}) => ({
	user: one(users, {
		fields: [oauthAccounts.userId],
		references: [users.id]
	}),
}));

export const marketplaceOffersRelations = relations(marketplaceOffers, ({one}) => ({
	domain: one(domains, {
		fields: [marketplaceOffers.domainId],
		references: [domains.id]
	}),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({one}) => ({
	user: one(users, {
		fields: [passwordResetTokens.userId],
		references: [users.id]
	}),
}));

export const supportTicketsRelations = relations(supportTickets, ({one}) => ({
	user: one(users, {
		fields: [supportTickets.userId],
		references: [users.id]
	}),
}));

export const supplierInvitationsRelations = relations(supplierInvitations, ({one}) => ({
	user_clientUserId: one(users, {
		fields: [supplierInvitations.clientUserId],
		references: [users.id],
		relationName: "supplierInvitations_clientUserId_users_id"
	}),
	user_vendorUserId: one(users, {
		fields: [supplierInvitations.vendorUserId],
		references: [users.id],
		relationName: "supplierInvitations_vendorUserId_users_id"
	}),
}));

export const supplierOffersRelations = relations(supplierOffers, ({one}) => ({
	user: one(users, {
		fields: [supplierOffers.vendorUserId],
		references: [users.id]
	}),
	domain: one(domains, {
		fields: [supplierOffers.domainId],
		references: [domains.id]
	}),
}));

export const apiBillingLedgerRelations = relations(apiBillingLedger, ({one}) => ({
	apiOrder: one(apiOrders, {
		fields: [apiBillingLedger.orderId],
		references: [apiOrders.id]
	}),
	apiClient: one(apiClients, {
		fields: [apiBillingLedger.clientId],
		references: [apiClients.id]
	}),
}));

export const apiOrdersRelations = relations(apiOrders, ({one, many}) => ({
	apiBillingLedgers: many(apiBillingLedger),
	apiPriceNotifications: many(apiPriceNotifications),
	apiClient: one(apiClients, {
		fields: [apiOrders.clientId],
		references: [apiClients.id]
	}),
}));

export const apiClientsRelations = relations(apiClients, ({many}) => ({
	apiBillingLedgers: many(apiBillingLedger),
	agencyDbUsers: many(agencyDbUsers),
	apiPriceNotifications: many(apiPriceNotifications),
	apiCuratedDomains: many(apiCuratedDomains),
	apiOrders: many(apiOrders),
}));

export const agencyDbUsersRelations = relations(agencyDbUsers, ({one}) => ({
	apiClient: one(apiClients, {
		fields: [agencyDbUsers.clientId],
		references: [apiClients.id]
	}),
}));

export const apiPriceNotificationsRelations = relations(apiPriceNotifications, ({one}) => ({
	apiOrder: one(apiOrders, {
		fields: [apiPriceNotifications.orderId],
		references: [apiOrders.id]
	}),
	apiClient: one(apiClients, {
		fields: [apiPriceNotifications.clientId],
		references: [apiClients.id]
	}),
}));

export const apiCuratedDomainsRelations = relations(apiCuratedDomains, ({one}) => ({
	apiClient: one(apiClients, {
		fields: [apiCuratedDomains.clientId],
		references: [apiClients.id]
	}),
}));