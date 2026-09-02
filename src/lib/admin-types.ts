export type AdminSummary = {
  totalMembers: number;
  activeMembers: number;
  activePasses: number;
  passRevenue: number;
  pendingResults: number;
  openQueues: number;
  availableTables: number;
  rewardPool: number;
  openRisks: number;
};

export type AdminMember = {
  id: string;
  displayName: string;
  playerId: string;
  maskedPhone: string;
  photoUrl: string;
  status: "active" | "blocked";
  joinedAt: string;
  monthlyPoints: number;
  lifetimePoints: number;
};

export type AdminOrder = {
  id: string;
  purchasedAt: string;
  quantity: number;
  totalAmount: number;
  paymentStatus: string;
  businessDate: string;
};

export type AdminResult = {
  id: string;
  displayName: string;
  playerId: string;
  opponentPlayerId: string | null;
  staffCode: string;
  discipline: "8-ball" | "9-ball";
  outcome: "win" | "loss";
  playerScore: number;
  opponentScore: number;
  status: "result_submitted" | "confirmed" | "rejected";
  submittedAt: string;
  businessDate: string;
};

export type AdminStaffMember = {
  id: string;
  staffCode: string;
  displayName: string;
  role: string;
  status: "active" | "inactive";
  updatedAt: string;
};

export type AdminCompetition = {
  id: string;
  name: string;
  discipline: "8-ball" | "9-ball";
  startsAt: string;
  capacity: number;
  entryFee: number;
  status: string;
  rulesetVersion: string;
  registrations: number;
};

export type AdminVenueTable = {
  id: string;
  label: string;
  tableType: string;
  status: "available" | "occupied" | "maintenance";
  currentPlayer: string | null;
  updatedAt: string;
};

export type AdminQueueTicket = {
  id: string;
  displayName: string;
  playerId: string | null;
  queueType: "casual" | "battle";
  discipline: "8-ball" | "9-ball";
  position: number;
  status: string;
  tableId: string | null;
  tableLabel: string | null;
  joinedAt: string;
};

export type AdminRankingRow = {
  memberId: string;
  displayName: string;
  playerId: string;
  photoUrl: string;
  monthlyPoints: number;
  lifetimePoints: number;
  confirmedWins: number;
  confirmedLosses: number;
  eligible: boolean;
};

export type AdminRewardEntry = {
  id: string;
  period: string;
  entryType: string;
  amount: number;
  sourceRef: string;
  reason: string;
  actorCode: string;
  createdAt: string;
};

export type AdminNewsItem = {
  id: string;
  title: string;
  summary: string;
  status: "draft" | "published";
  priority: number;
  publishedAt: string | null;
  updatedAt: string;
};

export type AdminRiskFlag = {
  id: string;
  flagType: string;
  severity: "low" | "medium" | "high" | "critical";
  targetType: string;
  targetId: string;
  summary: string;
  status: string;
  updatedAt: string;
};

export type AdminAuditEvent = {
  id: string;
  actorCode: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  createdAt: string;
};

export type AdminDashboardData = {
  generatedAt: string;
  businessDate: string;
  period: string;
  passExpiresAt: string;
  summary: AdminSummary;
  members: AdminMember[];
  orders: AdminOrder[];
  results: AdminResult[];
  staff: AdminStaffMember[];
  competitions: AdminCompetition[];
  tables: AdminVenueTable[];
  queues: AdminQueueTicket[];
  ranking: AdminRankingRow[];
  rewardEntries: AdminRewardEntry[];
  news: AdminNewsItem[];
  settings: Record<string, string>;
  risks: AdminRiskFlag[];
  audit: AdminAuditEvent[];
};

export type AdminActionResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};
