import { getBangkokCalendarDate } from "@/lib/member-access";
import { BATTLE_LOSS_POINTS, BATTLE_WIN_POINTS } from "@/lib/battle-queue";
import type { AdminActionResponse } from "@/lib/admin-types";
import { getAdminDashboardData } from "@/lib/server/admin-data";
import { getNextAvailableBattleCreditOrder } from "@/lib/server/battle-queue";
import { getMemberStorage, type PreparedStatement } from "@/lib/server/member-storage";

export const dynamic = "force-dynamic";

const ADMIN_ACTOR = "ADMIN-OWNER";
const STAFF_ROLES = new Set(["reception", "referee", "organizer", "manager", "admin"]);
const COMPETITION_STATUSES = new Set(["draft", "registration_open", "locked", "active", "completed", "cancelled"]);
const QUEUE_STATUSES = new Set(["waiting", "called", "assigned", "playing", "completed", "cancelled", "no_show"]);
const TABLE_STATUSES = new Set(["available", "occupied", "maintenance"]);
const RISK_STATUSES = new Set(["open", "investigating", "cleared", "confirmed", "appealed", "closed"]);

type AdminActionBody = {
  action?: string;
  id?: string;
  reason?: string;
  decision?: string;
  status?: string;
  staffCode?: string;
  displayName?: string;
  role?: string;
  name?: string;
  discipline?: string;
  startsAt?: string;
  capacity?: number;
  entryFee?: number;
  rulesetVersion?: string;
  playerId?: string;
  queueType?: string;
  tableId?: string;
  currentPlayer?: string;
  rewardType?: string;
  grossSales?: number;
  amount?: number;
  sourceRef?: string;
  title?: string;
  summary?: string;
  priority?: number;
  settingKey?: string;
  settingValue?: string;
};

function clean(value: unknown, max = 160) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function requireReason(value: unknown) {
  const reason = clean(value, 300);
  return reason.length >= 3 ? reason : null;
}

function auditStatement(db: ReturnType<typeof getMemberStorage>["db"], action: string, targetType: string, targetId: string, reason: string, before: unknown, after: unknown, createdAt: string) {
  return db.prepare("INSERT INTO audit_events (id, actor_code, action, target_type, target_id, before_json, after_json, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), ADMIN_ACTOR, action, targetType, targetId, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after), reason, createdAt);
}

function ok(message: string) {
  return Response.json({ ok: true, message } satisfies AdminActionResponse);
}

function bad(error: string, status = 400) {
  return Response.json({ error } satisfies AdminActionResponse, { status });
}

export async function GET() {
  return Response.json(await getAdminDashboardData(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as AdminActionBody | null;
  const action = clean(body?.action, 40);
  const now = new Date();
  const createdAt = now.toISOString();
  const { db } = getMemberStorage();

  if (!action) return bad("ไม่พบคำสั่ง Admin");

  try {
    if (action === "review-result") {
      const id = clean(body?.id, 80);
      const decision = body?.decision === "confirm" ? "confirm" : body?.decision === "reject" ? "reject" : "";
      const reason = requireReason(body?.reason);
      if (!id || !decision || !reason) return bad("กรุณาเลือกผลและระบุเหตุผลอย่างน้อย 3 ตัวอักษร");
      const result = await db.prepare("SELECT id, member_id, player_id_snapshot, opponent_player_id, discipline, status, outcome, business_date FROM competition_result_submissions WHERE id = ? LIMIT 1").bind(id).first<{ id: string; member_id: string; player_id_snapshot: string; opponent_player_id: string | null; discipline: string; status: string; outcome: string; business_date: string }>();
      if (!result) return bad("ไม่พบผลการแข่งขันนี้", 404);
      if (result.status !== "result_submitted") return bad("ผลการแข่งขันนี้ถูกตรวจสอบแล้ว", 409);

      const opponent = result.opponent_player_id ? await db.prepare("SELECT id, player_id, display_name FROM members WHERE player_id = ? AND status = 'active' LIMIT 1").bind(result.opponent_player_id).first<{ id: string; player_id: string; display_name: string }>() : null;
      const battleTickets = opponent ? (await db.prepare(`SELECT id, member_id, display_name, table_id, discipline FROM admin_queue_tickets
        WHERE queue_type = 'battle' AND status = 'playing' AND member_id IN (?, ?) ORDER BY joined_at ASC`).bind(result.member_id, opponent.id).all<{ id: string; member_id: string; display_name: string; table_id: string; discipline: string }>()).results : [];
      const submittedTicket = battleTickets.find((ticket) => ticket.member_id === result.member_id);
      const opponentTicket = opponent ? battleTickets.find((ticket) => ticket.member_id === opponent.id) : null;
      const isRankedBattle = Boolean(submittedTicket?.table_id && submittedTicket.table_id === opponentTicket?.table_id && submittedTicket.discipline === result.discipline);
      const nextStatus = decision === "confirm" ? "confirmed" : "rejected";
      const statements: PreparedStatement[] = [
        db.prepare("UPDATE competition_result_submissions SET status = ? WHERE id = ? AND status = 'result_submitted'").bind(nextStatus, id),
        db.prepare("INSERT INTO result_reviews (id, submission_id, action, reason, actor_code, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), id, decision, reason, ADMIN_ACTOR, createdAt),
        auditStatement(db, `result.${decision}`, "competition_result", id, reason, { status: result.status }, { status: nextStatus }, createdAt),
      ];
      if (decision === "confirm" && isRankedBattle && opponent && submittedTicket && opponentTicket) {
        const winnerMemberId = result.outcome === "win" ? result.member_id : opponent.id;
        const loserMemberId = result.outcome === "win" ? opponent.id : result.member_id;
        const winnerTicket = result.outcome === "win" ? submittedTicket : opponentTicket;
        const loserTicket = result.outcome === "win" ? opponentTicket : submittedTicket;
        const [winnerCredit, loserCredit, nextWaiting] = await Promise.all([
          getNextAvailableBattleCreditOrder(db, winnerMemberId, now),
          getNextAvailableBattleCreditOrder(db, loserMemberId, now),
          db.prepare(`SELECT id, member_id, display_name FROM admin_queue_tickets
            WHERE queue_type = 'battle' AND discipline = ? AND status = 'waiting' ORDER BY position ASC, joined_at ASC LIMIT 1`).bind(result.discipline).first<{ id: string; member_id: string; display_name: string }>(),
        ]);
        if (!winnerCredit || !loserCredit) return bad("ผู้แข่งขันอย่างน้อยหนึ่งคนไม่มีบัตรแข่งที่ยังใช้ได้ จึงยังยืนยันผลไม่ได้", 409);

        for (const accountType of ["monthly", "lifetime"]) {
          statements.push(
            db.prepare("INSERT INTO point_ledger_entries (id, member_id, submission_id, account_type, point_type, points, business_date, created_at, reversal_of) VALUES (?, ?, ?, ?, 'ranked_battle_win', ?, ?, ?, NULL)")
              .bind(crypto.randomUUID(), winnerMemberId, id, accountType, BATTLE_WIN_POINTS, result.business_date, createdAt),
            db.prepare("INSERT INTO point_ledger_entries (id, member_id, submission_id, account_type, point_type, points, business_date, created_at, reversal_of) VALUES (?, ?, ?, ?, 'ranked_battle_loss', ?, ?, ?, NULL)")
              .bind(crypto.randomUUID(), loserMemberId, id, accountType, BATTLE_LOSS_POINTS, result.business_date, createdAt),
          );
        }
        statements.push(
          db.prepare("INSERT INTO battle_game_credit_ledger (id, member_id, order_id, delta_games, entry_type, source_ref, created_at) VALUES (?, ?, ?, -1, 'ranked_battle_match', ?, ?)")
            .bind(crypto.randomUUID(), winnerMemberId, winnerCredit.orderId, `ranked-result:${id}:${winnerMemberId}`, createdAt),
          db.prepare("INSERT INTO battle_game_credit_ledger (id, member_id, order_id, delta_games, entry_type, source_ref, created_at) VALUES (?, ?, ?, -1, 'ranked_battle_match', ?, ?)")
            .bind(crypto.randomUUID(), loserMemberId, loserCredit.orderId, `ranked-result:${id}:${loserMemberId}`, createdAt),
          db.prepare("UPDATE admin_queue_tickets SET status = 'completed', updated_at = ? WHERE id = ? AND status = 'playing'").bind(createdAt, loserTicket.id),
        );
        if (nextWaiting) {
          statements.push(
            db.prepare("UPDATE admin_queue_tickets SET status = 'playing', table_id = ?, updated_at = ? WHERE id = ? AND status = 'waiting'").bind(winnerTicket.table_id, createdAt, nextWaiting.id),
            db.prepare("UPDATE venue_tables SET status = 'occupied', current_player = ?, updated_at = ? WHERE id = ?").bind(`${winnerTicket.display_name} vs ${nextWaiting.display_name}`, createdAt, winnerTicket.table_id),
          );
        } else {
          statements.push(
            db.prepare("UPDATE admin_queue_tickets SET status = 'assigned', updated_at = ? WHERE id = ? AND status = 'playing'").bind(createdAt, winnerTicket.id),
            db.prepare("UPDATE venue_tables SET status = 'occupied', current_player = ?, updated_at = ? WHERE id = ?").bind(winnerTicket.display_name, createdAt, winnerTicket.table_id),
          );
        }
        statements.push(auditStatement(db, "ranked_battle.confirm", "queue_match", winnerTicket.table_id, reason, { submissionId: id }, {
          winnerMemberId,
          loserMemberId,
          winnerPoints: BATTLE_WIN_POINTS,
          loserPoints: BATTLE_LOSS_POINTS,
          nextPlayerMemberId: nextWaiting?.member_id ?? null,
        }, createdAt));
      } else if (decision === "confirm" && result.outcome === "win") {
        for (const accountType of ["monthly", "lifetime"]) {
          statements.push(db.prepare("INSERT INTO point_ledger_entries (id, member_id, submission_id, account_type, point_type, points, business_date, created_at, reversal_of) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)")
            .bind(crypto.randomUUID(), result.member_id, id, accountType, "confirmed_match_win", 3, result.business_date, createdAt));
        }
      }
      await db.batch(statements);
      if (decision === "reject") return ok("ปฏิเสธผลการแข่งขันแล้ว");
      return ok(isRankedBattle ? `ยืนยันผลแล้ว ผู้ชนะ +${BATTLE_WIN_POINTS} ผู้แพ้ +${BATTLE_LOSS_POINTS} และผู้ชนะอยู่ต่อ` : "ยืนยันผลและบันทึกคะแนนแล้ว");
    }

    if (action === "member-status") {
      const id = clean(body?.id, 80);
      const status = body?.status === "blocked" ? "blocked" : body?.status === "active" ? "active" : "";
      const reason = requireReason(body?.reason);
      if (!id || !status || !reason) return bad("กรุณาระบุสถานะและเหตุผล");
      const member = await db.prepare("SELECT id, status FROM members WHERE id = ? LIMIT 1").bind(id).first<{ id: string; status: string }>();
      if (!member) return bad("ไม่พบสมาชิก", 404);
      await db.batch([
        db.prepare("UPDATE members SET status = ? WHERE id = ?").bind(status, id),
        auditStatement(db, "member.status", "member", id, reason, { status: member.status }, { status }, createdAt),
      ]);
      return ok(status === "active" ? "เปิดใช้งานสมาชิกแล้ว" : "ระงับสมาชิกแล้ว");
    }

    if (action === "staff-save") {
      const staffCode = clean(body?.staffCode, 20).toUpperCase().replace(/\s+/g, "");
      const displayName = clean(body?.displayName, 80);
      const role = clean(body?.role, 30);
      const status = body?.status === "inactive" ? "inactive" : "active";
      if (!/^[A-Z0-9-]{3,20}$/.test(staffCode) || !displayName || !STAFF_ROLES.has(role)) return bad("ข้อมูลพนักงานไม่ครบหรือรหัสไม่ถูกต้อง");
      const existing = await db.prepare("SELECT id, display_name, role, status FROM admin_staff WHERE staff_code = ? LIMIT 1").bind(staffCode).first<{ id: string; display_name: string; role: string; status: string }>();
      const id = existing?.id ?? crypto.randomUUID();
      const reason = existing ? "ปรับปรุงข้อมูลพนักงาน" : "เพิ่มพนักงานเข้าระบบ";
      await db.batch([
        existing
          ? db.prepare("UPDATE admin_staff SET display_name = ?, role = ?, status = ?, updated_at = ? WHERE id = ?").bind(displayName, role, status, createdAt, id)
          : db.prepare("INSERT INTO admin_staff (id, staff_code, display_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, staffCode, displayName, role, status, createdAt, createdAt),
        auditStatement(db, existing ? "staff.update" : "staff.create", "staff", id, reason, existing, { staffCode, displayName, role, status }, createdAt),
      ]);
      return ok(existing ? "ปรับปรุงข้อมูลพนักงานแล้ว" : "เพิ่มพนักงานแล้ว รหัสพร้อมใช้บันทึกผลแข่ง");
    }

    if (action === "competition-create") {
      const name = clean(body?.name, 120);
      const discipline = body?.discipline === "9-ball" ? "9-ball" : body?.discipline === "8-ball" ? "8-ball" : "";
      const startsAt = clean(body?.startsAt, 40);
      const capacity = Number(body?.capacity);
      const entryFee = Number(body?.entryFee);
      const rulesetVersion = clean(body?.rulesetVersion, 40) || "PB-RULES-1";
      if (!name || !discipline || !startsAt || !Number.isInteger(capacity) || capacity < 4 || capacity > 256 || !Number.isInteger(entryFee) || entryFee < 0) return bad("ข้อมูลการแข่งขันไม่ครบถ้วน");
      const id = crypto.randomUUID();
      await db.batch([
        db.prepare("INSERT INTO admin_competitions (id, name, discipline, starts_at, capacity, entry_fee, status, ruleset_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)").bind(id, name, discipline, startsAt, capacity, entryFee, rulesetVersion, createdAt, createdAt),
        auditStatement(db, "competition.create", "competition", id, "สร้างรายการแข่งขัน", null, { name, discipline, startsAt, capacity, entryFee, rulesetVersion }, createdAt),
      ]);
      return ok("สร้างรายการแข่งขันฉบับร่างแล้ว");
    }

    if (action === "competition-status") {
      const id = clean(body?.id, 80);
      const status = clean(body?.status, 30);
      const reason = requireReason(body?.reason) ?? "เปลี่ยนสถานะตามขั้นตอนการแข่งขัน";
      if (!id || !COMPETITION_STATUSES.has(status)) return bad("สถานะการแข่งขันไม่ถูกต้อง");
      const competition = await db.prepare("SELECT id, status FROM admin_competitions WHERE id = ? LIMIT 1").bind(id).first<{ id: string; status: string }>();
      if (!competition) return bad("ไม่พบรายการแข่งขัน", 404);
      await db.batch([
        db.prepare("UPDATE admin_competitions SET status = ?, updated_at = ? WHERE id = ?").bind(status, createdAt, id),
        auditStatement(db, "competition.status", "competition", id, reason, { status: competition.status }, { status }, createdAt),
      ]);
      return ok("เปลี่ยนสถานะการแข่งขันแล้ว");
    }

    if (action === "queue-create") {
      const playerId = clean(body?.playerId, 24).toUpperCase().replace(/\s+/g, "");
      const queueType = body?.queueType === "battle" ? "battle" : "casual";
      const discipline = body?.discipline === "9-ball" ? "9-ball" : "8-ball";
      let memberId: string | null = null;
      let displayName = clean(body?.displayName, 80);
      if (playerId) {
        const member = await db.prepare("SELECT id, display_name, status FROM members WHERE player_id = ? LIMIT 1").bind(playerId).first<{ id: string; display_name: string; status: string }>();
        if (!member || member.status !== "active") return bad("ไม่พบสมาชิกที่ใช้งานได้จาก Player ID นี้", 404);
        memberId = member.id;
        displayName = member.display_name;
      }
      if (!displayName) return bad("กรุณากรอก Player ID หรือชื่อผู้เล่น");
      const positionRow = await db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM admin_queue_tickets WHERE status IN ('waiting','called')").first<{ next_position: number }>();
      const id = crypto.randomUUID();
      const position = Number(positionRow?.next_position ?? 1);
      await db.batch([
        db.prepare("INSERT INTO admin_queue_tickets (id, member_id, display_name, queue_type, discipline, position, status, table_id, joined_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'waiting', NULL, ?, ?)").bind(id, memberId, displayName, queueType, discipline, position, createdAt, createdAt),
        auditStatement(db, "queue.create", "queue_ticket", id, "เพิ่มคิวโดย Admin", null, { displayName, queueType, discipline, position }, createdAt),
      ]);
      return ok(`เพิ่มคิว ${position} ให้ ${displayName} แล้ว`);
    }

    if (action === "queue-status") {
      const id = clean(body?.id, 80);
      const status = clean(body?.status, 30);
      const tableId = clean(body?.tableId, 80) || null;
      if (!id || !QUEUE_STATUSES.has(status)) return bad("สถานะคิวไม่ถูกต้อง");
      if ((status === "assigned" || status === "playing") && !tableId) return bad("กรุณาเลือกโต๊ะก่อนมอบหมายคิว");
      const queue = await db.prepare("SELECT id, status, table_id, display_name FROM admin_queue_tickets WHERE id = ? LIMIT 1").bind(id).first<{ id: string; status: string; table_id: string | null; display_name: string }>();
      if (!queue) return bad("ไม่พบคิวนี้", 404);
      const statements: PreparedStatement[] = [
        db.prepare("UPDATE admin_queue_tickets SET status = ?, table_id = ?, updated_at = ? WHERE id = ?").bind(status, tableId, createdAt, id),
        auditStatement(db, "queue.status", "queue_ticket", id, "อัปเดตสถานะคิว", { status: queue.status, tableId: queue.table_id }, { status, tableId }, createdAt),
      ];
      if (queue.table_id && queue.table_id !== tableId) statements.push(db.prepare("UPDATE venue_tables SET status = 'available', current_player = NULL, updated_at = ? WHERE id = ?").bind(createdAt, queue.table_id));
      if (tableId && (status === "assigned" || status === "playing")) statements.push(db.prepare("UPDATE venue_tables SET status = 'occupied', current_player = ?, updated_at = ? WHERE id = ?").bind(queue.display_name, createdAt, tableId));
      if (queue.table_id && ["completed", "cancelled", "no_show"].includes(status)) statements.push(db.prepare("UPDATE venue_tables SET status = 'available', current_player = NULL, updated_at = ? WHERE id = ?").bind(createdAt, queue.table_id));
      await db.batch(statements);
      return ok("อัปเดตสถานะคิวแล้ว");
    }

    if (action === "table-status") {
      const id = clean(body?.id, 80);
      const status = clean(body?.status, 30);
      const currentPlayer = clean(body?.currentPlayer, 80) || null;
      const reason = requireReason(body?.reason) ?? "ปรับสถานะโต๊ะจากหลังบ้าน";
      if (!id || !TABLE_STATUSES.has(status)) return bad("สถานะโต๊ะไม่ถูกต้อง");
      const table = await db.prepare("SELECT id, status, current_player FROM venue_tables WHERE id = ? LIMIT 1").bind(id).first<{ id: string; status: string; current_player: string | null }>();
      if (!table) return bad("ไม่พบโต๊ะ", 404);
      await db.batch([
        db.prepare("UPDATE venue_tables SET status = ?, current_player = ?, updated_at = ? WHERE id = ?").bind(status, status === "available" ? null : currentPlayer, createdAt, id),
        auditStatement(db, "table.status", "venue_table", id, reason, table, { status, currentPlayer }, createdAt),
      ]);
      return ok("อัปเดตสถานะโต๊ะแล้ว");
    }

    if (action === "reward-add") {
      const rewardType = body?.rewardType === "sponsor" ? "sponsor" : body?.rewardType === "adjustment" ? "adjustment" : "fnb_contribution";
      const sourceRef = clean(body?.sourceRef, 100);
      const reason = requireReason(body?.reason);
      const grossSales = Number(body?.grossSales);
      const requestedAmount = Number(body?.amount);
      const amount = rewardType === "fnb_contribution" ? Math.round(grossSales * 0.10) : Math.round(requestedAmount);
      if (!sourceRef || !reason || !Number.isFinite(amount) || amount === 0 || (rewardType === "fnb_contribution" && (!Number.isFinite(grossSales) || grossSales <= 0))) return bad("ข้อมูลกองรางวัลไม่ครบถ้วน");
      const period = getBangkokCalendarDate(now).slice(0, 7);
      const id = crypto.randomUUID();
      await db.batch([
        db.prepare("INSERT INTO reward_pool_entries (id, period, entry_type, amount, source_ref, reason, actor_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, period, rewardType, amount, sourceRef, reason, ADMIN_ACTOR, createdAt),
        auditStatement(db, "reward.entry", "reward_pool", id, reason, null, { period, rewardType, amount, sourceRef }, createdAt),
      ]);
      return ok(`บันทึกเข้ากองรางวัล ${amount.toLocaleString("th-TH")} บาทแล้ว`);
    }

    if (action === "news-save") {
      const title = clean(body?.title, 140);
      const summary = clean(body?.summary, 600);
      const priority = Math.max(0, Math.min(99, Math.floor(Number(body?.priority) || 0)));
      if (!title || !summary) return bad("กรุณากรอกหัวข้อและเนื้อหาข่าว");
      const id = crypto.randomUUID();
      await db.batch([
        db.prepare("INSERT INTO admin_news (id, title, summary, status, priority, published_at, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, NULL, ?, ?)").bind(id, title, summary, priority, createdAt, createdAt),
        auditStatement(db, "news.create", "news", id, "สร้างข่าวฉบับร่าง", null, { title, priority }, createdAt),
      ]);
      return ok("บันทึกข่าวฉบับร่างแล้ว");
    }

    if (action === "news-status") {
      const id = clean(body?.id, 80);
      const status = body?.status === "published" ? "published" : body?.status === "draft" ? "draft" : "";
      if (!id || !status) return bad("สถานะข่าวไม่ถูกต้อง");
      const news = await db.prepare("SELECT id, status FROM admin_news WHERE id = ? LIMIT 1").bind(id).first<{ id: string; status: string }>();
      if (!news) return bad("ไม่พบข่าว", 404);
      await db.batch([
        db.prepare("UPDATE admin_news SET status = ?, published_at = ?, updated_at = ? WHERE id = ?").bind(status, status === "published" ? createdAt : null, createdAt, id),
        auditStatement(db, "news.status", "news", id, status === "published" ? "เผยแพร่ข่าว" : "ถอนข่าวกลับเป็นฉบับร่าง", { status: news.status }, { status }, createdAt),
      ]);
      return ok(status === "published" ? "เผยแพร่ข่าวแล้ว" : "ถอนข่าวเป็นฉบับร่างแล้ว");
    }

    if (action === "risk-status") {
      const id = clean(body?.id, 80);
      const status = clean(body?.status, 30);
      const reason = requireReason(body?.reason);
      if (!id || !RISK_STATUSES.has(status) || !reason) return bad("กรุณาระบุสถานะและเหตุผลความเสี่ยง");
      const risk = await db.prepare("SELECT id, status FROM risk_flags WHERE id = ? LIMIT 1").bind(id).first<{ id: string; status: string }>();
      if (!risk) return bad("ไม่พบรายการความเสี่ยง", 404);
      await db.batch([
        db.prepare("UPDATE risk_flags SET status = ?, updated_at = ? WHERE id = ?").bind(status, createdAt, id),
        auditStatement(db, "risk.status", "risk_flag", id, reason, { status: risk.status }, { status }, createdAt),
      ]);
      return ok("อัปเดตสถานะความเสี่ยงแล้ว");
    }

    if (action === "setting-update") {
      const settingKey = clean(body?.settingKey, 60);
      const settingValue = clean(body?.settingValue, 120);
      const reason = requireReason(body?.reason);
      const allowed = new Set(["ruleset_version", "notification_queue_minutes", "venue_display_name"]);
      if (!allowed.has(settingKey) || !settingValue || !reason) return bad("การตั้งค่านี้ต้องผ่านขั้นตอนอนุมัติหรือข้อมูลไม่ครบ");
      const before = await db.prepare("SELECT setting_value, version FROM system_settings WHERE setting_key = ? LIMIT 1").bind(settingKey).first<{ setting_value: string; version: number }>();
      await db.batch([
        db.prepare(`INSERT INTO system_settings (setting_key, setting_value, version, updated_at, updated_by) VALUES (?, ?, 1, ?, ?)
          ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, version = system_settings.version + 1, updated_at = excluded.updated_at, updated_by = excluded.updated_by`).bind(settingKey, settingValue, createdAt, ADMIN_ACTOR),
        auditStatement(db, "setting.update", "system_setting", settingKey, reason, before, { settingValue }, createdAt),
      ]);
      return ok("บันทึกการตั้งค่าและสร้างเวอร์ชันใหม่แล้ว");
    }

    return bad("คำสั่ง Admin นี้ยังไม่รองรับ", 404);
  } catch (error) {
    console.error("admin action failed", { action, error });
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) return bad("ข้อมูลนี้ถูกบันทึกไปแล้ว กรุณารีเฟรช", 409);
    return bad("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองอีกครั้ง", 500);
  }
}
