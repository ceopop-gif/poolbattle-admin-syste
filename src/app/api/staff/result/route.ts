import { getBangkokBusinessDate } from "@/lib/member-access";
import { getMemberStorage, memberPhotoUrl, type MemberRow } from "@/lib/server/member-storage";

export const dynamic = "force-dynamic";

type ResultInput = {
  idempotencyKey?: string;
  playerId?: string;
  opponentPlayerId?: string;
  staffCode?: string;
  discipline?: string;
  outcome?: string;
  playerScore?: number;
  opponentScore?: number;
};

type ResultSubmissionRow = {
  id: string;
  player_id_snapshot: string;
  display_name_snapshot: string;
  opponent_player_id: string | null;
  staff_code: string;
  discipline: "8-ball" | "9-ball";
  outcome: "win" | "loss";
  player_score: number;
  opponent_score: number;
  status: "result_submitted";
  business_date: string;
  submitted_at: string;
};

function normalizePlayerId(value: string) {
  return value.replace(/\s+/g, "").toUpperCase().slice(0, 24);
}

function normalizeStaffCode(value: string) {
  return value.replace(/\s+/g, "").toUpperCase().slice(0, 20);
}

function isValidPlayerId(value: string) {
  return /^PB-\d{4}-[A-Z0-9]{4,12}$/.test(value);
}

function memberPayload(member: MemberRow) {
  return {
    displayName: member.display_name,
    playerId: member.player_id,
    photoUrl: memberPhotoUrl(member.photo_key),
  };
}

function submissionPayload(row: ResultSubmissionRow) {
  return {
    id: row.id,
    playerId: row.player_id_snapshot,
    displayName: row.display_name_snapshot,
    opponentPlayerId: row.opponent_player_id,
    staffCode: row.staff_code,
    discipline: row.discipline,
    outcome: row.outcome,
    playerScore: row.player_score,
    opponentScore: row.opponent_score,
    status: row.status,
    businessDate: row.business_date,
    submittedAt: row.submitted_at,
  };
}

export async function GET(request: Request) {
  const playerId = normalizePlayerId(new URL(request.url).searchParams.get("player") ?? "");
  if (!isValidPlayerId(playerId)) return Response.json({ error: "QR สมาชิกไม่ถูกต้อง" }, { status: 400 });

  const { db } = getMemberStorage();
  const member = await db.prepare("SELECT * FROM members WHERE player_id = ? LIMIT 1").bind(playerId).first<MemberRow>();
  if (!member) return Response.json({ error: "ไม่พบสมาชิกจาก QR นี้" }, { status: 404 });
  if (member.status === "blocked") return Response.json({ error: "สมาชิกนี้ถูกระงับ กรุณาติดต่อ Admin" }, { status: 403 });
  return Response.json({ member: memberPayload(member) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as ResultInput | null;
  const idempotencyKey = String(body?.idempotencyKey ?? "");
  const playerId = normalizePlayerId(body?.playerId ?? "");
  const opponentPlayerId = normalizePlayerId(body?.opponentPlayerId ?? "");
  const staffCode = normalizeStaffCode(body?.staffCode ?? "");
  const discipline = body?.discipline === "9-ball" ? "9-ball" : body?.discipline === "8-ball" ? "8-ball" : "";
  const outcome = body?.outcome === "win" ? "win" : body?.outcome === "loss" ? "loss" : "";
  const playerScore = Number(body?.playerScore);
  const opponentScore = Number(body?.opponentScore);

  if (!idempotencyKey || !isValidPlayerId(playerId)) return Response.json({ error: "ข้อมูลสมาชิกไม่ครบถ้วน" }, { status: 400 });
  if (!/^[A-Z0-9-]{3,20}$/.test(staffCode)) return Response.json({ error: "กรุณากรอกรหัสพนักงานอย่างน้อย 3 ตัว" }, { status: 400 });
  if (!discipline || !outcome) return Response.json({ error: "กรุณาเลือกประเภทเกมและผลการแข่งขัน" }, { status: 400 });
  if (!Number.isInteger(playerScore) || !Number.isInteger(opponentScore) || playerScore < 0 || opponentScore < 0 || playerScore > 99 || opponentScore > 99) {
    return Response.json({ error: "กรุณากรอกสกอร์ 0–99 ให้ครบ" }, { status: 400 });
  }
  if (playerScore === opponentScore || (outcome === "win" && playerScore < opponentScore) || (outcome === "loss" && playerScore > opponentScore)) {
    return Response.json({ error: "ผลชนะ–แพ้ไม่ตรงกับสกอร์ที่กรอก" }, { status: 400 });
  }
  if (opponentPlayerId && (!isValidPlayerId(opponentPlayerId) || opponentPlayerId === playerId)) {
    return Response.json({ error: "Player ID ของคู่แข่งขันไม่ถูกต้อง" }, { status: 400 });
  }

  const { db } = getMemberStorage();
  const rosterCount = await db.prepare("SELECT COUNT(*) AS count FROM admin_staff").first<{ count: number }>();
  if ((rosterCount?.count ?? 0) > 0) {
    const activeStaff = await db.prepare("SELECT id FROM admin_staff WHERE staff_code = ? AND status = 'active' LIMIT 1").bind(staffCode).first<{ id: string }>();
    if (!activeStaff) return Response.json({ error: "รหัสพนักงานไม่ถูกต้องหรือถูกปิดใช้งาน" }, { status: 403 });
  }
  const duplicate = await db.prepare("SELECT * FROM competition_result_submissions WHERE idempotency_key = ? LIMIT 1").bind(idempotencyKey).first<ResultSubmissionRow>();
  if (duplicate) return Response.json({ submission: submissionPayload(duplicate), duplicate: true });

  const member = await db.prepare("SELECT * FROM members WHERE player_id = ? LIMIT 1").bind(playerId).first<MemberRow>();
  if (!member) return Response.json({ error: "ไม่พบสมาชิกจาก QR นี้" }, { status: 404 });
  if (member.status === "blocked") return Response.json({ error: "สมาชิกนี้ถูกระงับ กรุณาติดต่อ Admin" }, { status: 403 });

  const id = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  const businessDate = getBangkokBusinessDate(new Date(submittedAt));
  await db.batch([
    db.prepare("INSERT INTO competition_result_submissions (id, idempotency_key, member_id, player_id_snapshot, display_name_snapshot, opponent_player_id, staff_code, discipline, outcome, player_score, opponent_score, status, business_date, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, idempotencyKey, member.id, member.player_id, member.display_name, opponentPlayerId || null, staffCode, discipline, outcome, playerScore, opponentScore, "result_submitted", businessDate, submittedAt),
  ]);

  return Response.json({ submission: submissionPayload({ id, player_id_snapshot: member.player_id, display_name_snapshot: member.display_name, opponent_player_id: opponentPlayerId || null, staff_code: staffCode, discipline, outcome, player_score: playerScore, opponent_score: opponentScore, status: "result_submitted", business_date: businessDate, submitted_at: submittedAt }) });
}
