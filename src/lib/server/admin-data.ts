import { getBangkokCalendarDate, getBangkokPassPeriod, maskPhone } from "@/lib/member-access";
import type {
  AdminAuditEvent,
  AdminCompetition,
  AdminDashboardData,
  AdminMember,
  AdminNewsItem,
  AdminOrder,
  AdminQueueTicket,
  AdminRankingRow,
  AdminResult,
  AdminRewardEntry,
  AdminRiskFlag,
  AdminStaffMember,
  AdminSummary,
  AdminVenueTable,
} from "@/lib/admin-types";
import { getMemberStorage, memberPhotoUrl, type PreparedStatement } from "@/lib/server/member-storage";

async function allRows<T>(statement: PreparedStatement) {
  return (await statement.all<T>()).results;
}

type MemberRow = {
  id: string;
  display_name: string;
  player_id: string;
  phone: string;
  photo_key: string;
  status: "active" | "blocked";
  joined_at: string;
  monthly_points: number;
  lifetime_points: number;
};

export async function getAdminDashboardData(at = new Date()): Promise<AdminDashboardData> {
  const { db } = getMemberStorage();
  const { businessDate, startsAt, expiresAt } = getBangkokPassPeriod(at);
  const period = getBangkokCalendarDate(at).slice(0, 7);
  const startIso = startsAt.toISOString();
  const expiryIso = expiresAt.toISOString();

  const [
    summary,
    memberRows,
    orderRows,
    resultRows,
    staffRows,
    competitionRows,
    tableRows,
    queueRows,
    rankingRows,
    rewardRows,
    newsRows,
    settingRows,
    riskRows,
    auditRows,
  ] = await Promise.all([
    db.prepare(`SELECT
      (SELECT COUNT(*) FROM members) AS total_members,
      (SELECT COUNT(*) FROM members WHERE status = 'active') AS active_members,
      (SELECT COUNT(*) FROM day_passes WHERE status = 'active' AND purchased_at >= ? AND purchased_at < ?) AS active_passes,
      COALESCE((SELECT SUM(total_amount) FROM ticket_orders WHERE payment_status = 'confirmed' AND purchased_at >= ? AND purchased_at < ?), 0) AS pass_revenue,
      (SELECT COUNT(*) FROM competition_result_submissions WHERE status = 'result_submitted') AS pending_results,
      (SELECT COUNT(*) FROM admin_queue_tickets WHERE status IN ('waiting','called','assigned','playing')) AS open_queues,
      (SELECT COUNT(*) FROM venue_tables WHERE status = 'available') AS available_tables,
      COALESCE((SELECT SUM(amount) FROM reward_pool_entries WHERE period = ?), 0) AS reward_pool,
      (SELECT COUNT(*) FROM risk_flags WHERE status IN ('open','investigating','appealed')) AS open_risks`)
      .bind(startIso, expiryIso, startIso, expiryIso, period).first<{
        total_members: number;
        active_members: number;
        active_passes: number;
        pass_revenue: number;
        pending_results: number;
        open_queues: number;
        available_tables: number;
        reward_pool: number;
        open_risks: number;
      }>(),
    allRows<MemberRow>(db.prepare(`SELECT m.id, m.display_name, m.player_id, m.phone, m.photo_key, m.status, m.joined_at,
      COALESCE((SELECT SUM(points) FROM point_ledger_entries p WHERE p.member_id = m.id AND p.account_type = 'monthly' AND substr(p.business_date, 1, 7) = ?), 0) AS monthly_points,
      COALESCE((SELECT SUM(points) FROM point_ledger_entries p WHERE p.member_id = m.id AND p.account_type = 'lifetime'), 0) AS lifetime_points
      FROM members m ORDER BY m.joined_at DESC LIMIT 100`).bind(period)),
    allRows<{ id: string; purchased_at: string; quantity: number; total_amount: number; payment_status: string; business_date: string }>(
      db.prepare("SELECT id, purchased_at, quantity, total_amount, payment_status, business_date FROM ticket_orders ORDER BY purchased_at DESC LIMIT 40"),
    ),
    allRows<{ id: string; display_name_snapshot: string; player_id_snapshot: string; opponent_player_id: string | null; staff_code: string; discipline: "8-ball" | "9-ball"; outcome: "win" | "loss"; player_score: number; opponent_score: number; status: "result_submitted" | "confirmed" | "rejected"; submitted_at: string; business_date: string }>(
      db.prepare("SELECT id, display_name_snapshot, player_id_snapshot, opponent_player_id, staff_code, discipline, outcome, player_score, opponent_score, status, submitted_at, business_date FROM competition_result_submissions ORDER BY submitted_at DESC LIMIT 80"),
    ),
    allRows<{ id: string; staff_code: string; display_name: string; role: string; status: "active" | "inactive"; updated_at: string }>(
      db.prepare("SELECT id, staff_code, display_name, role, status, updated_at FROM admin_staff ORDER BY status ASC, display_name ASC"),
    ),
    allRows<{ id: string; name: string; discipline: "8-ball" | "9-ball"; starts_at: string; capacity: number; entry_fee: number; status: string; ruleset_version: string; registrations: number }>(
      db.prepare(`SELECT c.id, c.name, c.discipline, c.starts_at, c.capacity, c.entry_fee, c.status, c.ruleset_version,
        (SELECT COUNT(*) FROM competition_registrations r WHERE r.competition_id = c.id AND r.status NOT IN ('cancelled','refunded')) AS registrations
        FROM admin_competitions c ORDER BY c.starts_at DESC LIMIT 40`),
    ),
    allRows<{ id: string; label: string; table_type: string; status: "available" | "occupied" | "maintenance"; current_player: string | null; updated_at: string }>(
      db.prepare("SELECT id, label, table_type, status, current_player, updated_at FROM venue_tables ORDER BY label ASC"),
    ),
    allRows<{ id: string; display_name: string; player_id: string | null; queue_type: "casual" | "battle"; discipline: "8-ball" | "9-ball"; position: number; status: string; table_id: string | null; table_label: string | null; joined_at: string }>(
      db.prepare(`SELECT q.id, q.display_name, m.player_id, q.queue_type, q.discipline, q.position, q.status, q.table_id, t.label AS table_label, q.joined_at
        FROM admin_queue_tickets q LEFT JOIN members m ON m.id = q.member_id LEFT JOIN venue_tables t ON t.id = q.table_id
        WHERE q.status IN ('waiting','called','assigned','playing') ORDER BY q.position ASC, q.joined_at ASC LIMIT 80`),
    ),
    allRows<{ member_id: string; display_name: string; player_id: string; photo_key: string; monthly_points: number; lifetime_points: number; confirmed_wins: number; confirmed_losses: number }>(
      db.prepare(`SELECT m.id AS member_id, m.display_name, m.player_id, m.photo_key,
        COALESCE((SELECT SUM(points) FROM point_ledger_entries p WHERE p.member_id = m.id AND p.account_type = 'monthly' AND substr(p.business_date, 1, 7) = ?), 0) AS monthly_points,
        COALESCE((SELECT SUM(points) FROM point_ledger_entries p WHERE p.member_id = m.id AND p.account_type = 'lifetime'), 0) AS lifetime_points,
        (SELECT COUNT(*) FROM point_ledger_entries p WHERE p.member_id = m.id AND p.account_type = 'monthly' AND p.point_type = 'ranked_battle_win' AND substr(p.business_date, 1, 7) = ?) AS confirmed_wins,
        (SELECT COUNT(*) FROM point_ledger_entries p WHERE p.member_id = m.id AND p.account_type = 'monthly' AND p.point_type = 'ranked_battle_loss' AND substr(p.business_date, 1, 7) = ?) AS confirmed_losses
        FROM members m WHERE m.status = 'active' ORDER BY monthly_points DESC, confirmed_wins DESC, m.joined_at ASC LIMIT 50`).bind(period, period, period)),
    allRows<{ id: string; period: string; entry_type: string; amount: number; source_ref: string; reason: string; actor_code: string; created_at: string }>(
      db.prepare("SELECT id, period, entry_type, amount, source_ref, reason, actor_code, created_at FROM reward_pool_entries ORDER BY created_at DESC LIMIT 60"),
    ),
    allRows<{ id: string; title: string; summary: string; status: "draft" | "published"; priority: number; published_at: string | null; updated_at: string }>(
      db.prepare("SELECT id, title, summary, status, priority, published_at, updated_at FROM admin_news ORDER BY priority DESC, updated_at DESC LIMIT 50"),
    ),
    allRows<{ setting_key: string; setting_value: string }>(db.prepare("SELECT setting_key, setting_value FROM system_settings ORDER BY setting_key ASC")),
    allRows<{ id: string; flag_type: string; severity: "low" | "medium" | "high" | "critical"; target_type: string; target_id: string; summary: string; status: string; updated_at: string }>(
      db.prepare("SELECT id, flag_type, severity, target_type, target_id, summary, status, updated_at FROM risk_flags ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, updated_at DESC LIMIT 40"),
    ),
    allRows<{ id: string; actor_code: string; action: string; target_type: string; target_id: string; reason: string; created_at: string }>(
      db.prepare("SELECT id, actor_code, action, target_type, target_id, reason, created_at FROM audit_events ORDER BY created_at DESC LIMIT 60"),
    ),
  ]);

  const safeSummary = summary ?? {
    total_members: 0,
    active_members: 0,
    active_passes: 0,
    pass_revenue: 0,
    pending_results: 0,
    open_queues: 0,
    available_tables: 0,
    reward_pool: 0,
    open_risks: 0,
  };

  return {
    generatedAt: at.toISOString(),
    businessDate,
    period,
    passExpiresAt: expiryIso,
    summary: {
      totalMembers: Number(safeSummary.total_members),
      activeMembers: Number(safeSummary.active_members),
      activePasses: Number(safeSummary.active_passes),
      passRevenue: Number(safeSummary.pass_revenue),
      pendingResults: Number(safeSummary.pending_results),
      openQueues: Number(safeSummary.open_queues),
      availableTables: Number(safeSummary.available_tables),
      rewardPool: Number(safeSummary.reward_pool),
      openRisks: Number(safeSummary.open_risks),
    } satisfies AdminSummary,
    members: memberRows.map((row): AdminMember => ({
      id: row.id,
      displayName: row.display_name,
      playerId: row.player_id,
      maskedPhone: maskPhone(row.phone).replace(/(\d{3})-(\d{3})-(\d{4})/, "$1-***-$3"),
      photoUrl: memberPhotoUrl(row.photo_key),
      status: row.status,
      joinedAt: row.joined_at,
      monthlyPoints: Number(row.monthly_points),
      lifetimePoints: Number(row.lifetime_points),
    })),
    orders: orderRows.map((row): AdminOrder => ({ id: row.id, purchasedAt: row.purchased_at, quantity: row.quantity, totalAmount: row.total_amount, paymentStatus: row.payment_status, businessDate: row.business_date })),
    results: resultRows.map((row): AdminResult => ({ id: row.id, displayName: row.display_name_snapshot, playerId: row.player_id_snapshot, opponentPlayerId: row.opponent_player_id, staffCode: row.staff_code, discipline: row.discipline, outcome: row.outcome, playerScore: row.player_score, opponentScore: row.opponent_score, status: row.status, submittedAt: row.submitted_at, businessDate: row.business_date })),
    staff: staffRows.map((row): AdminStaffMember => ({ id: row.id, staffCode: row.staff_code, displayName: row.display_name, role: row.role, status: row.status, updatedAt: row.updated_at })),
    competitions: competitionRows.map((row): AdminCompetition => ({ id: row.id, name: row.name, discipline: row.discipline, startsAt: row.starts_at, capacity: row.capacity, entryFee: row.entry_fee, status: row.status, rulesetVersion: row.ruleset_version, registrations: row.registrations })),
    tables: tableRows.map((row): AdminVenueTable => ({ id: row.id, label: row.label, tableType: row.table_type, status: row.status, currentPlayer: row.current_player, updatedAt: row.updated_at })),
    queues: queueRows.map((row): AdminQueueTicket => ({ id: row.id, displayName: row.display_name, playerId: row.player_id, queueType: row.queue_type, discipline: row.discipline, position: row.position, status: row.status, tableId: row.table_id, tableLabel: row.table_label, joinedAt: row.joined_at })),
    ranking: rankingRows.map((row): AdminRankingRow => ({ memberId: row.member_id, displayName: row.display_name, playerId: row.player_id, photoUrl: memberPhotoUrl(row.photo_key), monthlyPoints: Number(row.monthly_points), lifetimePoints: Number(row.lifetime_points), confirmedWins: Number(row.confirmed_wins), confirmedLosses: Number(row.confirmed_losses), eligible: false })),
    rewardEntries: rewardRows.map((row): AdminRewardEntry => ({ id: row.id, period: row.period, entryType: row.entry_type, amount: row.amount, sourceRef: row.source_ref, reason: row.reason, actorCode: row.actor_code, createdAt: row.created_at })),
    news: newsRows.map((row): AdminNewsItem => ({ id: row.id, title: row.title, summary: row.summary, status: row.status, priority: row.priority, publishedAt: row.published_at, updatedAt: row.updated_at })),
    settings: Object.fromEntries(settingRows.map((row) => [row.setting_key, row.setting_value])),
    risks: riskRows.map((row): AdminRiskFlag => ({ id: row.id, flagType: row.flag_type, severity: row.severity, targetType: row.target_type, targetId: row.target_id, summary: row.summary, status: row.status, updatedAt: row.updated_at })),
    audit: auditRows.map((row): AdminAuditEvent => ({ id: row.id, actorCode: row.actor_code, action: row.action, targetType: row.target_type, targetId: row.target_id, reason: row.reason, createdAt: row.created_at })),
  };
}
