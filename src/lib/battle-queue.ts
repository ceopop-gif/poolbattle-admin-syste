export const BATTLE_WIN_POINTS = 20;
export const BATTLE_LOSS_POINTS = 10;

export type BattleQueueStatus = "waiting" | "assigned" | "playing";

export type BattleQueuePlayer = {
  ticketId: string;
  displayName: string;
  playerId: string;
  photoUrl: string;
  discipline: "8-ball" | "9-ball";
  position: number;
  status: BattleQueueStatus;
  tableId: string | null;
  tableLabel: string | null;
  joinedAt: string;
};

export type BattleLiveMatch = {
  tableId: string;
  tableLabel: string;
  discipline: "8-ball" | "9-ball";
  playerOne: BattleQueuePlayer;
  playerTwo: BattleQueuePlayer | null;
};

export type BattleRankingRow = {
  rank: number;
  displayName: string;
  playerId: string;
  photoUrl: string;
  points: number;
  wins: number;
  losses: number;
};

export type BattleQueueSnapshot = {
  matches: BattleLiveMatch[];
  waiting: BattleQueuePlayer[];
  currentTicket: BattleQueuePlayer | null;
  ranking: BattleRankingRow[];
  rules: {
    winPoints: number;
    lossPoints: number;
    winnerStays: true;
  };
  updatedAt: string;
};
