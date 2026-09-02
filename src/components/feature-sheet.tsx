"use client";

import Image from "next/image";
import { useState } from "react";
import { MemberQrCode } from "@/components/member-qr-code";
import { EVENTS } from "@/lib/poolbattle-data";
import type { MainFeatureId, MenuItem } from "@/lib/poolbattle-data";
import type { BattleQueuePlayer, BattleQueueSnapshot } from "@/lib/battle-queue";
import { BATTLE_GAME_VALIDITY_DAYS, MINIMUM_BATTLE_GAMES, formatThaiBattleTicketExpiry, formatThaiDayPassExpiry, getThaiDoorDate, type BattleCreditSummary, type BattleTicketPurchaseResult, type DayPassTicket, type PoolBattleMember } from "@/lib/member-access";
import {
  BellRing,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  MessageCircleMore,
  Minus,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Swords,
  TicketCheck,
  Trophy,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";

export type FeatureState = {
  queueJoined: boolean;
  competitionRegistered: boolean;
  battleReady: boolean;
};

type FeatureSheetProps = {
  item: MenuItem;
  state: FeatureState;
  member: PoolBattleMember;
  dayPass: DayPassTicket | null;
  battleCredits: BattleCreditSummary;
  battleQueue: BattleQueueSnapshot | null;
  battleQueueBusy: boolean;
  onClose: () => void;
  onPurchaseBattleGames: (games: number) => Promise<BattleTicketPurchaseResult>;
  onJoinBattleQueue: (discipline: "8-ball" | "9-ball") => Promise<void>;
  onCancelBattleQueue: () => Promise<void>;
  onAction: (action: "queue" | "register" | "ready" | "notify", message: string) => void;
};

function BattleTicketCard({ credits, onPurchase }: { credits: BattleCreditSummary; onPurchase: FeatureSheetProps["onPurchaseBattleGames"] }) {
  const [games, setGames] = useState(MINIMUM_BATTLE_GAMES);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totalAmount = games * credits.pricePerGame;

  async function handlePurchase() {
    setIsSubmitting(true);
    setError(null);
    try {
      await onPurchase(games);
    } catch (purchaseError) {
      setError(purchaseError instanceof Error ? purchaseError.message : "ไม่สามารถซื้อบัตรแข่งขันได้ กรุณาลองอีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className={`battle-credit-card ${credits.purchasedGames > 0 ? "has-credit" : "no-credit"}`} aria-label="บัตรแข่งขัน">
      <header className="battle-credit-header">
        <span><Trophy size={22} /></span>
        <div><small>BATTLE GAME CREDIT</small><strong>บัตรแข่งขัน</strong></div>
        <em>{credits.pricePerGame.toLocaleString("th-TH")} บาท/เกม</em>
      </header>
      <div className="battle-credit-summary">
        <div><span>บัตรที่ยังมีอายุ</span><strong>{credits.purchasedGames}</strong><small>เกม</small></div>
        <div className="available"><span>เกมพร้อมใช้</span><strong>{credits.availableGames}</strong><small>เกม</small></div>
      </div>
      {credits.purchasedGames === 0 ? <p className="battle-empty-note"><TicketCheck size={18} /> {credits.expiredGames > 0 ? "บัตรเดิมหมดอายุแล้ว เลือกจำนวนและซื้อใหม่ได้ทันที" : "ยังไม่ได้ซื้อบัตรแข่งขัน เลือกจำนวนและซื้อได้ทันที"}</p> : <p className="battle-ready-note"><CheckCircle2 size={18} /> มีบัตรแข่งขันพร้อมใช้งาน {credits.availableGames} เกม</p>}
      {credits.nextExpiryAt ? <div className="battle-expiry-note"><Clock3 size={19} /><span><strong>ใช้ได้ถึง {formatThaiBattleTicketExpiry(credits.nextExpiryAt)} น.</strong><small>{credits.nextExpiryGames} เกมชุดใกล้หมดอายุ • อายุบัตร {BATTLE_GAME_VALIDITY_DAYS} วัน</small></span></div> : null}
      <div className="battle-purchase-panel">
        <div className="battle-purchase-label"><span>จำนวนเกมที่ต้องการซื้อ</span><small>ขั้นต่ำ {MINIMUM_BATTLE_GAMES} เกม</small></div>
        <div className="battle-game-stepper">
          <button type="button" onClick={() => setGames((value) => Math.max(MINIMUM_BATTLE_GAMES, value - 1))} disabled={games <= MINIMUM_BATTLE_GAMES || isSubmitting} aria-label="ลดจำนวนเกม"><Minus size={20} /></button>
          <strong>{games}<small>เกม</small></strong>
          <button type="button" onClick={() => setGames((value) => Math.min(100, value + 1))} disabled={games >= 100 || isSubmitting} aria-label="เพิ่มจำนวนเกม"><Plus size={20} /></button>
        </div>
        <div className="battle-game-presets" aria-label="เลือกจำนวนเกมด่วน">
          {[5, 10, 20].map((amount) => <button type="button" className={games === amount ? "selected" : ""} onClick={() => setGames(amount)} disabled={isSubmitting} key={amount}>{amount} เกม</button>)}
        </div>
        <button className="primary-action battle-buy-button" type="button" onClick={handlePurchase} disabled={isSubmitting}>
          {isSubmitting ? <><LoaderCircle className="spin" size={20} /> กำลังซื้อบัตร...</> : <>ซื้อ {games} เกม • {totalAmount.toLocaleString("th-TH")} บาท</>}
        </button>
        <small className="battle-purchase-helper">ระบบจะเพิ่มเกมทันที และบัตรแต่ละชุดเก็บไว้ใช้ได้ {BATTLE_GAME_VALIDITY_DAYS} วัน</small>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </div>
    </section>
  );
}

function GatePass({ member, dayPass, battleCredits, onPurchaseBattleGames }: { member: PoolBattleMember; dayPass: DayPassTicket | null; battleCredits: BattleCreditSummary; onPurchaseBattleGames: FeatureSheetProps["onPurchaseBattleGames"] }) {
  const initials = member.displayName.replace("ดร.", "").trim().charAt(0) || "P";
  const doorDate = getThaiDoorDate();
  const memberScanUrl = `https://poolbattle-member-system.bbb78987.chatgpt.site/staff/result?player=${encodeURIComponent(member.playerId)}`;
  return (
    <div className="sheet-stack">
      <div className={`digital-pass ${dayPass ? "" : "inactive-pass"}`}>
        <div className="pass-topline"><span className="eyebrow">DAY PASS • {dayPass ? "ACTIVE" : "NOT ACTIVE"}</span><span className={dayPass ? "live-dot" : "pass-waiting"}>{dayPass ? "ใช้งานได้" : "ยังไม่มีบัตร"}</span></div>
        <div className="pass-identity member-photo-identity">{member.photoUrl ? <Image className="member-pass-photo" src={member.photoUrl} alt={`รูปสมาชิก ${member.displayName}`} width={82} height={92} unoptimized /> : <div className="member-pass-photo photo-fallback">{initials}</div>}<div><strong>{member.displayName}</strong><span>Player ID: {member.playerId}</span><small><ShieldCheck size={14} /> {member.photoUrl ? "ยืนยันรูปสมาชิกแล้ว" : "ยังไม่มีรูปสมาชิก"}</small></div></div>
        <div className="entry-proof-grid">
          <div className="entry-date-number"><span>วันที่ปัจจุบัน</span><strong>{doorDate.day}</strong><small>{doorDate.month} {doorDate.year}</small></div>
          <div className="pass-qr"><MemberQrCode value={memberScanUrl} label={`QR สมาชิก ${member.displayName} ${member.playerId}`} /></div>
        </div>
        {dayPass ? <div className="door-access-granted"><ShieldCheck size={24} /><span><strong>มีสิทธิ์เข้าประตู</strong><small>ใช้ได้ถึง {formatThaiDayPassExpiry(new Date(dayPass.purchasedAt))}</small></span><CheckCircle2 size={22} /></div> : null}
        <div className="pass-meta"><span><MapPin size={15} /> POOL BATTLE ARENA</span>{dayPass ? <span><TicketCheck size={15} /> {dayPass.ticketNumber}</span> : null}</div>
      </div>
      <BattleTicketCard credits={battleCredits} onPurchase={onPurchaseBattleGames} />
      <div className={`info-banner ${dayPass ? "success" : "pending"}`}>{dayPass ? <CheckCircle2 size={20} /> : <TicketCheck size={20} />}<div><strong>{dayPass ? "บัตรรอบนี้พร้อมใช้งาน" : "ต้องซื้อบัตรรอบใหม่"}</strong><span>{dayPass ? "เมื่อถึง 17:00 น. บัตรจะหมดอายุและต้องซื้อใหม่" : "QR ระบุตัวตนยังใช้ได้ แต่ไม่มีสิทธิ์เข้าประตูจนกว่าจะซื้อบัตร"}</span></div></div>
    </div>
  );
}

function DailyPass({ registered, onRegister }: { registered: boolean; onRegister: () => void }) {
  return (
    <div className="sheet-stack">
      <div className="event-hero"><span className="event-ball">8</span><div><span className="eyebrow">การแข่งขันวันนี้</span><h3>8-Ball Daily Battle</h3><p>กลุ่มละ 4 คน • Double Elimination</p></div></div>
      <div className="detail-grid">
        <div><CalendarDays size={20} /><span>1 ก.ย. 2569</span></div><div><Clock3 size={20} /><span>19:00 น.</span></div>
        <div><UsersRound size={20} /><span>17 / 20 คน</span></div><div><TicketCheck size={20} /><span>ค่าสมัคร 1,000 บาท</span></div>
      </div>
      <button className={`primary-action ${registered ? "complete" : ""}`} type="button" onClick={onRegister} disabled={registered}>
        {registered ? <><Check size={20} /> สมัครเรียบร้อยแล้ว</> : "สมัครแข่งขันวันนี้"}
      </button>
      <p className="helper-text">กติกาการแข่งขันและสายแข่งจะล็อกก่อนเริ่มรับผู้สมัคร</p>
    </div>
  );
}

function QueuePlayerIdentity({ player }: { player: BattleQueuePlayer }) {
  return (
    <div className="battle-live-player">
      <Image src={player.photoUrl} alt={`รูปสมาชิก ${player.displayName}`} width={62} height={62} unoptimized />
      <span><strong>{player.displayName}</strong><small>{player.playerId}</small></span>
    </div>
  );
}

function RankedBattleQueue({
  snapshot,
  credits,
  dayPass,
  busy,
  onJoin,
  onCancel,
  onPurchase,
}: {
  snapshot: BattleQueueSnapshot | null;
  credits: BattleCreditSummary;
  dayPass: DayPassTicket | null;
  busy: boolean;
  onJoin: FeatureSheetProps["onJoinBattleQueue"];
  onCancel: FeatureSheetProps["onCancelBattleQueue"];
  onPurchase: FeatureSheetProps["onPurchaseBattleGames"];
}) {
  const [discipline, setDiscipline] = useState<"8-ball" | "9-ball">("8-ball");
  const [error, setError] = useState<string | null>(null);
  const currentTicket = snapshot?.currentTicket ?? null;

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "ไม่สามารถอัปเดตคิวได้ กรุณาลองอีกครั้ง");
    }
  }

  return (
    <div className="sheet-stack">
      <section className="battle-rule-strip" aria-label="กติกาคะแนน Battle">
        <div><Trophy size={20} /><span>ชนะ<strong>+{snapshot?.rules.winPoints ?? 20}</strong></span></div>
        <div><Swords size={20} /><span>แพ้<strong>+{snapshot?.rules.lossPoints ?? 10}</strong></span></div>
        <div><UserRoundCheck size={20} /><span>กติกา<strong>ผู้ชนะอยู่ต่อ</strong></span></div>
      </section>

      <section className="battle-live-section">
        <header><span><i /> LIVE NOW</span><strong>กำลังแข่งขัน</strong></header>
        {!snapshot ? <div className="battle-queue-loading"><LoaderCircle className="spin" size={24} /> กำลังโหลดคิว</div> : snapshot.matches.length === 0 ? <div className="battle-empty-match"><Swords size={31} /><strong>ยังไม่มีคู่แข่งขัน</strong><span>เข้าคิวเพื่อเริ่มคู่แรกได้เลย</span></div> : snapshot.matches.map((match) => (
          <article className="battle-live-match" key={match.tableId}>
            <div className="battle-live-meta"><span>{match.tableLabel}</span><small>{match.discipline.toUpperCase()}</small></div>
            <div className="battle-live-versus">
              <QueuePlayerIdentity player={match.playerOne} />
              <b>VS</b>
              {match.playerTwo ? <QueuePlayerIdentity player={match.playerTwo} /> : <div className="battle-await-player"><UsersRound size={25} /><span>รอคู่แข่งขัน</span></div>}
            </div>
          </article>
        ))}
      </section>

      <section className="battle-waiting-section">
        <header><div><span>คิวต่อไป</span><strong>{snapshot?.waiting.length ?? 0} คน</strong></div><small>เรียงตามเวลาที่กดเข้าคิว</small></header>
        {snapshot?.waiting.length ? <div className="battle-waiting-list">{snapshot.waiting.map((player, index) => (
          <article className={currentTicket?.ticketId === player.ticketId ? "is-me" : ""} key={player.ticketId}>
            <b>{index + 1}</b><Image src={player.photoUrl} alt="" width={42} height={42} unoptimized /><span><strong>{player.displayName}</strong><small>{player.discipline.toUpperCase()} • {player.playerId}</small></span>{currentTicket?.ticketId === player.ticketId ? <em>คุณ</em> : null}
          </article>
        ))}</div> : <div className="battle-no-waiting"><CheckCircle2 size={19} /> ยังไม่มีคนรอคิว</div>}
      </section>

      <section className="battle-member-action">
        <div className="battle-credit-inline"><TicketCheck size={21} /><span><small>บัตรแข่งคงเหลือ</small><strong>{credits.availableGames} เกม</strong></span></div>
        {currentTicket ? (
          <>
            <div className={`battle-my-status status-${currentTicket.status}`}>
              <span>{currentTicket.status === "playing" ? "กำลังแข่งขัน" : currentTicket.status === "assigned" ? "รอคู่แข่งขัน" : "คิวของคุณ"}</span>
              <strong>{currentTicket.status === "waiting" ? `ลำดับ ${Math.max(1, (snapshot?.waiting.findIndex((player) => player.ticketId === currentTicket.ticketId) ?? 0) + 1)}` : currentTicket.tableLabel ?? "กำลังจัดโต๊ะ"}</strong>
            </div>
            {currentTicket.status !== "playing" ? <button className="secondary-action danger" type="button" disabled={busy} onClick={() => void run(onCancel)}>{busy ? <LoaderCircle className="spin" size={19} /> : <X size={19} />} ยกเลิกคิว</button> : <p className="battle-playing-help">เมื่อแข่งจบ ให้พนักงานสแกน QR จากบัตรสมาชิกเพื่อส่งผล</p>}
          </>
        ) : (
          <>
            <div className="battle-discipline-choice" role="group" aria-label="เลือกประเภทเกม">
              <button type="button" className={discipline === "8-ball" ? "selected" : ""} onClick={() => setDiscipline("8-ball")}>8-Ball</button>
              <button type="button" className={discipline === "9-ball" ? "selected" : ""} onClick={() => setDiscipline("9-ball")}>9-Ball</button>
            </div>
            <button className="primary-action" type="button" disabled={busy || !dayPass || credits.availableGames < 1} onClick={() => void run(() => onJoin(discipline))}>
              {busy ? <><LoaderCircle className="spin" size={20} /> กำลังรับคิว</> : <><Swords size={20} /> เข้าคิวเล่นฟรี</>}
            </button>
            {!dayPass ? <p className="battle-action-warning">ต้องมีบัตรเข้ารอบปัจจุบันก่อนเข้าคิว</p> : credits.availableGames < 1 ? <p className="battle-action-warning">ซื้อบัตรแข่งขั้นต่ำ 5 เกมก่อนเข้าคิว</p> : <p className="battle-action-helper">ระบบจะหัก 1 เกมต่อคนเมื่อ Admin ยืนยันผลแล้ว</p>}
          </>
        )}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </section>

      {credits.availableGames < 1 ? <BattleTicketCard credits={credits} onPurchase={onPurchase} /> : null}
    </div>
  );
}

function BattleQueue({ ready, onReady }: { ready: boolean; onReady: () => void }) {
  return (
    <div className="sheet-stack">
      <div className="versus-card">
        <div className="competitor"><span>ป</span><strong>ดร.ป็อบ</strong><small>Rank #7</small></div>
        <div className="versus-center"><span>VS</span><small>8-BALL</small></div>
        <div className="competitor"><span>น</span><strong>นัท คิวทอง</strong><small>Rank #2</small></div>
      </div>
      <div className="match-callout"><div><Clock3 size={22} /><span>เวลาเรียกแข่ง<strong>20:30 น.</strong></span></div><div><Swords size={22} /><span>โต๊ะแข่งขัน<strong>โต๊ะ 5</strong></span></div></div>
      <button className={`primary-action ${ready ? "complete" : ""}`} type="button" onClick={onReady} disabled={ready}>{ready ? <><UserRoundCheck size={20} /> ยืนยันพร้อมแข่งแล้ว</> : "ยืนยันพร้อมแข่ง"}</button>
    </div>
  );
}

function EventList({ onNotify }: { onNotify: (name: string) => void }) {
  return (
    <div className="event-list">
      {EVENTS.map((event) => (
        <article className="event-row" key={event.name}>
          <div className="event-date"><strong>{event.date.split(" ")[0]}</strong><span>{event.date.split(" ")[1]}</span></div>
          <div className="event-row-copy"><strong>{event.name}</strong><span>{event.detail}</span><small>{event.time} • {event.seats}</small></div>
          <button type="button" aria-label={`แจ้งเตือน ${event.name}`} onClick={() => onNotify(event.name)}><BellRing size={18} /></button>
        </article>
      ))}
    </div>
  );
}

function Margie({ onQuickAction }: { onQuickAction: (message: string) => void }) {
  return (
    <div className="sheet-stack">
      <div className="margie-profile"><span className="margie-large" aria-hidden="true" /><div><span className="eyebrow">POOL BATTLE ASSISTANT</span><h3>สวัสดีค่ะ มารกี้ช่วยอะไรได้บ้าง?</h3></div></div>
      <div className="quick-actions">
        {["เช็กคิวของฉัน", "ดูแมตช์ถัดไป", "สรุปคะแนนเดือนนี้", "สอบถามกติกา 8-Ball"].map((label) => (
          <button type="button" key={label} onClick={() => onQuickAction(label)}><Sparkles size={17} />{label}<ChevronRight size={17} /></button>
        ))}
      </div>
      <button className="primary-action chat-action" type="button" onClick={() => onQuickAction("เริ่มคุยกับมารกี้")}><MessageCircleMore size={20} /> เริ่มคุยกับมารกี้</button>
    </div>
  );
}

function SheetContent({ id, state, member, dayPass, battleCredits, battleQueue, battleQueueBusy, onPurchaseBattleGames, onJoinBattleQueue, onCancelBattleQueue, onAction }: { id: MainFeatureId; state: FeatureState; member: PoolBattleMember; dayPass: DayPassTicket | null; battleCredits: BattleCreditSummary; battleQueue: BattleQueueSnapshot | null; battleQueueBusy: boolean; onPurchaseBattleGames: FeatureSheetProps["onPurchaseBattleGames"]; onJoinBattleQueue: FeatureSheetProps["onJoinBattleQueue"]; onCancelBattleQueue: FeatureSheetProps["onCancelBattleQueue"]; onAction: FeatureSheetProps["onAction"] }) {
  switch (id) {
    case "gate-pass": return <GatePass member={member} dayPass={dayPass} battleCredits={battleCredits} onPurchaseBattleGames={onPurchaseBattleGames} />;
    case "daily-pass": return <DailyPass registered={state.competitionRegistered} onRegister={() => onAction("register", "สมัคร 8-Ball Daily Battle เรียบร้อยแล้ว")} />;
    case "free-queue": return <RankedBattleQueue snapshot={battleQueue} credits={battleCredits} dayPass={dayPass} busy={battleQueueBusy} onJoin={onJoinBattleQueue} onCancel={onCancelBattleQueue} onPurchase={onPurchaseBattleGames} />;
    case "battle-queue": return <BattleQueue ready={state.battleReady} onReady={() => onAction("ready", "ยืนยันพร้อมแข่งเรียบร้อยแล้ว")} />;
    case "events": return <EventList onNotify={(name) => onAction("notify", `เปิดแจ้งเตือน ${name} แล้ว`)} />;
    case "margie": return <Margie onQuickAction={(message) => onAction("notify", `มารกี้กำลังช่วย: ${message}`)} />;
  }
}

export function FeatureSheet({ item, state, member, dayPass, battleCredits, battleQueue, battleQueueBusy, onClose, onPurchaseBattleGames, onJoinBattleQueue, onCancelBattleQueue, onAction }: FeatureSheetProps) {
  return (
    <div className="sheet-layer" role="presentation">
      <button className="sheet-backdrop" type="button" onClick={onClose} aria-label="ปิดหน้าต่าง" />
      <section className="feature-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header"><div><span>เมนู {item.number}</span><h2 id="sheet-title">{item.title}</h2></div><button type="button" onClick={onClose} aria-label="ปิด"><X size={22} /></button></header>
        <div className="sheet-body"><SheetContent id={item.id} state={state} member={member} dayPass={dayPass} battleCredits={battleCredits} battleQueue={battleQueue} battleQueueBusy={battleQueueBusy} onPurchaseBattleGames={onPurchaseBattleGames} onJoinBattleQueue={onJoinBattleQueue} onCancelBattleQueue={onCancelBattleQueue} onAction={onAction} /></div>
      </section>
    </div>
  );
}
