import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull(),
  displayName: text("display_name").notNull(),
  playerId: text("player_id").notNull(),
  photoKey: text("photo_key").notNull(),
  passwordSalt: text("password_salt").notNull(),
  passwordHash: text("password_hash").notNull(),
  firstLogin: integer("first_login", { mode: "boolean" }).notNull().default(true),
  status: text("status").notNull().default("active"),
  joinedAt: text("joined_at").notNull(),
}, (table) => [
  uniqueIndex("idx_members_phone").on(table.phone),
  uniqueIndex("idx_members_player_id").on(table.playerId),
]);

export const ticketOrders = sqliteTable("ticket_orders", {
  id: text("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull(),
  businessDate: text("business_date").notNull(),
  purchasedAt: text("purchased_at").notNull(),
  quantity: integer("quantity").notNull(),
  totalAmount: integer("total_amount").notNull(),
  paymentStatus: text("payment_status").notNull(),
}, (table) => [uniqueIndex("idx_ticket_orders_idempotency").on(table.idempotencyKey)]);

export const dayPasses = sqliteTable("day_passes", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => ticketOrders.id),
  memberId: text("member_id").notNull().references(() => members.id),
  businessDate: text("business_date").notNull(),
  purchasedAt: text("purchased_at").notNull(),
  ticketNumber: text("ticket_number").notNull(),
  status: text("status").notNull(),
  membershipCreated: integer("membership_created", { mode: "boolean" }).notNull().default(false),
}, (table) => [
  uniqueIndex("idx_day_passes_ticket_number").on(table.ticketNumber),
  index("idx_day_passes_member_date").on(table.memberId, table.businessDate),
]);

export const competitionResultSubmissions = sqliteTable("competition_result_submissions", {
  id: text("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull(),
  memberId: text("member_id").notNull().references(() => members.id),
  playerIdSnapshot: text("player_id_snapshot").notNull(),
  displayNameSnapshot: text("display_name_snapshot").notNull(),
  opponentPlayerId: text("opponent_player_id"),
  staffCode: text("staff_code").notNull(),
  discipline: text("discipline").notNull(),
  outcome: text("outcome").notNull(),
  playerScore: integer("player_score").notNull(),
  opponentScore: integer("opponent_score").notNull(),
  status: text("status").notNull(),
  businessDate: text("business_date").notNull(),
  submittedAt: text("submitted_at").notNull(),
}, (table) => [
  uniqueIndex("idx_result_submissions_idempotency").on(table.idempotencyKey),
  index("idx_result_submissions_member_date").on(table.memberId, table.businessDate),
  index("idx_result_submissions_staff_date").on(table.staffCode, table.businessDate),
]);

export const resultReviews = sqliteTable("result_reviews", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => competitionResultSubmissions.id),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  actorCode: text("actor_code").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_result_reviews_submission").on(table.submissionId, table.createdAt)]);

export const pointLedgerEntries = sqliteTable("point_ledger_entries", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id),
  submissionId: text("submission_id").references(() => competitionResultSubmissions.id),
  accountType: text("account_type").notNull(),
  pointType: text("point_type").notNull(),
  points: integer("points").notNull(),
  businessDate: text("business_date").notNull(),
  createdAt: text("created_at").notNull(),
  reversalOf: text("reversal_of"),
}, (table) => [
  uniqueIndex("idx_point_ledger_source_account").on(table.submissionId, table.accountType, table.pointType),
  index("idx_point_ledger_member_date").on(table.memberId, table.businessDate),
]);

export const adminStaff = sqliteTable("admin_staff", {
  id: text("id").primaryKey(),
  staffCode: text("staff_code").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("idx_admin_staff_code").on(table.staffCode)]);

export const adminCompetitions = sqliteTable("admin_competitions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  discipline: text("discipline").notNull(),
  startsAt: text("starts_at").notNull(),
  capacity: integer("capacity").notNull(),
  entryFee: integer("entry_fee").notNull(),
  status: text("status").notNull(),
  rulesetVersion: text("ruleset_version").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_admin_competitions_start").on(table.startsAt, table.status)]);

export const competitionRegistrations = sqliteTable("competition_registrations", {
  id: text("id").primaryKey(),
  competitionId: text("competition_id").notNull().references(() => adminCompetitions.id),
  memberId: text("member_id").notNull().references(() => members.id),
  status: text("status").notNull(),
  paidAmount: integer("paid_amount").notNull(),
  registeredAt: text("registered_at").notNull(),
  checkedInAt: text("checked_in_at"),
}, (table) => [
  uniqueIndex("idx_competition_registration_member").on(table.competitionId, table.memberId),
  index("idx_competition_registration_status").on(table.competitionId, table.status),
]);

export const venueTables = sqliteTable("venue_tables", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  tableType: text("table_type").notNull(),
  status: text("status").notNull(),
  currentPlayer: text("current_player"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("idx_venue_tables_label").on(table.label)]);

export const adminQueueTickets = sqliteTable("admin_queue_tickets", {
  id: text("id").primaryKey(),
  memberId: text("member_id").references(() => members.id),
  displayName: text("display_name").notNull(),
  queueType: text("queue_type").notNull(),
  discipline: text("discipline").notNull(),
  position: integer("position").notNull(),
  status: text("status").notNull(),
  tableId: text("table_id").references(() => venueTables.id),
  joinedAt: text("joined_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_admin_queue_status_position").on(table.status, table.position)]);

export const rewardPoolEntries = sqliteTable("reward_pool_entries", {
  id: text("id").primaryKey(),
  period: text("period").notNull(),
  entryType: text("entry_type").notNull(),
  amount: integer("amount").notNull(),
  sourceRef: text("source_ref").notNull(),
  reason: text("reason").notNull(),
  actorCode: text("actor_code").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("idx_reward_pool_source").on(table.sourceRef),
  index("idx_reward_pool_period").on(table.period, table.createdAt),
]);

export const adminNews = sqliteTable("admin_news", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  status: text("status").notNull(),
  priority: integer("priority").notNull().default(0),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_admin_news_status_priority").on(table.status, table.priority)]);

export const systemSettings = sqliteTable("system_settings", {
  settingKey: text("setting_key").primaryKey(),
  settingValue: text("setting_value").notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
});

export const riskFlags = sqliteTable("risk_flags", {
  id: text("id").primaryKey(),
  flagType: text("flag_type").notNull(),
  severity: text("severity").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  summary: text("summary").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_risk_flags_status_severity").on(table.status, table.severity)]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  actorCode: text("actor_code").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_audit_events_created").on(table.createdAt, table.actorCode)]);
