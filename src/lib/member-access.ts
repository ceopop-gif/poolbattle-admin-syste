export const MEMBER_ACCESS_STORAGE_KEY = "poolbattle-member-access-v2";
export const DAY_PASS_PRICE = 150;
export const BATTLE_GAME_PRICE = 100;
export const MINIMUM_BATTLE_GAMES = 5;
export const BATTLE_GAME_VALIDITY_DAYS = 30;
export const DAY_PASS_CUTOFF_HOUR = 17;

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const BANGKOK_UTC_OFFSET_HOURS = 7;

export type PoolBattleMember = {
  phone: string;
  displayName: string;
  playerId: string;
  photoKey: string;
  photoUrl: string;
  joinedAt: string;
  firstLogin: boolean;
};

export type DayPassTicket = {
  id: string;
  orderId: string;
  phone: string;
  playerId: string;
  businessDate: string;
  purchasedAt: string;
  ticketNumber: string;
  status: "active";
  membershipCreated: boolean;
};

export type TicketOrder = {
  id: string;
  businessDate: string;
  purchasedAt: string;
  quantity: number;
  totalAmount: number;
  ticketIds: string[];
};

export type BattleCreditSummary = {
  purchasedGames: number;
  usedGames: number;
  availableGames: number;
  expiredGames: number;
  nextExpiryAt: string | null;
  nextExpiryGames: number;
  pricePerGame: number;
};

export type BattleTicketPurchaseResult = {
  order: {
    id: string;
    games: number;
    pricePerGame: number;
    totalAmount: number;
    paymentStatus: "confirmed";
    purchasedAt: string;
    expiresAt: string;
  };
  credits: BattleCreditSummary;
};

export type MemberAccessState = {
  version: 2;
  members: PoolBattleMember[];
  tickets: DayPassTicket[];
  orders: TicketOrder[];
  sessionPhone: string | null;
};

export type PurchaseResult = {
  order: TicketOrder;
  tickets: DayPassTicket[];
  members: PoolBattleMember[];
};

export type PurchaseRecipient = { phone: string; displayName: string; photo: Blob | null };

export const DEFAULT_MEMBER_ACCESS_STATE: MemberAccessState = {
  version: 2,
  members: [],
  tickets: [],
  orders: [],
  sessionPhone: null,
};

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function getBattleTicketExpiresAt(purchasedAt = new Date()) {
  return new Date(purchasedAt.getTime() + BATTLE_GAME_VALIDITY_DAYS * DAY_IN_MS);
}

export function formatThaiBattleTicketExpiry(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function isValidThaiMobile(value: string) {
  return /^0[689]\d{8}$/.test(normalizePhone(value));
}

export function maskPhone(phone: string) {
  return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
}

function getBangkokDateTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function isoDateFromUtcDay(utcDay: number) {
  return new Date(utcDay).toISOString().slice(0, 10);
}

export function getBangkokCalendarDate(date = new Date()) {
  const { year, month, day } = getBangkokDateTimeParts(date);
  return isoDateFromUtcDay(Date.UTC(year, month - 1, day));
}

export function getBangkokPassPeriod(date = new Date()) {
  const { year, month, day, hour } = getBangkokDateTimeParts(date);
  const calendarDay = Date.UTC(year, month - 1, day);
  const businessDay = calendarDay - (hour < DAY_PASS_CUTOFF_HOUR ? DAY_IN_MS : 0);
  const cutoffUtcHour = DAY_PASS_CUTOFF_HOUR - BANGKOK_UTC_OFFSET_HOURS;
  const startsAt = new Date(businessDay + cutoffUtcHour * 60 * 60 * 1000);
  const expiresAt = new Date(startsAt.getTime() + DAY_IN_MS);

  return {
    businessDate: isoDateFromUtcDay(businessDay),
    startsAt,
    expiresAt,
  };
}

export function getBangkokBusinessDate(date = new Date()) {
  return getBangkokPassPeriod(date).businessDate;
}

export function isDayPassActive(ticket: Pick<DayPassTicket, "purchasedAt" | "status">, date = new Date()) {
  if (ticket.status !== "active") return false;
  const purchasedAt = new Date(ticket.purchasedAt).getTime();
  const { startsAt, expiresAt } = getBangkokPassPeriod(date);
  return purchasedAt >= startsAt.getTime() && purchasedAt < expiresAt.getTime();
}

export function formatThaiDate(date = new Date()) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatThaiDayPassExpiry(date = new Date()) {
  const { expiresAt } = getBangkokPassPeriod(date);
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(expiresAt);
}

export function getThaiDoorDate(calendarDate = getBangkokCalendarDate()) {
  const [year, month, day] = calendarDate.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("th-TH", { month: "long", timeZone: "Asia/Bangkok" }).format(new Date(Date.UTC(year, month - 1, 15, 12)));
  return { day: String(day), month: monthName, year: String(year + 543), label: `${day} ${monthName} ${year + 543}` };
}

export function loadMemberAccessState(): MemberAccessState {
  if (typeof window === "undefined") return DEFAULT_MEMBER_ACCESS_STATE;

  try {
    const raw = window.localStorage.getItem(MEMBER_ACCESS_STORAGE_KEY);
    if (!raw) return DEFAULT_MEMBER_ACCESS_STATE;
    const parsed = JSON.parse(raw) as MemberAccessState;
    if (parsed.version !== 2 || !Array.isArray(parsed.members) || !Array.isArray(parsed.tickets) || !Array.isArray(parsed.orders)) {
      return DEFAULT_MEMBER_ACCESS_STATE;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(MEMBER_ACCESS_STORAGE_KEY);
    return DEFAULT_MEMBER_ACCESS_STATE;
  }
}
