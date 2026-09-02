"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Crown,
  Flame,
  Info,
  LockKeyhole,
  LogOut,
  MapPin,
  Medal,
  Newspaper,
  QrCode,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  TicketCheck,
  Trophy,
  Volume2,
  WalletCards,
} from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { FeatureSheet, type FeatureState } from "@/components/feature-sheet";
import { LoginScreen, MemberProfileSheet, TicketPurchaseSheet } from "@/components/member-access";
import { MenuCard } from "@/components/menu-card";
import { useUiSound } from "@/hooks/use-ui-sound";
import {
  BATTLE_GAME_PRICE,
  MEMBER_ACCESS_STORAGE_KEY,
  formatThaiDayPassExpiry,
  getBangkokBusinessDate,
  getBangkokPassPeriod,
  isValidThaiMobile,
  isDayPassActive,
  loadMemberAccessState,
  normalizePhone,
  type BattleCreditSummary,
  type BattleTicketPurchaseResult,
  type DayPassTicket,
  type MemberAccessState,
  type PoolBattleMember,
  type PurchaseRecipient,
  type PurchaseResult,
} from "@/lib/member-access";
import type { BattleQueueSnapshot, BattleRankingRow } from "@/lib/battle-queue";
import { MAIN_MENU, type BottomTabId, type MenuItem } from "@/lib/poolbattle-data";

type SettingsState = { lineNotifications: boolean; sound: boolean; queueAlerts: boolean };
type PersistedState = { version: 1; features: FeatureState; settings: SettingsState };
type MemberSessionPayload = { error?: string; step?: string; member?: PoolBattleMember; tickets?: DayPassTicket[]; battleCredits?: BattleCreditSummary };
type MemberNewsItem = { id: string; title: string; summary: string; publishedAt: string };

const STORAGE_KEY = "poolbattle-player-state-v1";
const DEFAULT_FEATURES: FeatureState = { queueJoined: false, competitionRegistered: false, battleReady: false };
const DEFAULT_SETTINGS: SettingsState = { lineNotifications: true, sound: true, queueAlerts: true };
const DEFAULT_BATTLE_CREDITS: BattleCreditSummary = { purchasedGames: 0, usedGames: 0, availableGames: 0, expiredGames: 0, nextExpiryAt: null, nextExpiryGames: 0, pricePerGame: BATTLE_GAME_PRICE };

function loadPersistedState(): PersistedState {
  if (typeof window === "undefined") {
    return { version: 1, features: DEFAULT_FEATURES, settings: DEFAULT_SETTINGS };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, features: DEFAULT_FEATURES, settings: DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version !== 1) return { version: 1, features: DEFAULT_FEATURES, settings: DEFAULT_SETTINGS };
    return {
      version: 1,
      features: { ...DEFAULT_FEATURES, ...parsed.features },
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return { version: 1, features: DEFAULT_FEATURES, settings: DEFAULT_SETTINGS };
  }
}

function HomeScreen({
  member,
  memberPass,
  currentTime,
  roundTicketCount,
  onOpen,
  onBuyPass,
  news,
}: {
  member: PoolBattleMember;
  memberPass: DayPassTicket | null;
  currentTime: number;
  roundTicketCount: number;
  onOpen: (item: MenuItem) => void;
  onBuyPass: () => void;
  news: MemberNewsItem[];
}) {
  const isSeededProfile = member.playerId === "PB-2026-0088";
  const initials = member.displayName.replace("ดร.", "").trim().charAt(0) || "P";
  const passExpiry = formatThaiDayPassExpiry(memberPass ? new Date(memberPass.purchasedAt) : new Date(currentTime));

  return (
    <>
      <section className="player-summary" aria-label="ข้อมูลสมาชิก">
        <div className="player-copy"><span className="arena-live"><i /> ARENA LIVE</span><span className="greeting">สวัสดีครับ</span><h1>{member.displayName}</h1><span className="player-id"><ShieldCheck size={15} /> Player ID: {member.playerId}</span></div>
        <div className="player-avatar" aria-label="รูปประจำตัวผู้เล่น">{member.photoUrl ? <Image src={member.photoUrl} alt={`รูปสมาชิก ${member.displayName}`} width={58} height={58} unoptimized /> : <span>{initials}</span>}<i /></div>
        <div className="summary-stats"><div><span>คะแนนเดือนนี้</span><strong>{isSeededProfile ? 86 : 0}</strong></div><div><span>อันดับปัจจุบัน</span><strong>{isSeededProfile ? "#7" : "—"}</strong></div><div><span>Lifetime</span><strong>{isSeededProfile ? "1,248" : 0}</strong></div></div>
        <div className={`pass-status ${memberPass ? "" : "pass-pending"}`}>{memberPass ? <CheckCircle2 size={18} /> : <TicketCheck size={18} />}<span><strong>{memberPass ? "บัตรรอบนี้ใช้งานได้" : "ยังไม่มีบัตรเข้ารอบนี้"}</strong>{memberPass ? ` ถึง ${passExpiry}` : " ซื้อบัตรเพื่อรับสิทธิ์เข้าประตู"}</span>{memberPass ? <QrCode size={20} /> : null}</div>
      </section>

      <section className="today-pass-card" aria-label="สรุปบัตรเข้าสนามรอบปัจจุบัน">
        <div className="today-pass-date"><CalendarDays size={23} /><span><small>รอบบัตรเข้า • ตัดรอบ 17:00 น.</small><strong>ใช้ได้ถึง {passExpiry}</strong></span></div>
        <div className="today-pass-count"><small>ซื้อแล้วรอบนี้</small><strong>{roundTicketCount}<span> ใบ</span></strong></div>
        <button type="button" onClick={onBuyPass}><TicketCheck size={20} /> ซื้อบัตรเข้า</button>
      </section>

      {news.length > 0 ? <section className="member-news" aria-label="ประกาศจากสนาม"><div className="member-news-title"><Newspaper size={20} /><span><small>ARENA UPDATE</small><strong>ประกาศจากสนาม</strong></span></div>{news.slice(0, 2).map((item) => <article key={item.id}><strong>{item.title}</strong><p>{item.summary}</p></article>)}</section> : null}

      <div className="section-heading"><div><span>PLAY • COMPETE • REWARD</span><h2>เมนูสมาชิก</h2></div><button type="button" aria-label="ดูข้อมูลระบบ"><Info size={20} /></button></div>
      <section className="menu-grid" aria-label="เมนูสมาชิก 6 รายการ">{MAIN_MENU.map((item) => <MenuCard key={item.id} item={item} onOpen={onOpen} />)}</section>
      <section className="reward-banner"><div className="reward-icon"><CircleDollarSign size={28} /></div><div><span>กองรางวัลประจำเดือน</span><strong>฿50,000</strong><small>ปิดรอบในอีก 29 วัน</small></div><ChevronRight size={22} /></section>
    </>
  );
}

function ScoresScreen({ ranking }: { ranking: BattleRankingRow | null }) {
  const totalMatches = (ranking?.wins ?? 0) + (ranking?.losses ?? 0);
  const winRate = totalMatches > 0 ? Math.round(((ranking?.wins ?? 0) / totalMatches) * 100) : 0;
  return (
    <section className="tab-screen">
      <div className="tab-title"><span>ประวัติการแข่งขัน</span><h1>ผลคะแนนของฉัน</h1></div>
      <div className="score-hero"><div><span>Monthly Points</span><strong>{ranking?.points ?? 0}</strong><small><Flame size={14} /> ชนะ +20 • แพ้ +10</small></div><div className="score-ring"><span>ชนะ</span><strong>{winRate}%</strong><small>{ranking?.wins ?? 0}W • {ranking?.losses ?? 0}L</small></div></div>
      <div className="metric-row"><div><Trophy size={21} /><span>ชนะ</span><strong>{ranking?.wins ?? 0}</strong></div><div><Target size={21} /><span>แข่งเดือนนี้</span><strong>{totalMatches}</strong></div><div><Medal size={21} /><span>อันดับ</span><strong>{ranking ? `#${ranking.rank}` : "—"}</strong></div></div>
      <div className="content-heading"><h2>กติกาคะแนน Battle</h2></div>
      <div className="score-rules-note"><ShieldCheck size={22} /><span><strong>คิดคะแนนหลัง Admin ยืนยันผล</strong><small>ผู้ชนะรับ 20 คะแนน • ผู้แพ้รับ 10 คะแนน • สะสมใน Ranking รายเดือน</small></span></div>
    </section>
  );
}

function OrderScreen() {
  return (
    <section className="tab-screen">
      <div className="tab-title"><span>สถานะปัจจุบัน</span><h1>ลำดับของฉัน</h1></div>
      <div className="order-card active-order"><div className="order-badge"><span>คิว</span><strong>3</strong></div><div><span className="eyebrow">คิวเล่นฟรี</span><h2>เหลืออีก 2 คิว</h2><p>ประมาณ 18 นาที • 8-Ball • โต๊ะมาตรฐาน</p></div></div>
      <div className="order-card"><div className="order-time"><Clock3 /><strong>20:30</strong></div><div><span className="eyebrow">คิวแข่งขัน</span><h2>ดร.ป็อบ VS นัท คิวทอง</h2><p>8-Ball Daily Battle • โต๊ะ 5</p></div></div>
      <div className="status-guide"><h2>ระบบจะทำอะไรต่อ?</h2><div><span className="step done"><Check size={15} /></span><p><strong>รับคิวแล้ว</strong><small>ระบบบันทึกคิวของคุณเรียบร้อย</small></p></div><div><span className="step current">2</span><p><strong>รอแจ้งเตือน</strong><small>กรุณาอยู่ในบริเวณสนาม</small></p></div><div><span className="step">3</span><p><strong>ยืนยันและไปที่โต๊ะ</strong><small>ยืนยันภายในเวลาที่กำหนด</small></p></div></div>
    </section>
  );
}

function RankingScreen({ ranking, currentPlayerId }: { ranking: BattleRankingRow[]; currentPlayerId: string }) {
  return (
    <section className="tab-screen">
      <div className="tab-title inline-title"><div><span>กันยายน 2569</span><h1>Battle Ranking</h1></div><button type="button" aria-label="กรองอันดับ"><SlidersHorizontal size={19} /></button></div>
      <div className="pool-strip"><div><Crown size={25} /><span>กองรางวัลเดือนนี้<strong>฿50,000</strong></span></div><small>Top 5 รับรางวัล</small></div>
      <div className="eligibility-progress"><div><span>สิทธิ์รับรางวัลของคุณ</span><strong>ผ่าน 3/4 เงื่อนไข</strong></div><div className="progress-track"><i /></div><p><CheckCircle2 size={15} /> แข่ง 7 วัน <CheckCircle2 size={15} /> 12 กลุ่ม <CheckCircle2 size={15} /> ยืนยันตัวตน</p></div>
      <div className="leaderboard"><div className="leaderboard-head"><span>อันดับ</span><span>ผู้เล่น</span><span>คะแนน</span></div>
        {ranking.length ? ranking.map((player) => (
          <article className={player.playerId === currentPlayerId ? "me" : ""} key={player.playerId}><span className={`rank-badge rank-${player.rank}`}>{player.rank}</span><div className="rank-player"><Image src={player.photoUrl} alt="" width={35} height={35} unoptimized /><p><strong>{player.displayName}</strong><small>ชนะ {player.wins} • แพ้ {player.losses}</small></p></div><div className="rank-score"><strong>{player.points}</strong><small>คะแนน</small></div></article>
        )) : <div className="ranking-empty">ยังไม่มีผลการแข่งขันที่ยืนยันแล้ว</div>}
      </div>
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button className={`toggle ${checked ? "on" : ""}`} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}><span /></button>;
}

function SettingsScreen({ member, settings, onToggle, onEditProfile, onLogout }: { member: PoolBattleMember; settings: SettingsState; onToggle: (key: keyof SettingsState) => void; onEditProfile: () => void; onLogout: () => void }) {
  const initials = member.displayName.replace("ดร.", "").trim().charAt(0) || "P";
  return (
    <section className="tab-screen">
      <div className="tab-title"><span>บัญชีและการใช้งาน</span><h1>ตั้งค่า</h1></div>
      <button className="settings-profile" type="button" onClick={onEditProfile}>{member.photoUrl ? <Image className="settings-member-photo" src={member.photoUrl} alt={`รูปสมาชิก ${member.displayName}`} width={49} height={49} unoptimized /> : <span className="mini-avatar big">{initials}</span>}<span className="settings-profile-copy"><strong>{member.displayName}</strong><span>{member.playerId} • แตะเพื่อเปลี่ยนรูป</span></span><ChevronRight size={20} /></button>
      <div className="settings-group"><h2>สนามที่ใช้งาน</h2><button type="button"><span className="setting-icon"><MapPin /></span><p><strong>POOL BATTLE ARENA</strong><small>รัชดาภิเษก • กรุงเทพมหานคร</small></p><ChevronRight /></button></div>
      <div className="settings-group"><h2>การแจ้งเตือน</h2>
        <div className="setting-row"><span className="setting-icon"><Bell /></span><p><strong>แจ้งเตือนผ่าน LINE</strong><small>คิว แมตช์ และผลคะแนน</small></p><Toggle checked={settings.lineNotifications} onChange={() => onToggle("lineNotifications")} label="แจ้งเตือนผ่าน LINE" /></div>
        <div className="setting-row"><span className="setting-icon"><Volume2 /></span><p><strong>เสียงปุ่มและเอฟเฟกต์</strong><small>เสียงตอบรับเมื่อกดใช้งาน</small></p><Toggle checked={settings.sound} onChange={() => onToggle("sound")} label="เสียงปุ่มและเอฟเฟกต์" /></div>
        <div className="setting-row"><span className="setting-icon"><Clock3 /></span><p><strong>เตือนก่อนถึงคิว</strong><small>แจ้งล่วงหน้า 10 นาที</small></p><Toggle checked={settings.queueAlerts} onChange={() => onToggle("queueAlerts")} label="เตือนก่อนถึงคิว" /></div>
      </div>
      <div className="settings-group"><button type="button"><span className="setting-icon"><WalletCards /></span><p><strong>บัญชีรับรางวัล</strong><small>ยืนยันบัญชีแล้ว</small></p><ChevronRight /></button><button type="button"><span className="setting-icon"><LockKeyhole /></span><p><strong>ความเป็นส่วนตัวและความปลอดภัย</strong><small>ใช้รหัสผ่านส่วนตัวที่ตั้งไว้ตอนเข้าใช้ครั้งแรก</small></p><ChevronRight /></button><button className="logout-button" type="button" onClick={onLogout}><span className="setting-icon"><LogOut /></span><p><strong>ออกจากระบบ</strong><small>กลับไปหน้าเข้าสู่ระบบสมาชิก</small></p><ChevronRight /></button></div>
      <div className="settings-group admin-entry-group"><h2>สำหรับผู้ดูแลสนาม</h2><Link className="admin-console-link" href="/admin"><span className="setting-icon"><ShieldCheck /></span><p><strong>เปิดศูนย์ควบคุม Admin</strong><small>สมาชิก คิว โต๊ะ การแข่งขัน คะแนน รางวัล และรายงาน</small></p><ChevronRight /></Link></div>
    </section>
  );
}

function ArenaEffects() {
  return (
    <div className="arena-effects" aria-hidden="true">
      <span className="arena-beam beam-left" />
      <span className="arena-beam beam-right" />
      <span className="floating-pool-ball ball-eight" />
      <span className="floating-pool-ball ball-nine" />
      <span className="arena-particle particle-one" />
      <span className="arena-particle particle-two" />
      <span className="arena-particle particle-three" />
    </div>
  );
}

export function PoolBattleApp() {
  const [initialState] = useState<PersistedState>(loadPersistedState);
  const [initialMemberAccess] = useState<MemberAccessState>(loadMemberAccessState);
  const [activeTab, setActiveTab] = useState<BottomTabId>("home");
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);
  const [features, setFeatures] = useState<FeatureState>(initialState.features);
  const [settings, setSettings] = useState<SettingsState>(initialState.settings);
  const [memberAccess, setMemberAccess] = useState<MemberAccessState>(initialMemberAccess);
  const [loginPhone, setLoginPhone] = useState("");
  const [ticketSheetOpen, setTicketSheetOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [passClock, setPassClock] = useState(() => Date.now());
  const [news, setNews] = useState<MemberNewsItem[]>([]);
  const [battleCredits, setBattleCredits] = useState<BattleCreditSummary>(DEFAULT_BATTLE_CREDITS);
  const [battleQueue, setBattleQueue] = useState<BattleQueueSnapshot | null>(null);
  const [battleQueueBusy, setBattleQueueBusy] = useState(false);
  const previousBusinessDateRef = useRef(getBangkokBusinessDate(new Date(passClock)));
  const { playTap, playSuccess } = useUiSound(settings.sound);
  const currentMember = memberAccess.members.find((member) => member.phone === memberAccess.sessionPhone) ?? null;
  const currentRanking = battleQueue?.ranking.find((player) => player.playerId === currentMember?.playerId) ?? null;

  const refreshBattleQueue = useCallback(async (phone: string, signal?: AbortSignal) => {
    const response = await fetch(`/api/battle-queue?phone=${encodeURIComponent(phone)}`, { cache: "no-store", signal });
    if (!response.ok) return;
    setBattleQueue(await response.json() as BattleQueueSnapshot);
  }, []);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest("button")) playTap();
  }, [playTap]);

  useEffect(() => {
    const snapshot: PersistedState = { version: 1, features, settings };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [features, settings]);

  useEffect(() => {
    window.localStorage.setItem(MEMBER_ACCESS_STORAGE_KEY, JSON.stringify(memberAccess));
  }, [memberAccess]);

  useEffect(() => {
    let active = true;
    fetch("/api/news")
      .then((response) => response.ok ? response.json() as Promise<{ news?: MemberNewsItem[] }> : null)
      .then((payload) => { if (active && payload?.news) setNews(payload.news); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!currentMember) return;
    let active = true;
    fetch(`/api/member-access/battle-tickets?phone=${encodeURIComponent(currentMember.phone)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ credits?: BattleCreditSummary }> : null)
      .then((payload) => { if (active && payload?.credits) setBattleCredits(payload.credits); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [currentMember]);

  useEffect(() => {
    if (!currentMember) return;
    const controller = new AbortController();
    const initialRefresh = window.setTimeout(() => void refreshBattleQueue(currentMember.phone, controller.signal).catch(() => undefined), 0);
    const interval = window.setInterval(() => void refreshBattleQueue(currentMember.phone, controller.signal).catch(() => undefined), 10_000);
    return () => {
      controller.abort();
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [currentMember, refreshBattleQueue]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    let timeoutId = 0;
    const refreshPassClock = () => {
      window.clearTimeout(timeoutId);
      const now = Date.now();
      setPassClock(now);
      const nextBusinessDate = getBangkokBusinessDate(new Date(now));
      if (previousBusinessDateRef.current !== nextBusinessDate) {
        previousBusinessDateRef.current = nextBusinessDate;
        if (currentMember) {
          setTicketSheetOpen(true);
          setToast("ถึงเวลา 17:00 น. กรุณาซื้อบัตรเข้ารอบใหม่");
        }
      }
      const { expiresAt } = getBangkokPassPeriod(new Date(now));
      timeoutId = window.setTimeout(refreshPassClock, Math.max(1_000, expiresAt.getTime() - now + 1_000));
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshPassClock();
    };

    refreshPassClock();
    window.addEventListener("focus", refreshPassClock);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", refreshPassClock);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [currentMember]);

  const currentTime = new Date(passClock);
  const currentRoundTickets = memberAccess.tickets.filter((ticket) => isDayPassActive(ticket, currentTime));
  const memberPass = currentMember ? currentRoundTickets.find((ticket) => ticket.phone === currentMember.phone) ?? null : null;

  const screen = useMemo(() => {
    if (!currentMember) return null;
    switch (activeTab) {
      case "scores": return <ScoresScreen ranking={currentRanking} />;
      case "order": return <OrderScreen />;
      case "ranking": return <RankingScreen ranking={battleQueue?.ranking ?? []} currentPlayerId={currentMember.playerId} />;
      case "settings": return <SettingsScreen member={currentMember} settings={settings} onToggle={(key) => setSettings((current) => ({ ...current, [key]: !current[key] }))} onEditProfile={() => setProfileSheetOpen(true)} onLogout={() => { setLoginPhone(currentMember.phone); setMemberAccess((current) => ({ ...current, sessionPhone: null })); }} />;
      case "home": return <HomeScreen member={currentMember} memberPass={memberPass} currentTime={passClock} roundTicketCount={currentRoundTickets.length} onOpen={setOpenItem} onBuyPass={() => setTicketSheetOpen(true)} news={news} />;
    }
  }, [activeTab, battleQueue, currentMember, currentRanking, currentRoundTickets.length, memberPass, news, passClock, settings]);

  function completeMemberLogin(phone: string, payload: MemberSessionPayload, message: string) {
    if (!payload.member) return payload.error ?? "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองอีกครั้ง";
    setMemberAccess((current) => ({
      ...current,
      sessionPhone: phone,
      members: [...current.members.filter((candidate) => candidate.phone !== phone), payload.member!],
      tickets: [...current.tickets.filter((ticket) => ticket.phone !== phone), ...(payload.tickets ?? [])],
    }));
    setBattleCredits(payload.battleCredits ?? DEFAULT_BATTLE_CREDITS);
    setLoginPhone(phone);
    setActiveTab("home");
    setToast(message);
    return null;
  }

  async function handleCheckPhone(phoneValue: string): Promise<{ step: "password" | "setup-password" } | { error: string }> {
    const phone = normalizePhone(phoneValue);
    if (!isValidThaiMobile(phone)) return { error: "กรุณากรอกเบอร์มือถือไทยให้ครบ 10 หลัก" };
    const response = await fetch("/api/member-access/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const payload = await response.json() as MemberSessionPayload;
    if (!response.ok) return { error: payload.error ?? "ไม่สามารถตรวจสอบสมาชิกได้ กรุณาลองอีกครั้ง" };
    if (payload.step === "setup-password" || payload.step === "password") return { step: payload.step };
    return { error: "ไม่สามารถตรวจสอบขั้นตอนเข้าสู่ระบบได้" };
  }

  async function handleLogin(phoneValue: string, password: string) {
    const phone = normalizePhone(phoneValue);
    const response = await fetch("/api/member-access/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    const payload = await response.json() as MemberSessionPayload;
    if (!response.ok) return payload.error ?? "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองอีกครั้ง";
    return completeMemberLogin(phone, payload, "เข้าสู่ระบบสำเร็จ");
  }

  async function handleSetPassword(phoneValue: string, password: string) {
    const phone = normalizePhone(phoneValue);
    const response = await fetch("/api/member-access/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    const payload = await response.json() as MemberSessionPayload;
    if (!response.ok) return payload.error ?? "ไม่สามารถตั้งรหัสผ่านได้ กรุณาลองอีกครั้ง";
    return completeMemberLogin(phone, payload, "ตั้งรหัสผ่านและเข้าสู่ระบบสำเร็จ");
  }

  async function handleTicketPurchase(recipients: PurchaseRecipient[]): Promise<PurchaseResult> {
    const formData = new FormData();
    formData.set("idempotencyKey", crypto.randomUUID());
    formData.set("recipients", JSON.stringify(recipients.map((recipient) => ({ phone: recipient.phone, displayName: recipient.displayName }))));
    recipients.forEach((recipient, index) => {
      if (recipient.photo) formData.set(`photo-${index}`, recipient.photo, `member-${index + 1}.jpg`);
    });
    const response = await fetch("/api/member-access/purchase", { method: "POST", body: formData });
    const result = await response.json() as PurchaseResult & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "ไม่สามารถออกบัตรได้ กรุณาลองอีกครั้ง");
    setMemberAccess((current) => ({
      ...current,
      members: [...current.members.filter((member) => !result.members.some((updated) => updated.phone === member.phone)), ...result.members],
      tickets: [...current.tickets, ...result.tickets],
      orders: [...current.orders, result.order],
    }));
    playSuccess();
    return result;
  }

  async function handleBattleTicketPurchase(games: number): Promise<BattleTicketPurchaseResult> {
    if (!currentMember) throw new Error("ไม่พบบัญชีสมาชิก");
    const response = await fetch("/api/member-access/battle-tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: currentMember.phone, games, idempotencyKey: crypto.randomUUID() }),
    });
    const result = await response.json() as BattleTicketPurchaseResult & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "ไม่สามารถซื้อบัตรแข่งขันได้ กรุณาลองอีกครั้ง");
    setBattleCredits(result.credits);
    playSuccess();
    setToast(`ซื้อบัตรแข่งขัน ${result.order.games} เกมเรียบร้อย`);
    return result;
  }

  async function updateBattleQueue(action: "join" | "cancel", discipline: "8-ball" | "9-ball" = "8-ball") {
    if (!currentMember) throw new Error("ไม่พบบัญชีสมาชิก");
    setBattleQueueBusy(true);
    try {
      const response = await fetch("/api/battle-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, discipline, phone: currentMember.phone }),
      });
      const payload = await response.json() as BattleQueueSnapshot & { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error ?? "ไม่สามารถอัปเดตคิวได้ กรุณาลองอีกครั้ง");
      setBattleQueue(payload);
      playSuccess();
      setToast(payload.message ?? (action === "join" ? "รับคิว Battle แล้ว" : "ยกเลิกคิวแล้ว"));
    } finally {
      setBattleQueueBusy(false);
    }
  }

  async function handleProfilePhotoUpdate(photo: Blob, password: string) {
    if (!currentMember) return "ไม่พบบัญชีสมาชิก";
    const formData = new FormData();
    formData.set("phone", currentMember.phone);
    formData.set("password", password);
    formData.set("photo", photo, "member-profile.jpg");
    try {
      const response = await fetch("/api/member-access/profile-photo", { method: "POST", body: formData });
      const result = await response.json() as { member?: PoolBattleMember; error?: string };
      if (!response.ok || !result.member) return result.error ?? "ไม่สามารถบันทึกรูปสมาชิกได้ กรุณาลองอีกครั้ง";
      setMemberAccess((current) => ({
        ...current,
        members: [...current.members.filter((member) => member.phone !== result.member!.phone), result.member!],
      }));
      playSuccess();
      setToast("เปลี่ยนรูปโปรไฟล์เรียบร้อย");
      return null;
    } catch {
      return "ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองอีกครั้ง";
    }
  }

  function handleUseMember(phone: string) {
    setLoginPhone(phone);
    setMemberAccess((current) => ({ ...current, sessionPhone: null }));
    setTicketSheetOpen(false);
    setToast("กรอกเบอร์มือถือเพื่อเข้าสู่ระบบ");
  }

  function handleFeatureAction(action: "queue" | "register" | "ready" | "notify", message: string) {
    if (action === "queue") setFeatures((current) => ({ ...current, queueJoined: !current.queueJoined }));
    if (action === "register") setFeatures((current) => ({ ...current, competitionRegistered: true }));
    if (action === "ready") setFeatures((current) => ({ ...current, battleReady: true }));
    if (action !== "notify") playSuccess();
    setToast(message);
  }

  return (
    <div className="site-stage" onPointerDownCapture={handlePointerDown}>
      <main className="app-shell">
        <ArenaEffects />
        {currentMember ? <header className="topbar"><button className="brand" type="button" onClick={() => setActiveTab("home")} aria-label="กลับหน้าหลัก POOL BATTLE"><Image src="/poolbattle-logo.jpg" alt="POOL BATTLE" width={56} height={56} priority sizes="56px" /><span><strong>POOL BATTLE</strong><small>EVERY GAME • CHANCE • REWARD</small></span></button><button className="notification-button" type="button" aria-label="การแจ้งเตือน"><Bell size={22} /><i>2</i></button></header> : null}
        {currentMember ? <div className="screen-content" data-tab={activeTab} key={activeTab}>{screen}</div> : <LoginScreen key={loginPhone || "member-login"} initialPhone={loginPhone} onCheckPhone={handleCheckPhone} onLogin={handleLogin} onSetPassword={handleSetPassword} onBuy={() => setTicketSheetOpen(true)} />}
        {currentMember ? <BottomNav activeTab={activeTab} onChange={setActiveTab} /> : null}
      </main>
      {openItem && currentMember ? <FeatureSheet item={openItem} state={features} member={currentMember} dayPass={memberPass} battleCredits={battleCredits} battleQueue={battleQueue} battleQueueBusy={battleQueueBusy} onClose={() => setOpenItem(null)} onPurchaseBattleGames={handleBattleTicketPurchase} onJoinBattleQueue={(discipline) => updateBattleQueue("join", discipline)} onCancelBattleQueue={() => updateBattleQueue("cancel")} onAction={handleFeatureAction} /> : null}
      {ticketSheetOpen ? <TicketPurchaseSheet members={memberAccess.members} currentTime={passClock} onClose={() => setTicketSheetOpen(false)} onPurchase={handleTicketPurchase} onUseMember={handleUseMember} /> : null}
      {profileSheetOpen && currentMember ? <MemberProfileSheet member={currentMember} onClose={() => setProfileSheetOpen(false)} onSave={handleProfilePhotoUpdate} /> : null}
      {toast ? <div className="toast" role="status"><CheckCircle2 size={19} />{toast}</div> : null}
    </div>
  );
}
