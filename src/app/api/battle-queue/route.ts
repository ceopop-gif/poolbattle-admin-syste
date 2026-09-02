import { getBangkokPassPeriod, isValidThaiMobile, normalizePhone } from "@/lib/member-access";
import { getBattleQueueSnapshot, getNextAvailableBattleCreditOrder } from "@/lib/server/battle-queue";
import { getMemberStorage, type MemberRow, type PreparedStatement } from "@/lib/server/member-storage";

export const dynamic = "force-dynamic";

type QueueActionInput = {
  action?: "join" | "cancel";
  phone?: string;
  discipline?: "8-ball" | "9-ball";
};

type ActiveTableRow = {
  table_id: string;
  table_label: string;
  discipline: "8-ball" | "9-ball";
  player_count: number;
  current_names: string;
};

function bad(error: string, status = 400) {
  return Response.json({ error }, { status });
}

async function findMember(phone: string) {
  const { db } = getMemberStorage();
  return db.prepare("SELECT * FROM members WHERE phone = ? LIMIT 1").bind(phone).first<MemberRow>();
}

export async function GET(request: Request) {
  const phone = normalizePhone(new URL(request.url).searchParams.get("phone") ?? "");
  const { db } = getMemberStorage();
  const member = isValidThaiMobile(phone) ? await findMember(phone) : null;
  return Response.json(await getBattleQueueSnapshot(db, member?.id ?? null), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as QueueActionInput | null;
  const phone = normalizePhone(body?.phone ?? "");
  const action = body?.action;
  const discipline = body?.discipline === "9-ball" ? "9-ball" : "8-ball";
  if (!isValidThaiMobile(phone) || (action !== "join" && action !== "cancel")) return bad("ข้อมูลคำขอคิวไม่ถูกต้อง");

  const { db } = getMemberStorage();
  const member = await findMember(phone);
  if (!member) return bad("ไม่พบบัญชีสมาชิก", 404);
  if (member.status !== "active") return bad("สมาชิกนี้ถูกระงับ กรุณาติดต่อ Admin", 403);

  const now = new Date();
  const createdAt = now.toISOString();
  const currentTicket = await db.prepare(`SELECT id, status, table_id, discipline FROM admin_queue_tickets
    WHERE member_id = ? AND queue_type = 'battle' AND status IN ('waiting','assigned','playing')
    ORDER BY joined_at DESC LIMIT 1`).bind(member.id).first<{ id: string; status: string; table_id: string | null; discipline: string }>();

  if (action === "cancel") {
    if (!currentTicket) return Response.json({ ...(await getBattleQueueSnapshot(db, member.id)), message: "ไม่มีคิวที่ต้องยกเลิก" });
    if (currentTicket.status === "playing") return bad("เริ่มการแข่งขันแล้ว กรุณาให้พนักงานบันทึกผลก่อน", 409);
    const statements: PreparedStatement[] = [
      db.prepare("UPDATE admin_queue_tickets SET status = 'cancelled', updated_at = ? WHERE id = ? AND status IN ('waiting','assigned')").bind(createdAt, currentTicket.id),
      db.prepare("INSERT INTO audit_events (id, actor_code, action, target_type, target_id, before_json, after_json, reason, created_at) VALUES (?, ?, 'queue.member_cancel', 'queue_ticket', ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), member.player_id, currentTicket.id, JSON.stringify({ status: currentTicket.status }), JSON.stringify({ status: "cancelled" }), "สมาชิกยกเลิกคิว Battle", createdAt),
    ];
    if (currentTicket.table_id) statements.push(db.prepare("UPDATE venue_tables SET status = 'available', current_player = NULL, updated_at = ? WHERE id = ?").bind(createdAt, currentTicket.table_id));
    await db.batch(statements);
    return Response.json({ ...(await getBattleQueueSnapshot(db, member.id)), message: "ยกเลิกคิวเล่นฟรีแล้ว" });
  }

  if (currentTicket) return Response.json({ ...(await getBattleQueueSnapshot(db, member.id)), message: "คุณมีคิวเล่นฟรีอยู่แล้ว" });
  const { startsAt, expiresAt } = getBangkokPassPeriod(now);
  const dayPass = await db.prepare("SELECT id FROM day_passes WHERE member_id = ? AND status = 'active' AND purchased_at >= ? AND purchased_at < ? LIMIT 1")
    .bind(member.id, startsAt.toISOString(), expiresAt.toISOString()).first<{ id: string }>();
  if (!dayPass) return bad("กรุณาซื้อบัตรเข้ารอบปัจจุบันก่อนเข้าคิว Battle", 409);
  const credit = await getNextAvailableBattleCreditOrder(db, member.id, now);
  if (!credit) return bad("ยังไม่มีบัตรแข่งที่ใช้ได้ กรุณาซื้อขั้นต่ำ 5 เกมก่อนเข้าคิว", 409);

  const partialTable = await db.prepare(`SELECT q.table_id, t.label AS table_label, q.discipline,
    COUNT(*) AS player_count, GROUP_CONCAT(q.display_name, ' vs ') AS current_names
    FROM admin_queue_tickets q JOIN venue_tables t ON t.id = q.table_id
    WHERE q.queue_type = 'battle' AND q.status IN ('assigned','playing') AND q.table_id IS NOT NULL AND q.discipline = ?
    GROUP BY q.table_id, t.label, q.discipline HAVING COUNT(*) = 1
    ORDER BY MIN(q.joined_at) ASC LIMIT 1`).bind(discipline).first<ActiveTableRow>();
  const availableTable = partialTable ? null : await db.prepare(`SELECT id, label FROM venue_tables
    WHERE table_type = 'competition' AND status = 'available' ORDER BY label ASC LIMIT 1`).first<{ id: string; label: string }>();
  const positionRow = await db.prepare(`SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM admin_queue_tickets
    WHERE queue_type = 'battle' AND discipline = ? AND status IN ('waiting','assigned','playing')`).bind(discipline).first<{ next_position: number }>();
  const ticketId = crypto.randomUUID();
  const position = Number(positionRow?.next_position ?? 1);
  const tableId = partialTable?.table_id ?? availableTable?.id ?? null;
  const status = partialTable ? "playing" : availableTable ? "assigned" : "waiting";
  const statements: PreparedStatement[] = [
    db.prepare("INSERT INTO admin_queue_tickets (id, member_id, display_name, queue_type, discipline, position, status, table_id, joined_at, updated_at) VALUES (?, ?, ?, 'battle', ?, ?, ?, ?, ?, ?)")
      .bind(ticketId, member.id, member.display_name, discipline, position, status, tableId, createdAt, createdAt),
    db.prepare("INSERT INTO audit_events (id, actor_code, action, target_type, target_id, before_json, after_json, reason, created_at) VALUES (?, ?, 'queue.member_join', 'queue_ticket', ?, NULL, ?, ?, ?)")
      .bind(crypto.randomUUID(), member.player_id, ticketId, JSON.stringify({ discipline, position, status, tableId }), "สมาชิกเข้าคิว Battle จากเมนู 3", createdAt),
  ];
  if (partialTable) {
    statements.push(
      db.prepare("UPDATE admin_queue_tickets SET status = 'playing', updated_at = ? WHERE table_id = ? AND queue_type = 'battle' AND status = 'assigned'").bind(createdAt, partialTable.table_id),
      db.prepare("UPDATE venue_tables SET status = 'occupied', current_player = ?, updated_at = ? WHERE id = ?").bind(`${partialTable.current_names} vs ${member.display_name}`, createdAt, partialTable.table_id),
    );
  } else if (availableTable) {
    statements.push(db.prepare("UPDATE venue_tables SET status = 'occupied', current_player = ?, updated_at = ? WHERE id = ?").bind(member.display_name, createdAt, availableTable.id));
  }
  await db.batch(statements);
  const message = status === "playing" ? `เริ่มคู่แข่งขันที่ ${partialTable?.table_label}` : status === "assigned" ? `รับคิวแล้ว รอคู่แข่งขันที่ ${availableTable?.label}` : `รับคิวเล่นฟรีลำดับที่ ${position} แล้ว`;
  return Response.json({ ...(await getBattleQueueSnapshot(db, member.id)), message });
}
