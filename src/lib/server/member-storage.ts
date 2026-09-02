import { env } from "cloudflare:workers";
import { BATTLE_GAME_PRICE, getBangkokPassPeriod, type BattleCreditSummary } from "@/lib/member-access";

export type MemberRow = {
  id: string;
  phone: string;
  display_name: string;
  player_id: string;
  photo_key: string;
  password_salt: string;
  password_hash: string;
  first_login: number;
  status: "active" | "blocked";
  joined_at: string;
};

export type PreparedStatement = {
  bind: (...values: unknown[]) => PreparedStatement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
};

export type DatabaseBinding = {
  prepare: (query: string) => PreparedStatement;
  batch: (statements: PreparedStatement[]) => Promise<unknown[]>;
};

type BucketObject = {
  body: ReadableStream;
  httpEtag: string;
  writeHttpMetadata: (headers: Headers) => void;
};

type BucketBinding = {
  put: (key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }) => Promise<unknown>;
  get: (key: string) => Promise<BucketObject | null>;
  delete: (key: string) => Promise<void>;
};

export function getMemberStorage() {
  const bindings = env as unknown as { DB?: DatabaseBinding; BUCKET?: BucketBinding };
  if (!bindings.DB || !bindings.BUCKET) throw new Error("Member storage bindings are unavailable");
  return { db: bindings.DB, bucket: bindings.BUCKET };
}

const PBKDF2_ITERATIONS = 100_000;

export async function hashPassword(password: string, salt: string) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const digest = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: PBKDF2_ITERATIONS }, keyMaterial, 256);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function memberPhotoUrl(photoKey: string) {
  return `/api/member-photo?key=${encodeURIComponent(photoKey)}`;
}

export function memberRowToClient(member: MemberRow) {
  return {
    phone: member.phone,
    displayName: member.display_name,
    playerId: member.player_id,
    photoKey: member.photo_key,
    photoUrl: memberPhotoUrl(member.photo_key),
    joinedAt: member.joined_at,
    firstLogin: Boolean(member.first_login),
  };
}

type DayPassRow = {
  id: string;
  order_id: string;
  business_date: string;
  purchased_at: string;
  ticket_number: string;
  status: "active";
  membership_created: number;
};

export async function memberSessionPayload(db: DatabaseBinding, member: MemberRow, at = new Date()) {
  const { startsAt, expiresAt } = getBangkokPassPeriod(at);
  const [dayPass, battleCredits] = await Promise.all([
    db.prepare("SELECT id, order_id, business_date, purchased_at, ticket_number, status, membership_created FROM day_passes WHERE member_id = ? AND purchased_at >= ? AND purchased_at < ? AND status = 'active' ORDER BY purchased_at DESC LIMIT 1").bind(member.id, startsAt.toISOString(), expiresAt.toISOString()).first<DayPassRow>(),
    getBattleCreditSummary(db, member.id),
  ]);
  return {
    member: memberRowToClient(member),
    tickets: dayPass ? [{
      id: dayPass.id,
      orderId: dayPass.order_id,
      phone: member.phone,
      playerId: member.player_id,
      businessDate: dayPass.business_date,
      purchasedAt: dayPass.purchased_at,
      ticketNumber: dayPass.ticket_number,
      status: dayPass.status,
      membershipCreated: Boolean(dayPass.membership_created),
    }] : [],
    battleCredits,
  };
}

export async function getBattleCreditSummary(db: DatabaseBinding, memberId: string): Promise<BattleCreditSummary> {
  const [creditRow, priceRow] = await Promise.all([
    db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN delta_games > 0 THEN delta_games ELSE 0 END), 0) AS purchased_games,
      COALESCE(SUM(CASE WHEN delta_games < 0 THEN -delta_games ELSE 0 END), 0) AS used_games,
      COALESCE(SUM(delta_games), 0) AS available_games
      FROM battle_game_credit_ledger WHERE member_id = ?`).bind(memberId).first<{ purchased_games: number; used_games: number; available_games: number }>(),
    db.prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'battle_game_price' LIMIT 1").first<{ setting_value: string }>(),
  ]);
  const configuredPrice = Number.parseInt(priceRow?.setting_value ?? "", 10);
  return {
    purchasedGames: Number(creditRow?.purchased_games ?? 0),
    usedGames: Number(creditRow?.used_games ?? 0),
    availableGames: Math.max(0, Number(creditRow?.available_games ?? 0)),
    pricePerGame: configuredPrice > 0 ? configuredPrice : BATTLE_GAME_PRICE,
  };
}
