import {
  CalendarCheck2,
  CircleCheckBig,
  Crosshair,
  IdCard,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export type MainFeatureId =
  | "gate-pass"
  | "daily-pass"
  | "free-queue"
  | "battle-queue"
  | "events"
  | "margie";

export type BottomTabId = "scores" | "order" | "home" | "ranking" | "settings";

export type MenuItem = {
  id: MainFeatureId;
  number: number;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: "gold" | "silver" | "green" | "battle";
};

export const MAIN_MENU: MenuItem[] = [
  { id: "gate-pass", number: 1, title: "บัตรผ่านประตู", subtitle: "พร้อมเข้าสนามวันนี้", icon: IdCard, tone: "gold" },
  { id: "daily-pass", number: 2, title: "บัตรแข่งประจำวัน", subtitle: "8-Ball Battle • 19:00 น.", icon: CalendarCheck2, tone: "silver" },
  { id: "free-queue", number: 3, title: "คิวเล่นฟรี", subtitle: "โต๊ะว่าง 2 โต๊ะ", icon: CircleCheckBig, tone: "green" },
  { id: "battle-queue", number: 4, title: "คิวแข่งขัน", subtitle: "แมตช์ถัดไป 20:30 น.", icon: Crosshair, tone: "battle" },
  { id: "events", number: 5, title: "กิจกรรมแข่ง", subtitle: "3 กิจกรรมที่กำลังเปิดรับ", icon: Trophy, tone: "gold" },
  { id: "margie", number: 6, title: "มารกี้", subtitle: "ผู้ช่วยส่วนตัว POOL BATTLE", icon: Trophy, tone: "gold" },
];

export const LEADERBOARD = [
  { rank: 1, name: "โปรเบียร์", points: 128, wins: 31, eligible: true, prize: "20,000" },
  { rank: 2, name: "นัท คิวทอง", points: 117, wins: 28, eligible: true, prize: "12,500" },
  { rank: 3, name: "มิ้นท์ 9-Ball", points: 104, wins: 25, eligible: true, prize: "7,500" },
  { rank: 4, name: "โจ้ รัชดา", points: 98, wins: 23, eligible: true, prize: "6,000" },
  { rank: 5, name: "เอม สปีดคิว", points: 91, wins: 22, eligible: true, prize: "4,000" },
  { rank: 6, name: "โอม แบงค์ช็อต", points: 89, wins: 21, eligible: false, prize: "—" },
  { rank: 7, name: "ดร.ป็อบ", points: 86, wins: 20, eligible: true, prize: "—" },
];

export const RECENT_MATCHES = [
  { opponent: "ตั้ม 8-Ball", discipline: "8-Ball", score: "3–1", result: "ชนะ", points: "+3" },
  { opponent: "นัท คิวทอง", discipline: "9-Ball", score: "2–3", result: "แพ้", points: "+1" },
  { opponent: "โจ้ รัชดา", discipline: "8-Ball", score: "3–2", result: "ชนะ", points: "+3" },
];

export const EVENTS = [
  { date: "1 ก.ย.", name: "8-Ball Daily Battle", detail: "กลุ่มละ 4 คน • Double Elimination", time: "19:00 น.", seats: "เหลือ 3 ที่" },
  { date: "3 ก.ย.", name: "9-Ball Rising Star", detail: "รอบคัดเลือกผู้เล่นดาวรุ่ง", time: "18:30 น.", seats: "เหลือ 8 ที่" },
  { date: "6 ก.ย.", name: "POOL BATTLE Weekend", detail: "20 ผู้เล่น • เงินรางวัลประจำรายการ", time: "13:00 น.", seats: "เหลือ 5 ที่" },
];
