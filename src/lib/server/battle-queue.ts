import { getBangkokCalendarDate, getBattleTicketExpiresAt } from "@/lib/member-access";
import {
  BATTLE_LOSS_POINTS,
  BATTLE_WIN_POINTS,
  type BattleLiveMatch,
  type BattleQueuePlayer,
  type BattleQueueSnapshot,
  type BattleRankingRow,
} from "@/lib/battle-queue";
import { memberPhotoUrl, type DatabaseBinding } from "@/lib/server/member-storage";

type ActiveQueueRow = {
  ticket_id: string;
  member_id: string;
  display_name: string;
  player_id: string;
  photo_key: string;
  discipline: "8-ball" | "9-ball";
  position: number;
  status: "waiting" | "assigned" | "playing";
  table_id: string | null;
  table_label: string | null;
  joined_at: string;
};

function queuePlayer(row: ActiveQueueRow): BattleQueuePlayer {
  return {
    ticketId: row.ticket_id,
    displayName: row.display_name,
    playerId: row.player_id,
    photoUrl: memberPhotoUrl(row.photo_key),
    discipline: row.discipline,
    position: Number(row.position),
    status: row.status,
    tableId: row.table_id,
    tableLabel: row.table_label,
    joinedAt: row.joined_at,
  };
}

export async function getBattleQueueSnapshot(db: DatabaseBinding, currentMemberId: string | null = null, at = new Date()): Promise<BattleQueueSnapshot> {
  const period = getBangkokCalendarDate(at).slice(0, 7);
  const [queueRows, rankingRows] = await Promise.all([
    db.prepare(`SELECT q.id AS ticket_id, q.member_id, q.display_name, m.player_id, m.photo_key,
      q.discipline, q.position, q.status, q.table_id, t.label AS table_label, q.joined_at
      FROM admin_queue_tickets q
      JOIN members m ON m.id = q.member_id
      LEFT JOIN venue_tables t ON t.id = q.table_id
      WHERE q.queue_type = 'battle' AND q.status IN ('waiting','assigned','playing') AND m.status = 'active'
      ORDER BY q.position ASC, q.joined_at ASC`).all<ActiveQueueRow>(),
    db.prepare(`SELECT m.display_name, m.player_id, m.photo_key,
      COALESCE(SUM(CASE WHEN p.account_type = 'monthly' AND substr(p.business_date, 1, 7) = ? THEN p.points ELSE 0 END), 0) AS points,
      COALESCE(SUM(CASE WHEN p.account_type = 'monthly' AND substr(p.business_date, 1, 7) = ? AND p.point_type = 'ranked_battle_win' THEN 1 ELSE 0 END), 0) AS wins,
      COALESCE(SUM(CASE WHEN p.account_type = 'monthly' AND substr(p.business_date, 1, 7) = ? AND p.point_type = 'ranked_battle_loss' THEN 1 ELSE 0 END), 0) AS losses
      FROM members m LEFT JOIN point_ledger_entries p ON p.member_id = m.id
      WHERE m.status = 'active'
      GROUP BY m.id, m.display_name, m.player_id, m.photo_key
      ORDER BY points DESC, wins DESC, m.joined_at ASC LIMIT 50`).bind(period, period, period).all<{
        display_name: string;
        player_id: string;
        photo_key: string;
        points: number;
        wins: number;
        losses: number;
      }>(),
  ]);

  const active = queueRows.results.map((row) => ({ memberId: row.member_id, player: queuePlayer(row) }));
  const tableGroups = new Map<string, BattleQueuePlayer[]>();
  for (const item of active) {
    if (!item.player.tableId || item.player.status === "waiting") continue;
    const group = tableGroups.get(item.player.tableId) ?? [];
    group.push(item.player);
    tableGroups.set(item.player.tableId, group);
  }
  const matches: BattleLiveMatch[] = [...tableGroups.entries()].map(([tableId, players]) => ({
    tableId,
    tableLabel: players[0]?.tableLabel ?? "โต๊ะแข่งขัน",
    discipline: players[0]?.discipline ?? "8-ball",
    playerOne: players[0],
    playerTwo: players[1] ?? null,
  }));
  const waiting = active.filter((item) => item.player.status === "waiting").map((item) => item.player);
  const currentTicket = active.find((item) => item.memberId === currentMemberId)?.player ?? null;
  const ranking: BattleRankingRow[] = rankingRows.results.map((row, index) => ({
    rank: index + 1,
    displayName: row.display_name,
    playerId: row.player_id,
    photoUrl: memberPhotoUrl(row.photo_key),
    points: Number(row.points),
    wins: Number(row.wins),
    losses: Number(row.losses),
  }));

  return {
    matches,
    waiting,
    currentTicket,
    ranking,
    rules: { winPoints: BATTLE_WIN_POINTS, lossPoints: BATTLE_LOSS_POINTS, winnerStays: true },
    updatedAt: at.toISOString(),
  };
}

export type AvailableBattleCreditOrder = { orderId: string; expiresAt: string; remainingGames: number };

export async function getNextAvailableBattleCreditOrder(db: DatabaseBinding, memberId: string, at = new Date()): Promise<AvailableBattleCreditOrder | null> {
  const orders = await db.prepare(`SELECT o.id, o.games, o.purchased_at, o.expires_at,
    COALESCE(SUM(CASE WHEN l.delta_games < 0 THEN -l.delta_games ELSE 0 END), 0) AS used_games
    FROM battle_ticket_orders o
    LEFT JOIN battle_game_credit_ledger l ON l.order_id = o.id
    WHERE o.member_id = ? AND o.payment_status = 'confirmed'
    GROUP BY o.id, o.games, o.purchased_at, o.expires_at
    ORDER BY COALESCE(o.expires_at, o.purchased_at) ASC, o.purchased_at ASC`).bind(memberId).all<{
      id: string;
      games: number;
      purchased_at: string;
      expires_at: string | null;
      used_games: number;
    }>();

  for (const order of orders.results) {
    const expiresAt = order.expires_at || getBattleTicketExpiresAt(new Date(order.purchased_at)).toISOString();
    const remainingGames = Math.max(0, Number(order.games) - Number(order.used_games));
    if (remainingGames > 0 && new Date(expiresAt).getTime() > at.getTime()) return { orderId: order.id, expiresAt, remainingGames };
  }
  return null;
}
