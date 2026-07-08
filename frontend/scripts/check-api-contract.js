const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const edgeApi = read('supabase/functions/api/index.ts');
const karmaMigration = read('supabase/migrations/20260708130000_karma_transactions.sql');
const appVersionMigration = read('supabase/migrations/20260708131000_app_versions_admin_columns.sql');
const adminExport = read('frontend/src/components/admin/AdminExportTab.js');
const adminScorecard = read('frontend/src/components/admin/AdminScorecardTab.js');
const adminAnnouncements = read('frontend/src/components/admin/AdminAnnouncementsTab.js');
const apiClient = read('frontend/src/api/client.js');
const authContext = read('frontend/src/context/AuthContext.js');

const requiredRouteSnippets = [
  'path === "/register"',
  'path === "/token"',
  'path === "/auth/google"',
  'path === "/users/me"',
  'path === "/password/forgot"',
  'path === "/password/reset"',
  'path === "/exchange-rates"',
  'path === "/my-dogs"',
  '(path === "/dogs" || path === "/dogs/")',
  'path === "/dogs/identify"',
  'path === "/dogs/report-lost"',
  '/^\\/dogs\\/[^/]+\\/health-records$/.test(path)',
  '/^\\/dogs\\/[^/]+$/.test(path)',
  'method === "PUT" && /^\\/dogs\\/[^/]+$/.test(path)',
  'path === "/services"',
  '/^\\/services\\/[^/]+\\/form-fields$/.test(path)',
  '/^\\/services\\/[^/]+\\/responses$/.test(path)',
  '/^\\/services\\/[^/]+$/.test(path)',
  'method === "PUT" && /^\\/services\\/[^/]+$/.test(path)',
  'method === "DELETE" && /^\\/services\\/[^/]+$/.test(path)',
  'path === "/cases"',
  '/^\\/cases\\/[^/]+\\/comments$/.test(path)',
  'method === "POST" && /^\\/cases\\/[^/]+\\/like$/.test(path)',
  '/^\\/cases\\/[^/]+\\/matches$/.test(path)',
  '/^\\/cases\\/[^/]+\\/matches\\/refresh$/.test(path)',
  '/^\\/cases\\/[^/]+\\/matches\\/[^/]+$/.test(path)',
  '/^\\/cases\\/[^/]+\\/flag$/.test(path)',
  '/^\\/cases\\/[^/]+$/.test(path)',
  'path === "/events"',
  'path === "/my-registrations"',
  'path === "/saved-events"',
  '/^\\/events\\/[^/]+\\/register$/.test(path)',
  '/^\\/events\\/[^/]+\\/save$/.test(path)',
  '/^\\/events\\/[^/]+\\/form-fields$/.test(path)',
  '/^\\/events\\/[^/]+\\/responses$/.test(path)',
  '/^\\/events\\/[^/]+\\/journey$/.test(path)',
  '/^\\/events\\/[^/]+\\/sync$/.test(path)',
  '/^\\/events\\/[^/]+\\/live-log$/.test(path)',
  '/^\\/events\\/[^/]+\\/scorecard\\/surveys$/.test(path)',
  '/^\\/events\\/[^/]+$/.test(path)',
  'path === "/orders"',
  'path === "/my-orders"',
  '/^\\/orders\\/[^/]+\\/cancel$/.test(path)',
  '/^\\/orders\\/[^/]+\\/pay$/.test(path)',
  '/^\\/orders\\/[^/]+\\/receipt$/.test(path)',
  'path === "/payments/initiate"',
  '/^\\/payments\\/status\\/[^/]+$/.test(path)',
  '/^\\/event-registrations\\/[^/]+\\/payment\\/initiate$/.test(path)',
  '/^\\/event-registrations\\/[^/]+\\/payment\\/status$/.test(path)',
  'path === "/ratings"',
  '/^\\/users\\/[^/]+\\/ratings$/.test(path)',
  'path === "/wallet/summary"',
  'path === "/my-earnings"',
  'path === "/withdrawals/request"',
  'path === "/withdrawals"',
  'path === "/support"',
  'path === "/announcements"',
  'path === "/notifications"',
  '/^\\/notifications\\/[^/]+\\/read$/.test(path)',
  'path === "/spotlight"',
  'path === "/chat/global"',
  'path === "/chat/nearby"',
  'path === "/chat/message"',
  'path === "/chat/trending-tags"',
  '/^\\/chat\\/messages\\/[^/]+\\/flag$/.test(path)',
  '/^\\/chat\\/messages\\/[^/]+\\/react$/.test(path)',
  '/^\\/chat\\/messages\\/[^/]+\\/vote$/.test(path)',
  '(path === "/chat/dms" || path === "/chat/dm")',
  '/^\\/chat\\/dms\\/[^/]+\\/read$/.test(path)',
  'path === "/users/status/heartbeat"',
  'path === "/users/online"',
  '/^\\/users\\/[^/]+\\/block$/.test(path)',
  'path === "/users/search"',
  'path === "/health/summary"',
  'path === "/health/wellness-score"',
  '/^\\/health\\/advisor\\/[^/]+$/.test(path)',
  'path === "/scorecard/questions"',
  'path === "/app/version/latest"',
  'path === "/app/version"',
  '/^\\/app\\/version\\/[^/]+$/.test(path)',
  'path === "/admin/analytics"',
  'path === "/admin/stats"',
  'path === "/admin/users"',
  'method === "POST" && path === "/admin/users"',
  '/^\\/admin\\/users\\/[^/]+\\/role$/.test(path)',
  '/^\\/admin\\/users\\/[^/]+\\/suspend$/.test(path)',
  '/^\\/admin\\/users\\/[^/]+\\/unsuspend$/.test(path)',
  'path === "/admin/orders"',
  '/^\\/admin\\/orders\\/[^/]+\\/complete$/.test(path)',
  '/^\\/admin\\/orders\\/[^/]+\\/settle$/.test(path)',
  'path === "/admin/withdrawals"',
  '/^\\/admin\\/withdrawals\\/[^/]+\\/complete$/.test(path)',
  'path === "/admin/services"',
  '/^\\/admin\\/services\\/[^/]+$/.test(path)',
  'path === "/admin/pending-approvals"',
  '/^\\/admin\\/approve\\/[^/]+\\/[^/]+$/.test(path)',
  '/^\\/admin\\/cases\\/[^/]+$/.test(path)',
  'path === "/admin/dogs"',
  '/^\\/admin\\/dogs\\/[^/]+$/.test(path)',
  'path === "/admin/events"',
  '/^\\/admin\\/events\\/[^/]+$/.test(path)',
  '/^\\/admin\\/events\\/[^/]+\\/ticketing$/.test(path)',
  '/^\\/admin\\/events\\/[^/]+\\/schedule$/.test(path)',
  '/^\\/admin\\/events\\/[^/]+\\/scorecard-settings$/.test(path)',
  'path === "/admin/verify-ticket"',
  'path === "/admin/check-in-ticket"',
  'path === "/admin/support-tickets"',
  '/^\\/admin\\/support-tickets\\/[^/]+\\/reply$/.test(path)',
  '/^\\/admin\\/support-tickets\\/[^/]+\\/resolve$/.test(path)',
  'path === "/admin/community"',
  '/^\\/admin\\/community\\/[^/]+\\/hide$/.test(path)',
  'method === "DELETE" && /^\\/admin\\/community\\/[^/]+$/.test(path)',
  'path === "/admin/pinnable-content"',
  'path === "/admin/pins"',
  '/^\\/admin\\/pins\\/[^/]+\\/[^/]+$/.test(path)',
  'path === "/admin/notification-target-options"',
  'path === "/admin/notification-campaigns"',
  'path === "/admin/notification-campaigns/preview"',
  'path === "/admin/notification-campaigns/send"',
  'path === "/admin/scorecard/events"',
  '/^\\/admin\\/scorecard\\/[^/]+\\/dashboard$/.test(path)',
  '/^\\/admin\\/scorecard\\/[^/]+\\/prompt-followup$/.test(path)',
  '/^\\/admin\\/scorecard\\/[^/]+\\/evidence$/.test(path)',
  '/^\\/admin\\/scorecard\\/[^/]+\\/reporting$/.test(path)',
  'path === "/admin/export"',
];

const failures = [];

for (const snippet of requiredRouteSnippets) {
  if (!edgeApi.includes(snippet)) {
    failures.push(`Missing Supabase route contract: ${snippet}`);
  }
}

if (!edgeApi.includes('is_published: isApproved')) {
  failures.push('Service approval must publish approved listings and unpublish rejected listings.');
}

for (const snippet of ['auth.admin.updateUserById', 'delete nextAppMetadata.role', 'trustedAdminRoles.has(cleanString(role))']) {
  if (!edgeApi.includes(snippet)) {
    failures.push(`Missing role metadata synchronization behavior: ${snippet}`);
  }
}

for (const snippet of ['restoreExpiredSuspension', 'requireActiveProfile', 'Account suspended until', 'Account deleted']) {
  if (!edgeApi.includes(snippet)) {
    failures.push(`Missing suspended/deleted account enforcement: ${snippet}`);
  }
}

for (const snippet of ['calculateKarmaRedemption', 'body.karma_points_to_redeem', 'awardKarma']) {
  if (!edgeApi.includes(snippet)) {
    failures.push(`Missing karma migration behavior: ${snippet}`);
  }
}

for (const snippet of [
  'filters.registration_status',
  'targetGroup === "case_reporters"',
  'targetGroup === "listing_publishers"',
  'targetGroup === "product_publishers"',
  'targetGroup === "sellers_with_sales"',
  'Unsupported notification target group',
  'ticket_tiers: asArray(event.ticket_tiers)',
  'available_slots: asArray(event.available_slots)',
]) {
  if (!edgeApi.includes(snippet)) {
    failures.push(`Missing admin broadcast targeting behavior: ${snippet}`);
  }
}

for (const snippet of ["typeof item === 'string'", 'const id = optionValue(item)']) {
  if (!adminAnnouncements.includes(snippet)) {
    failures.push(`Admin broadcast filters must support string and object options: ${snippet}`);
  }
}

if (!apiClient.includes("detail.includes('account suspended')")) {
  failures.push('API client must treat suspended accounts as session-ending responses.');
}

if (!authContext.includes("detail.includes('account suspended')")) {
  failures.push('Auth context must clear suspended sessions during profile refresh.');
}

if (!karmaMigration.includes('create table if not exists public.karma_transactions')) {
  failures.push('Missing karma_transactions migration.');
}

for (const snippet of ['add column if not exists download_url', 'add column if not exists updated_at']) {
  if (!appVersionMigration.includes(snippet)) {
    failures.push(`Missing app_versions admin column migration: ${snippet}`);
  }
}

for (const [label, source] of [
  ['AdminExportTab', adminExport],
  ['AdminScorecardTab', adminScorecard],
]) {
  if (source.includes("responseType: 'arraybuffer'") || source.includes('encodeBase64')) {
    failures.push(`${label} exports must use text CSV, not arraybuffer/base64 handling.`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('API migration contract check passed.');
