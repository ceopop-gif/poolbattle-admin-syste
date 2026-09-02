import { MINIMUM_BATTLE_GAMES, normalizePhone, type BattleTicketPurchaseResult } from "@/lib/member-access";
import { getBattleCreditSummary, getMemberStorage, type MemberRow, type PreparedStatement } from "@/lib/server/member-storage";

export const dynamic = "force-dynamic";

type PurchaseBody = {
  phone?: string;
  games?: number;
  idempotencyKey?: string;
};

type BattleOrderRow = {
  id: string;
  member_id: string;
  games: number;
  price_per_game: number;
  total_amount: number;
  payment_status: "confirmed";
  purchased_at: string;
};

function orderPayload(order: BattleOrderRow): BattleTicketPurchaseResult["order"] {
  return {
    id: order.id,
    games: order.games,
    pricePerGame: order.price_per_game,
    totalAmount: order.total_amount,
    paymentStatus: order.payment_status,
    purchasedAt: order.purchased_at,
  };
}

export async function GET(request: Request) {
  const phone = normalizePhone(new URL(request.url).searchParams.get("phone") ?? "");
  if (!/^0\d{9}$/.test(phone)) return Response.json({ error: "เบอร์มือถือสมาชิกไม่ถูกต้อง" }, { status: 400 });
  const { db } = getMemberStorage();
  const member = await db.prepare("SELECT * FROM members WHERE phone = ? LIMIT 1").bind(phone).first<MemberRow>();
  if (!member) return Response.json({ error: "ไม่พบบัญชีสมาชิก" }, { status: 404 });
  if (member.status === "blocked") return Response.json({ error: "บัญชีสมาชิกถูกระงับ" }, { status: 403 });
  return Response.json({ credits: await getBattleCreditSummary(db, member.id) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as PurchaseBody | null;
  const phone = normalizePhone(body?.phone ?? "");
  const games = Number(body?.games);
  const idempotencyKey = String(body?.idempotencyKey ?? "").trim().slice(0, 100);

  if (!/^0\d{9}$/.test(phone)) return Response.json({ error: "เบอร์มือถือสมาชิกไม่ถูกต้อง" }, { status: 400 });
  if (!Number.isInteger(games) || games < MINIMUM_BATTLE_GAMES || games > 100) {
    return Response.json({ error: `ซื้อบัตรแข่งขันขั้นต่ำ ${MINIMUM_BATTLE_GAMES} เกม และไม่เกิน 100 เกมต่อครั้ง` }, { status: 400 });
  }
  if (idempotencyKey.length < 8) return Response.json({ error: "ข้อมูลคำสั่งซื้อไม่ครบถ้วน" }, { status: 400 });

  const { db } = getMemberStorage();
  const member = await db.prepare("SELECT * FROM members WHERE phone = ? LIMIT 1").bind(phone).first<MemberRow>();
  if (!member) return Response.json({ error: "ไม่พบบัญชีสมาชิก กรุณาซื้อบัตรเข้าประตูก่อน" }, { status: 404 });
  if (member.status === "blocked") return Response.json({ error: "บัญชีสมาชิกถูกระงับ กรุณาติดต่อเจ้าหน้าที่" }, { status: 403 });

  const duplicate = await db.prepare("SELECT id, member_id, games, price_per_game, total_amount, payment_status, purchased_at FROM battle_ticket_orders WHERE idempotency_key = ? LIMIT 1")
    .bind(idempotencyKey).first<BattleOrderRow>();
  if (duplicate) {
    if (duplicate.member_id !== member.id) return Response.json({ error: "รหัสคำสั่งซื้อถูกใช้งานแล้ว" }, { status: 409 });
    return Response.json({ order: orderPayload(duplicate), credits: await getBattleCreditSummary(db, member.id) } satisfies BattleTicketPurchaseResult);
  }

  const creditsBefore = await getBattleCreditSummary(db, member.id);
  const orderId = crypto.randomUUID();
  const purchasedAt = new Date().toISOString();
  const totalAmount = games * creditsBefore.pricePerGame;
  const statements: PreparedStatement[] = [
    db.prepare("INSERT INTO battle_ticket_orders (id, idempotency_key, member_id, games, price_per_game, total_amount, payment_status, purchased_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(orderId, idempotencyKey, member.id, games, creditsBefore.pricePerGame, totalAmount, "confirmed", purchasedAt),
    db.prepare("INSERT INTO battle_game_credit_ledger (id, member_id, order_id, delta_games, entry_type, source_ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), member.id, orderId, games, "purchase", `battle-ticket-order:${orderId}`, purchasedAt),
    db.prepare("INSERT INTO audit_events (id, actor_code, action, target_type, target_id, before_json, after_json, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), `MEMBER:${member.player_id}`, "battle_ticket.purchase", "battle_ticket_order", orderId, JSON.stringify(creditsBefore), JSON.stringify({ games, pricePerGame: creditsBefore.pricePerGame, totalAmount }), "สมาชิกซื้อเครดิตเกมแข่งขัน", purchasedAt),
  ];

  try {
    await db.batch(statements);
    const result: BattleTicketPurchaseResult = {
      order: { id: orderId, games, pricePerGame: creditsBefore.pricePerGame, totalAmount, paymentStatus: "confirmed", purchasedAt },
      credits: await getBattleCreditSummary(db, member.id),
    };
    return Response.json(result);
  } catch (error) {
    const savedOrder = await db.prepare("SELECT id, member_id, games, price_per_game, total_amount, payment_status, purchased_at FROM battle_ticket_orders WHERE idempotency_key = ? LIMIT 1")
      .bind(idempotencyKey).first<BattleOrderRow>();
    if (savedOrder?.member_id === member.id) {
      return Response.json({ order: orderPayload(savedOrder), credits: await getBattleCreditSummary(db, member.id) } satisfies BattleTicketPurchaseResult);
    }
    console.error("battle ticket purchase failed", error);
    return Response.json({ error: "ไม่สามารถซื้อบัตรแข่งขันได้ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
