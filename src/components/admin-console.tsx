"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  BookOpenText,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Crown,
  DoorOpen,
  FileClock,
  Gamepad2,
  Gauge,
  LayoutDashboard,
  ListOrdered,
  LoaderCircle,
  LockKeyhole,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TableProperties,
  Target,
  TicketCheck,
  Trophy,
  UserCog,
  UsersRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import type {
  AdminActionResponse,
  AdminCompetition,
  AdminDashboardData,
  AdminMember,
  AdminQueueTicket,
  AdminResult,
  AdminStaffMember,
} from "@/lib/admin-types";

type SectionId = "overview" | "operations" | "members" | "competitions" | "ranking" | "staff" | "content" | "settings";
type ActionPayload = Record<string, string | number | boolean | null | undefined>;
type RunAction = (payload: ActionPayload, key: string) => Promise<boolean>;

const NAV_ITEMS: Array<{ id: SectionId; label: string; icon: typeof Gauge }> = [
  { id: "overview", label: "ภาพรวม", icon: LayoutDashboard },
  { id: "operations", label: "สนามและคิว", icon: Activity },
  { id: "members", label: "สมาชิก", icon: UsersRound },
  { id: "competitions", label: "การแข่งขัน", icon: Trophy },
  { id: "ranking", label: "อันดับและรางวัล", icon: Crown },
  { id: "staff", label: "พนักงาน", icon: UserCog },
  { id: "content", label: "ข่าวสาร", icon: Newspaper },
  { id: "settings", label: "ตั้งค่าและ Audit", icon: Settings2 },
];

const STATUS_LABELS: Record<string, string> = {
  active: "ใช้งาน",
  blocked: "ระงับ",
  inactive: "ปิดใช้งาน",
  available: "ว่าง",
  occupied: "กำลังใช้",
  maintenance: "ซ่อมบำรุง",
  waiting: "รอคิว",
  called: "เรียกแล้ว",
  assigned: "มอบหมายโต๊ะ",
  playing: "กำลังเล่น",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
  no_show: "ไม่มา",
  draft: "ฉบับร่าง",
  registration_open: "เปิดรับสมัคร",
  locked: "ล็อกรายชื่อ",
  result_submitted: "รอตรวจสอบ",
  confirmed: "ยืนยันแล้ว",
  rejected: "ปฏิเสธ",
  published: "เผยแพร่",
  open: "เปิดตรวจสอบ",
  investigating: "กำลังตรวจสอบ",
  cleared: "ไม่พบความเสี่ยง",
  appealed: "อุทธรณ์",
  closed: "ปิดเรื่อง",
};

function formatMoney(value: number) {
  return `฿${value.toLocaleString("th-TH")}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(Date.UTC(year, month - 1, 15, 12)));
}

function statusClass(status: string) {
  if (["active", "available", "confirmed", "published", "completed"].includes(status)) return "success";
  if (["blocked", "rejected", "cancelled", "critical"].includes(status)) return "danger";
  if (["waiting", "called", "result_submitted", "maintenance", "investigating"].includes(status)) return "warning";
  return "neutral";
}

function EmptyState({ icon: Icon, title, detail }: { icon: typeof Gauge; title: string; detail: string }) {
  return <div className="admin-empty"><Icon size={31} /><strong>{title}</strong><span>{detail}</span></div>;
}

function SectionTitle({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="admin-section-title"><div><span>{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div>{action}</div>;
}

function MetricCard({ icon: Icon, label, value, detail, tone = "green" }: { icon: typeof Gauge; label: string; value: string | number; detail: string; tone?: string }) {
  return <article className={`admin-metric tone-${tone}`}><span className="metric-icon"><Icon size={22} /></span><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function OverviewSection({ data, onNavigate }: { data: AdminDashboardData; onNavigate: (id: SectionId) => void }) {
  const pending = data.results.filter((item) => item.status === "result_submitted").slice(0, 4);
  return <div className="admin-section-stack">
    <SectionTitle eyebrow="LIVE CONTROL" title="ภาพรวมการดำเนินงาน" detail={`รอบสนาม ${data.businessDate} • บัตรตัดรอบ ${formatDateTime(data.passExpiresAt)}`} />
    <div className="admin-metrics-grid">
      <MetricCard icon={UsersRound} label="สมาชิกทั้งหมด" value={data.summary.totalMembers} detail={`${data.summary.activeMembers} บัญชีใช้งาน`} />
      <MetricCard icon={DoorOpen} label="บัตรรอบนี้" value={data.summary.activePasses} detail={`รายได้ ${formatMoney(data.summary.passRevenue)}`} tone="gold" />
      <MetricCard icon={ClipboardCheck} label="ผลรอตรวจ" value={data.summary.pendingResults} detail="ยังไม่เพิ่มคะแนน" tone={data.summary.pendingResults ? "orange" : "green"} />
      <MetricCard icon={ListOrdered} label="คิวที่กำลังดำเนินการ" value={data.summary.openQueues} detail={`${data.summary.availableTables} โต๊ะว่าง`} tone="blue" />
      <MetricCard icon={WalletCards} label="กองรางวัลเดือนนี้" value={formatMoney(data.summary.rewardPool)} detail={formatPeriod(data.period)} tone="gold" />
      <MetricCard icon={ShieldAlert} label="ความเสี่ยงที่เปิดอยู่" value={data.summary.openRisks} detail="ต้องมีผู้รับผิดชอบ" tone={data.summary.openRisks ? "red" : "green"} />
    </div>

    <div className="admin-two-column">
      <section className="admin-panel">
        <div className="panel-head"><div><span className="panel-icon"><ClipboardCheck /></span><div><h3>ผลการแข่งขันรออนุมัติ</h3><p>ยืนยันแล้วจึงลง Monthly และ Lifetime Points</p></div></div><button type="button" onClick={() => onNavigate("competitions")}>ดูทั้งหมด <ChevronRight size={17} /></button></div>
        {pending.length ? <div className="compact-result-list">{pending.map((item) => <article key={item.id}><span className={`result-dot ${item.outcome}`} /> <div><strong>{item.displayName}</strong><small>{item.discipline.toUpperCase()} • {item.playerScore}-{item.opponentScore} • พนักงาน {item.staffCode}</small></div><span className="admin-status warning">รอตรวจ</span></article>)}</div> : <EmptyState icon={BadgeCheck} title="ตรวจผลครบแล้ว" detail="ไม่มีผลการแข่งขันค้างอนุมัติ" />}
      </section>

      <section className="admin-panel">
        <div className="panel-head"><div><span className="panel-icon"><FileClock /></span><div><h3>เช็กลิสต์กะวันนี้</h3><p>งานสำคัญก่อนเปิดและปิดรอบ</p></div></div></div>
        <div className="shift-checklist">
          <div className={data.tables.some((table) => table.status === "maintenance") ? "attention" : "done"}><span>{data.tables.some((table) => table.status === "maintenance") ? <AlertTriangle /> : <Check />}</span><p><strong>ตรวจสภาพโต๊ะและสนาม</strong><small>{data.tables.filter((table) => table.status === "maintenance").length} โต๊ะซ่อมบำรุง</small></p></div>
          <div className={data.summary.pendingResults ? "attention" : "done"}><span>{data.summary.pendingResults ? <Clock3 /> : <Check />}</span><p><strong>ตรวจผลการแข่งขัน</strong><small>{data.summary.pendingResults} รายการรออนุมัติ</small></p></div>
          <div className={data.summary.openRisks ? "attention" : "done"}><span>{data.summary.openRisks ? <ShieldAlert /> : <Check />}</span><p><strong>ตรวจความเสี่ยงและข้อพิพาท</strong><small>{data.summary.openRisks} รายการเปิดอยู่</small></p></div>
          <div className="neutral"><span><Banknote /></span><p><strong>กระทบยอดรอบสนาม</strong><small>ยอดบัตร {formatMoney(data.summary.passRevenue)}</small></p></div>
        </div>
      </section>
    </div>
  </div>;
}

function QueueCard({ queue, data, onAction, busyKey }: { queue: AdminQueueTicket; data: AdminDashboardData; onAction: RunAction; busyKey: string | null }) {
  const [tableId, setTableId] = useState(queue.tableId ?? "");
  const availableTables = data.tables.filter((table) => table.status === "available" || table.id === queue.tableId);
  const key = `queue-${queue.id}`;
  const busy = busyKey === key;
  const nextStatus = queue.status === "waiting" ? "called" : queue.status === "called" ? "assigned" : queue.status === "assigned" ? "playing" : "completed";
  return <article className="queue-admin-card">
    <span className="queue-number">{queue.position}</span>
    <div className="queue-admin-copy"><strong>{queue.displayName}</strong><span>{queue.queueType === "battle" ? "คิวแข่งขัน" : "คิวเล่นฟรี"} • {queue.discipline.toUpperCase()}</span><small>{queue.playerId ?? "ลูกค้าหน้างาน"} • {formatDateTime(queue.joinedAt)}</small></div>
    <span className={`admin-status ${statusClass(queue.status)}`}>{STATUS_LABELS[queue.status] ?? queue.status}</span>
    <div className="queue-admin-action">
      {queue.status === "called" ? <select value={tableId} onChange={(event) => setTableId(event.target.value)} aria-label="เลือกโต๊ะ"><option value="">เลือกโต๊ะ</option>{availableTables.map((table) => <option key={table.id} value={table.id}>{table.label}</option>)}</select> : null}
      <button type="button" disabled={busy} onClick={() => void onAction({ action: "queue-status", id: queue.id, status: nextStatus, tableId: queue.status === "called" ? tableId : queue.tableId }, key)}>{busy ? <LoaderCircle className="spin" /> : <ChevronRight />} {STATUS_LABELS[nextStatus]}</button>
      <button className="ghost-danger" type="button" disabled={busy} onClick={() => void onAction({ action: "queue-status", id: queue.id, status: "cancelled", tableId: null }, key)}>ยกเลิก</button>
    </div>
  </article>;
}

function OperationsSection({ data, onAction, busyKey }: { data: AdminDashboardData; onAction: RunAction; busyKey: string | null }) {
  const submitQueue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    void onAction({ action: "queue-create", playerId: String(values.get("playerId") ?? ""), displayName: String(values.get("displayName") ?? ""), queueType: String(values.get("queueType") ?? "casual"), discipline: String(values.get("discipline") ?? "8-ball") }, "queue-create").then((success) => { if (success) form.reset(); });
  };
  return <div className="admin-section-stack">
    <SectionTitle eyebrow="VENUE OPERATIONS" title="สนาม โต๊ะ และคิว" detail="ควบคุมสถานะหน้างานแบบจุดเดียว พร้อมประวัติทุกการเปลี่ยนแปลง" />
    <section className="admin-panel">
      <div className="panel-head"><div><span className="panel-icon"><TableProperties /></span><div><h3>สถานะโต๊ะ</h3><p>{data.tables.filter((table) => table.status === "available").length} ว่าง • {data.tables.filter((table) => table.status === "occupied").length} ใช้งาน • {data.tables.filter((table) => table.status === "maintenance").length} ซ่อม</p></div></div></div>
      <div className="venue-table-grid">{data.tables.map((table) => {
        const key = `table-${table.id}`;
        const busy = busyKey === key;
        const nextStatus = table.status === "maintenance" ? "available" : "maintenance";
        return <article className={`venue-table-card ${table.status}`} key={table.id}><span><Gamepad2 /></span><div><strong>{table.label}</strong><small>{table.tableType} {table.currentPlayer ? `• ${table.currentPlayer}` : ""}</small></div><span className={`admin-status ${statusClass(table.status)}`}>{STATUS_LABELS[table.status]}</span><button type="button" disabled={busy || table.status === "occupied"} onClick={() => void onAction({ action: "table-status", id: table.id, status: nextStatus, reason: nextStatus === "maintenance" ? "นำโต๊ะเข้าซ่อมบำรุง" : "ตรวจสอบแล้วพร้อมใช้งาน" }, key)}>{busy ? <LoaderCircle className="spin" /> : nextStatus === "maintenance" ? "แจ้งซ่อม" : "เปิดโต๊ะ"}</button></article>;
      })}</div>
    </section>

    <div className="admin-two-column operations-columns">
      <section className="admin-panel">
        <div className="panel-head"><div><span className="panel-icon"><Plus /></span><div><h3>เพิ่มคิวหน้างาน</h3><p>ใช้ Player ID หรือกรอกชื่อแขก</p></div></div></div>
        <form className="admin-form" onSubmit={submitQueue}>
          <label><span>Player ID</span><input name="playerId" placeholder="PB-2026-XXXXXX" /></label>
          <label><span>ชื่อผู้เล่น (กรณีไม่มี ID)</span><input name="displayName" placeholder="ชื่อที่ใช้เรียกคิว" /></label>
          <div className="form-grid-2"><label><span>ประเภทคิว</span><select name="queueType"><option value="casual">คิวเล่นฟรี</option><option value="battle">คิวแข่งขัน</option></select></label><label><span>ประเภทเกม</span><select name="discipline"><option value="8-ball">8-Ball</option><option value="9-ball">9-Ball</option></select></label></div>
          <button className="admin-primary" type="submit" disabled={busyKey === "queue-create"}>{busyKey === "queue-create" ? <LoaderCircle className="spin" /> : <Plus />} เพิ่มเข้าคิว</button>
        </form>
      </section>
      <section className="admin-panel queue-live-panel">
        <div className="panel-head"><div><span className="panel-icon"><ListOrdered /></span><div><h3>คิวที่กำลังดำเนินการ</h3><p>{data.queues.length} รายการ</p></div></div></div>
        {data.queues.length ? <div className="queue-admin-list">{data.queues.map((queue) => <QueueCard key={queue.id} queue={queue} data={data} onAction={onAction} busyKey={busyKey} />)}</div> : <EmptyState icon={ListOrdered} title="ยังไม่มีคิว" detail="เพิ่มคิวจากแบบฟอร์มด้านซ้าย" />}
      </section>
    </div>

    <section className="admin-panel">
      <div className="panel-head"><div><span className="panel-icon"><TicketCheck /></span><div><h3>รายการซื้อบัตรล่าสุด</h3><p>แสดงเฉพาะคำสั่งซื้อที่บันทึกในระบบ</p></div></div></div>
      {data.orders.length ? <div className="admin-table-wrap"><table><thead><tr><th>เวลา</th><th>รหัสรายการ</th><th>จำนวน</th><th>ยอดเงิน</th><th>สถานะ</th></tr></thead><tbody>{data.orders.map((order) => <tr key={order.id}><td>{formatDateTime(order.purchasedAt)}</td><td className="mono">{order.id.slice(0, 8).toUpperCase()}</td><td>{order.quantity} ใบ</td><td>{formatMoney(order.totalAmount)}</td><td><span className={`admin-status ${statusClass(order.paymentStatus === "confirmed" ? "confirmed" : order.paymentStatus)}`}>{order.paymentStatus === "confirmed" ? "สำเร็จ" : order.paymentStatus}</span></td></tr>)}</tbody></table></div> : <EmptyState icon={TicketCheck} title="ยังไม่มีรายการบัตร" detail="รายการสั่งซื้อจะแสดงที่นี่" />}
    </section>
  </div>;
}

function MemberAdminRow({ member, onAction, busyKey }: { member: AdminMember; onAction: RunAction; busyKey: string | null }) {
  const [reason, setReason] = useState("");
  const key = `member-${member.id}`;
  const nextStatus = member.status === "active" ? "blocked" : "active";
  return <article className="member-admin-row">
    <Image src={member.photoUrl} alt={`รูป ${member.displayName}`} width={52} height={52} unoptimized />
    <div><strong>{member.displayName}</strong><span>{member.playerId}</span><small>{member.maskedPhone} • สมัคร {formatDateTime(member.joinedAt)}</small></div>
    <div className="member-points"><span>เดือนนี้<strong>{member.monthlyPoints}</strong></span><span>Lifetime<strong>{member.lifetimePoints}</strong></span></div>
    <span className={`admin-status ${statusClass(member.status)}`}>{STATUS_LABELS[member.status]}</span>
    <div className="member-admin-action"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={nextStatus === "blocked" ? "เหตุผลที่ระงับ" : "เหตุผลที่เปิดใช้งาน"} /><button className={nextStatus === "blocked" ? "admin-danger" : "admin-secondary"} type="button" disabled={busyKey === key || reason.trim().length < 3} onClick={() => void onAction({ action: "member-status", id: member.id, status: nextStatus, reason }, key).then((success) => { if (success) setReason(""); })}>{busyKey === key ? <LoaderCircle className="spin" /> : nextStatus === "blocked" ? <LockKeyhole /> : <BadgeCheck />} {nextStatus === "blocked" ? "ระงับ" : "เปิดใช้งาน"}</button></div>
  </article>;
}

function MembersSection({ data, onAction, busyKey }: { data: AdminDashboardData; onAction: RunAction; busyKey: string | null }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? data.members.filter((member) => `${member.displayName} ${member.playerId} ${member.maskedPhone}`.toLowerCase().includes(needle)) : data.members;
  }, [data.members, query]);
  return <div className="admin-section-stack">
    <SectionTitle eyebrow="MEMBER DESK" title="จัดการสมาชิก" detail="ค้นหา ตรวจสอบคะแนน และระงับบัญชีโดยบันทึกเหตุผลทุกครั้ง" action={<label className="admin-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ, Player ID" /></label>} />
    <div className="member-summary-strip"><span><UsersRound /> สมาชิก {data.summary.totalMembers}</span><span><BadgeCheck /> ใช้งาน {data.summary.activeMembers}</span><span><LockKeyhole /> ระงับ {data.summary.totalMembers - data.summary.activeMembers}</span></div>
    <section className="admin-panel member-list-panel">{filtered.length ? <div className="member-admin-list">{filtered.map((member) => <MemberAdminRow key={member.id} member={member} onAction={onAction} busyKey={busyKey} />)}</div> : <EmptyState icon={Search} title="ไม่พบสมาชิก" detail="ลองค้นด้วยชื่อหรือ Player ID" />}</section>
  </div>;
}

function ResultReviewRow({ result, onAction, busyKey }: { result: AdminResult; onAction: RunAction; busyKey: string | null }) {
  const [reason, setReason] = useState("");
  const key = `result-${result.id}`;
  const pending = result.status === "result_submitted";
  return <article className={`result-review-row ${pending ? "pending" : ""}`}>
    <div className={`result-outcome ${result.outcome}`}>{result.outcome === "win" ? "W" : "L"}</div>
    <div className="result-review-copy"><strong>{result.displayName}</strong><span>{result.playerId} {result.opponentPlayerId ? `vs ${result.opponentPlayerId}` : ""}</span><small>{result.discipline.toUpperCase()} • {result.playerScore}-{result.opponentScore} • {formatDateTime(result.submittedAt)} • พนักงาน {result.staffCode}</small></div>
    <span className={`admin-status ${statusClass(result.status)}`}>{STATUS_LABELS[result.status] ?? result.status}</span>
    {pending ? <div className="result-review-action"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="เหตุผลการตรวจ เช่น ตรวจสกอร์และรูปแล้ว" /><button className="admin-secondary" type="button" disabled={busyKey === key || reason.trim().length < 3} onClick={() => void onAction({ action: "review-result", id: result.id, decision: "confirm", reason }, key).then((success) => { if (success) setReason(""); })}>{busyKey === key ? <LoaderCircle className="spin" /> : <CheckCircle2 />} ยืนยัน</button><button className="admin-danger" type="button" disabled={busyKey === key || reason.trim().length < 3} onClick={() => void onAction({ action: "review-result", id: result.id, decision: "reject", reason }, key)}><XCircle /> ปฏิเสธ</button></div> : null}
  </article>;
}

function CompetitionCard({ item, onAction, busyKey }: { item: AdminCompetition; onAction: RunAction; busyKey: string | null }) {
  const [status, setStatus] = useState(item.status);
  const [reason, setReason] = useState("");
  const key = `competition-${item.id}`;
  return <article className="competition-admin-card"><div className={`competition-ball ball-${item.discipline === "8-ball" ? "8" : "9"}`}>{item.discipline === "8-ball" ? "8" : "9"}</div><div><strong>{item.name}</strong><span>{formatDateTime(item.startsAt)} • {item.registrations}/{item.capacity} คน</span><small>ค่าสมัคร {formatMoney(item.entryFee)} • {item.rulesetVersion}</small></div><span className={`admin-status ${statusClass(item.status)}`}>{STATUS_LABELS[item.status] ?? item.status}</span><div className="competition-status-form"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="draft">ฉบับร่าง</option><option value="registration_open">เปิดรับสมัคร</option><option value="locked">ล็อกรายชื่อ</option><option value="active">กำลังแข่งขัน</option><option value="completed">จบรายการ</option><option value="cancelled">ยกเลิก</option></select><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="เหตุผล (กรณีเปลี่ยนสำคัญ)" /><button type="button" disabled={busyKey === key || status === item.status} onClick={() => void onAction({ action: "competition-status", id: item.id, status, reason }, key)}>บันทึก</button></div></article>;
}

function CompetitionsSection({ data, onAction, busyKey }: { data: AdminDashboardData; onAction: RunAction; busyKey: string | null }) {
  const submitCompetition = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const localStart = String(values.get("startsAt") ?? "");
    const startsAt = localStart ? new Date(localStart).toISOString() : "";
    void onAction({ action: "competition-create", name: String(values.get("name") ?? ""), discipline: String(values.get("discipline") ?? "8-ball"), startsAt, capacity: Number(values.get("capacity")), entryFee: Number(values.get("entryFee")), rulesetVersion: String(values.get("rulesetVersion") ?? "PB-RULES-1") }, "competition-create").then((success) => { if (success) form.reset(); });
  };
  const pendingCount = data.results.filter((item) => item.status === "result_submitted").length;
  return <div className="admin-section-stack">
    <SectionTitle eyebrow="COMPETITION CONTROL" title="จัดการแข่งขันและอนุมัติผล" detail="สร้างรายการ ล็อกกติกา ตรวจผล และลงคะแนนจากหลักฐานที่ยืนยันแล้ว" />
    <div className="admin-two-column competition-create-grid">
      <section className="admin-panel"><div className="panel-head"><div><span className="panel-icon"><CalendarClock /></span><div><h3>สร้างการแข่งขัน</h3><p>เริ่มเป็นฉบับร่างก่อนเปิดรับสมัคร</p></div></div></div><form className="admin-form" onSubmit={submitCompetition}><label><span>ชื่อรายการ</span><input name="name" required placeholder="เช่น 8-Ball Daily Battle" /></label><div className="form-grid-2"><label><span>ประเภทเกม</span><select name="discipline"><option value="8-ball">8-Ball</option><option value="9-ball">9-Ball</option></select></label><label><span>วันและเวลา</span><input name="startsAt" type="datetime-local" required /></label></div><div className="form-grid-2"><label><span>จำนวนสูงสุด</span><input name="capacity" type="number" min="4" max="256" defaultValue="20" required /></label><label><span>ค่าสมัคร</span><input name="entryFee" type="number" min="0" defaultValue="1000" required /></label></div><label><span>Ruleset Version</span><input name="rulesetVersion" defaultValue={data.settings.ruleset_version ?? "PB-RULES-1"} required /></label><button className="admin-primary" type="submit" disabled={busyKey === "competition-create"}>{busyKey === "competition-create" ? <LoaderCircle className="spin" /> : <Plus />} สร้างฉบับร่าง</button></form></section>
      <section className="admin-panel"><div className="panel-head"><div><span className="panel-icon"><Trophy /></span><div><h3>รายการแข่งขัน</h3><p>{data.competitions.length} รายการในระบบ</p></div></div></div>{data.competitions.length ? <div className="competition-admin-list">{data.competitions.map((item) => <CompetitionCard key={item.id} item={item} onAction={onAction} busyKey={busyKey} />)}</div> : <EmptyState icon={Trophy} title="ยังไม่มีรายการแข่งขัน" detail="สร้างรายการแรกจากแบบฟอร์มด้านซ้าย" />}</section>
    </div>
    <section className="admin-panel"><div className="panel-head"><div><span className="panel-icon"><ClipboardCheck /></span><div><h3>ตรวจผลการแข่งขัน</h3><p>{pendingCount} รายการรออนุมัติ • คะแนนชนะ 3 แต้มต่อผลที่ยืนยัน</p></div></div><span className={`admin-status ${pendingCount ? "warning" : "success"}`}>{pendingCount ? `${pendingCount} รอตรวจ` : "ตรวจครบ"}</span></div>{data.results.length ? <div className="result-review-list">{data.results.map((result) => <ResultReviewRow key={result.id} result={result} onAction={onAction} busyKey={busyKey} />)}</div> : <EmptyState icon={ClipboardCheck} title="ยังไม่มีผลการแข่งขัน" detail="ผลที่พนักงานบันทึกผ่าน QR จะแสดงที่นี่" />}</section>
  </div>;
}

function RankingSection({ data, onAction, busyKey }: { data: AdminDashboardData; onAction: RunAction; busyKey: string | null }) {
  const [rewardType, setRewardType] = useState("fnb_contribution");
  const submitReward = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    void onAction({ action: "reward-add", rewardType, grossSales: Number(values.get("grossSales")), amount: Number(values.get("amount")), sourceRef: String(values.get("sourceRef") ?? ""), reason: String(values.get("reason") ?? "") }, "reward-add").then((success) => { if (success) form.reset(); });
  };
  const shares = [0.40, 0.25, 0.15, 0.12, 0.08];
  return <div className="admin-section-stack">
    <SectionTitle eyebrow="RANKING & REWARD" title="อันดับและกองรางวัล" detail="ยอดกองรางวัลเป็นบัญชีแยก ตรวจย้อนกลับได้ และไม่ใช้ยอดซื้อเป็นคะแนน" />
    <div className="reward-hero-admin"><div><span>MONTHLY PLAYER REWARD POOL</span><strong>{formatMoney(data.summary.rewardPool)}</strong><small>{formatPeriod(data.period)} • อันดับ 1-5 แบ่ง 40/25/15/12/8%</small></div><Crown size={72} /></div>
    <div className="admin-two-column reward-columns">
      <section className="admin-panel"><div className="panel-head"><div><span className="panel-icon"><WalletCards /></span><div><h3>เพิ่มรายการกองรางวัล</h3><p>F&B จะคำนวณ 10% ให้อัตโนมัติ</p></div></div></div><form className="admin-form" onSubmit={submitReward}><label><span>ประเภทรายการ</span><select value={rewardType} onChange={(event) => setRewardType(event.target.value)}><option value="fnb_contribution">ยอดขายอาหาร/เครื่องดื่ม 10%</option><option value="sponsor">เงินสนับสนุน</option><option value="adjustment">รายการปรับปรุง</option></select></label>{rewardType === "fnb_contribution" ? <label><span>ยอดขาย F&B ทั้งหมด</span><input name="grossSales" type="number" min="1" required placeholder="500000" /></label> : <label><span>จำนวนเงินเข้ากองรางวัล</span><input name="amount" type="number" required placeholder="50000" /></label>}<label><span>เลขอ้างอิง</span><input name="sourceRef" required placeholder="POS-2026-09-001" /></label><label><span>เหตุผล/หลักฐาน</span><textarea name="reason" required placeholder="สรุปยอดขายที่ชำระสำเร็จและตรวจสอบแล้ว" /></label><button className="admin-primary" type="submit" disabled={busyKey === "reward-add"}>{busyKey === "reward-add" ? <LoaderCircle className="spin" /> : <Plus />} บันทึกเข้ากองรางวัล</button></form></section>
      <section className="admin-panel"><div className="panel-head"><div><span className="panel-icon"><Crown /></span><div><h3>ประมาณการรางวัล Top 5</h3><p>จ่ายจริงหลังปิดเดือนและตรวจสิทธิ์</p></div></div></div><div className="prize-preview-list">{shares.map((share, index) => <div key={share}><span className={`prize-rank rank-${index + 1}`}>{index + 1}</span><p><strong>{data.ranking[index]?.displayName ?? "รอผู้เล่น"}</strong><small>{Math.round(share * 100)}% ของกองรางวัล</small></p><strong>{formatMoney(Math.round(data.summary.rewardPool * share))}</strong></div>)}</div></section>
    </div>
    <section className="admin-panel"><div className="panel-head"><div><span className="panel-icon"><Target /></span><div><h3>Battle Ranking</h3><p>คะแนนจากผลที่ Admin ยืนยันแล้วเท่านั้น</p></div></div></div>{data.ranking.length ? <div className="admin-table-wrap"><table className="ranking-admin-table"><thead><tr><th>อันดับ</th><th>ผู้เล่น</th><th>Monthly</th><th>Lifetime</th><th>ชนะ/แพ้</th><th>สิทธิ์รางวัล</th></tr></thead><tbody>{data.ranking.map((row, index) => <tr key={row.memberId}><td><span className={`rank-number rank-${index + 1}`}>{index + 1}</span></td><td><div className="table-player"><Image src={row.photoUrl} alt="" width={38} height={38} unoptimized /><span><strong>{row.displayName}</strong><small>{row.playerId}</small></span></div></td><td><strong>{row.monthlyPoints}</strong></td><td>{row.lifetimePoints}</td><td>{row.confirmedWins}W / {row.confirmedLosses}L</td><td><span className="admin-status warning">รอหลักฐาน 5 วัน/10 กลุ่ม</span></td></tr>)}</tbody></table></div> : <EmptyState icon={Target} title="ยังไม่มีคะแนนยืนยัน" detail="อนุมัติผลการแข่งขันแล้วอันดับจะอัปเดต" />}</section>
    <section className="admin-panel"><div className="panel-head"><div><span className="panel-icon"><BookOpenText /></span><div><h3>สมุดรายการกองรางวัล</h3><p>รายการเป็นแบบเพิ่มต่อท้าย ไม่แก้ยอดย้อนหลัง</p></div></div></div>{data.rewardEntries.length ? <div className="admin-table-wrap"><table><thead><tr><th>เวลา</th><th>ประเภท</th><th>อ้างอิง</th><th>เหตุผล</th><th>จำนวน</th></tr></thead><tbody>{data.rewardEntries.map((entry) => <tr key={entry.id}><td>{formatDateTime(entry.createdAt)}</td><td>{entry.entryType}</td><td className="mono">{entry.sourceRef}</td><td>{entry.reason}</td><td className={entry.amount >= 0 ? "positive-money" : "negative-money"}>{entry.amount >= 0 ? "+" : ""}{formatMoney(entry.amount)}</td></tr>)}</tbody></table></div> : <EmptyState icon={WalletCards} title="กองรางวัลยังไม่มีรายการ" detail="เพิ่มยอดขาย F&B หรือเงินสนับสนุนจากแบบฟอร์มด้านบน" />}</section>
  </div>;
}

function StaffCard({ staff, onAction, busyKey }: { staff: AdminStaffMember; onAction: RunAction; busyKey: string | null }) {
  const key = `staff-${staff.id}`;
  const nextStatus = staff.status === "active" ? "inactive" : "active";
  return <article className="staff-admin-card"><span className="staff-avatar"><UserCog /></span><div><strong>{staff.displayName}</strong><span>{staff.staffCode}</span><small>{staff.role} • อัปเดต {formatDateTime(staff.updatedAt)}</small></div><span className={`admin-status ${statusClass(staff.status)}`}>{STATUS_LABELS[staff.status]}</span><button type="button" disabled={busyKey === key} onClick={() => void onAction({ action: "staff-save", staffCode: staff.staffCode, displayName: staff.displayName, role: staff.role, status: nextStatus }, key)}>{busyKey === key ? <LoaderCircle className="spin" /> : nextStatus === "active" ? "เปิดใช้" : "ปิดใช้"}</button></article>;
}

function StaffSection({ data, onAction, busyKey }: { data: AdminDashboardData; onAction: RunAction; busyKey: string | null }) {
  const submitStaff = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    void onAction({ action: "staff-save", staffCode: String(values.get("staffCode") ?? ""), displayName: String(values.get("displayName") ?? ""), role: String(values.get("role") ?? "referee"), status: "active" }, "staff-create").then((success) => { if (success) form.reset(); });
  };
  return <div className="admin-section-stack"><SectionTitle eyebrow="TEAM & PERMISSIONS" title="พนักงานและรหัสประจำตัว" detail="เมื่อมีพนักงานอย่างน้อย 1 คน ระบบบันทึกผลแข่งจะรับเฉพาะรหัสที่เปิดใช้งาน" />
    {!data.staff.length ? <div className="admin-alert warning"><AlertTriangle /><div><strong>ยังไม่มีรายชื่อพนักงาน</strong><span>ขณะนี้ระบบบันทึกผลยังอยู่ในโหมดรับรหัสชั่วคราว เพิ่มพนักงานคนแรกเพื่อเปิดการตรวจรหัสจริง</span></div></div> : <div className="admin-alert success"><ShieldCheck /><div><strong>เปิดการตรวจรหัสพนักงานแล้ว</strong><span>รหัสที่ไม่อยู่ในรายชื่อหรือถูกปิดใช้งานจะบันทึกผลไม่ได้</span></div></div>}
    <div className="admin-two-column staff-columns"><section className="admin-panel"><div className="panel-head"><div><span className="panel-icon"><Plus /></span><div><h3>เพิ่มพนักงาน</h3><p>ใช้รหัสนี้หลังสแกน QR สมาชิก</p></div></div></div><form className="admin-form" onSubmit={submitStaff}><label><span>ชื่อพนักงาน</span><input name="displayName" required placeholder="ชื่อที่แสดงในระบบ" /></label><label><span>รหัสประจำตัว</span><input name="staffCode" required pattern="[A-Za-z0-9-]{3,20}" placeholder="PB-STAFF-01" /></label><label><span>บทบาท</span><select name="role"><option value="reception">Reception</option><option value="referee">Referee</option><option value="organizer">Organizer</option><option value="manager">Manager</option><option value="admin">Admin</option></select></label><button className="admin-primary" type="submit" disabled={busyKey === "staff-create"}>{busyKey === "staff-create" ? <LoaderCircle className="spin" /> : <UserCog />} เพิ่มพนักงาน</button></form></section><section className="admin-panel"><div className="panel-head"><div><span className="panel-icon"><UsersRound /></span><div><h3>รายชื่อพนักงาน</h3><p>{data.staff.filter((item) => item.status === "active").length} คนเปิดใช้งาน</p></div></div></div>{data.staff.length ? <div className="staff-admin-list">{data.staff.map((staff) => <StaffCard key={staff.id} staff={staff} onAction={onAction} busyKey={busyKey} />)}</div> : <EmptyState icon={UserCog} title="ยังไม่มีพนักงาน" detail="เพิ่มพนักงานคนแรกจากแบบฟอร์ม" />}</section></div>
  </div>;
}

function ContentSection({ data, onAction, busyKey }: { data: AdminDashboardData; onAction: RunAction; busyKey: string | null }) {
  const submitNews = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    void onAction({ action: "news-save", title: String(values.get("title") ?? ""), summary: String(values.get("summary") ?? ""), priority: Number(values.get("priority")) }, "news-create").then((success) => { if (success) form.reset(); });
  };
  return <div className="admin-section-stack"><SectionTitle eyebrow="CONTENT CENTER" title="ข่าวสารและประกาศ" detail="สร้างฉบับร่าง กำหนดลำดับ แล้วเลือกเผยแพร่เมื่อพร้อม" /><div className="admin-two-column content-columns"><section className="admin-panel"><div className="panel-head"><div><span className="panel-icon"><Newspaper /></span><div><h3>สร้างข่าว</h3><p>บันทึกเป็นฉบับร่างก่อน</p></div></div></div><form className="admin-form" onSubmit={submitNews}><label><span>หัวข้อข่าว</span><input name="title" required placeholder="การแข่งขันประจำสัปดาห์" /></label><label><span>รายละเอียดสั้น</span><textarea name="summary" required placeholder="ข้อความที่สมาชิกต้องทราบ" /></label><label><span>ลำดับความสำคัญ</span><input name="priority" type="number" min="0" max="99" defaultValue="0" /></label><button className="admin-primary" type="submit" disabled={busyKey === "news-create"}>{busyKey === "news-create" ? <LoaderCircle className="spin" /> : <Plus />} บันทึกฉบับร่าง</button></form></section><section className="admin-panel"><div className="panel-head"><div><span className="panel-icon"><Sparkles /></span><div><h3>รายการข่าว</h3><p>{data.news.filter((item) => item.status === "published").length} ข่าวกำลังเผยแพร่</p></div></div></div>{data.news.length ? <div className="news-admin-list">{data.news.map((item) => { const key = `news-${item.id}`; const nextStatus = item.status === "published" ? "draft" : "published"; return <article key={item.id}><span className="news-priority">#{item.priority}</span><div><strong>{item.title}</strong><p>{item.summary}</p><small>อัปเดต {formatDateTime(item.updatedAt)}</small></div><span className={`admin-status ${statusClass(item.status)}`}>{STATUS_LABELS[item.status]}</span><button type="button" disabled={busyKey === key} onClick={() => void onAction({ action: "news-status", id: item.id, status: nextStatus }, key)}>{nextStatus === "published" ? "เผยแพร่" : "ถอนข่าว"}</button></article>; })}</div> : <EmptyState icon={Newspaper} title="ยังไม่มีข่าว" detail="สร้างข่าวฉบับแรกจากแบบฟอร์ม" />}</section></div></div>;
}

function SettingEditor({ settingKey, label, value, onAction, busyKey }: { settingKey: string; label: string; value: string; onAction: RunAction; busyKey: string | null }) {
  const [nextValue, setNextValue] = useState(value);
  const [reason, setReason] = useState("");
  const key = `setting-${settingKey}`;
  return <div className="setting-editor"><div><strong>{label}</strong><small>{settingKey}</small></div><input value={nextValue} onChange={(event) => setNextValue(event.target.value)} /><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="เหตุผลการเปลี่ยน" /><button type="button" disabled={busyKey === key || nextValue === value || reason.trim().length < 3} onClick={() => void onAction({ action: "setting-update", settingKey, settingValue: nextValue, reason }, key).then((success) => { if (success) setReason(""); })}>บันทึกเวอร์ชันใหม่</button></div>;
}

function RiskAdminRow({ risk, onAction, busyKey }: { risk: AdminDashboardData["risks"][number]; onAction: RunAction; busyKey: string | null }) {
  const [status, setStatus] = useState(risk.status);
  const [reason, setReason] = useState("");
  const key = `risk-${risk.id}`;
  return <article><span className={`risk-severity ${risk.severity}`}>{risk.severity}</span><div><strong>{risk.summary}</strong><small>{risk.flagType} • {risk.targetType} {risk.targetId}</small></div><span className={`admin-status ${statusClass(risk.status)}`}>{STATUS_LABELS[risk.status] ?? risk.status}</span><div className="risk-admin-action"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="open">เปิดตรวจสอบ</option><option value="investigating">กำลังตรวจสอบ</option><option value="cleared">ไม่พบความเสี่ยง</option><option value="confirmed">ยืนยันความเสี่ยง</option><option value="appealed">อุทธรณ์</option><option value="closed">ปิดเรื่อง</option></select><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="เหตุผลและหลักฐาน" /><button type="button" disabled={busyKey === key || status === risk.status || reason.trim().length < 3} onClick={() => void onAction({ action: "risk-status", id: risk.id, status, reason }, key).then((success) => { if (success) setReason(""); })}>บันทึก</button></div></article>;
}

function SettingsSection({ data, onAction, busyKey }: { data: AdminDashboardData; onAction: RunAction; busyKey: string | null }) {
  return <div className="admin-section-stack"><SectionTitle eyebrow="CONFIGURATION & AUDIT" title="ตั้งค่าระบบและประวัติการทำงาน" detail="ค่าที่กระทบเงิน คะแนน และกองรางวัลถูกล็อกเพื่อป้องกันการเปลี่ยนย้อนหลัง" />
    <div className="admin-two-column settings-columns"><section className="admin-panel"><div className="panel-head"><div><span className="panel-icon"><Settings2 /></span><div><h3>ค่าที่แก้ไขได้</h3><p>ทุกครั้งจะเพิ่ม Version และ Audit</p></div></div></div><div className="setting-editor-list"><SettingEditor settingKey="venue_display_name" label="ชื่อสนาม" value={data.settings.venue_display_name ?? "POOL BATTLE ARENA"} onAction={onAction} busyKey={busyKey} /><SettingEditor settingKey="notification_queue_minutes" label="แจ้งเตือนก่อนถึงคิว (นาที)" value={data.settings.notification_queue_minutes ?? "10"} onAction={onAction} busyKey={busyKey} /><SettingEditor settingKey="ruleset_version" label="Ruleset ปัจจุบัน" value={data.settings.ruleset_version ?? "PB-RULES-1"} onAction={onAction} busyKey={busyKey} /></div></section><section className="admin-panel"><div className="panel-head"><div><span className="panel-icon"><LockKeyhole /></span><div><h3>กติกาการเงินและรางวัล</h3><p>ต้องทำเวอร์ชันและอนุมัติสองคนก่อนเปลี่ยน</p></div></div></div><div className="locked-settings"><div><span>บัตรผ่านประตู</span><strong>{data.settings.day_pass_price ?? "150"} บาท</strong><small>ตัดรอบ {data.settings.day_pass_cutoff ?? "17:00"}</small></div><div><span>การแข่งขัน 20 คน</span><strong>รางวัล {data.settings.event_prize_share ?? "60"}%</strong><small>สนาม {data.settings.venue_event_share ?? "40"}%</small></div><div><span>อาหารและเครื่องดื่ม</span><strong>กองรางวัล {data.settings.reward_pool_share ?? "10"}%</strong><small>ต้นทุน {data.settings.fnb_cost_share ?? "50"}% • สนาม {data.settings.venue_fnb_share ?? "40"}%</small></div><div><span>สิทธิ์รางวัลรายเดือน</span><strong>{data.settings.eligibility_days ?? "5"} วัน</strong><small>อย่างน้อย {data.settings.eligibility_groups ?? "10"} กลุ่ม</small></div></div><div className="locked-note"><ShieldCheck /><span>การเปลี่ยนค่าเหล่านี้ต้องสร้าง Ruleset ใหม่และไม่แก้รายการที่ยืนยันแล้ว</span></div></section></div>
    <section className="admin-panel"><div className="panel-head"><div><span className="panel-icon"><ShieldAlert /></span><div><h3>Risk & Integrity</h3><p>ติดตามการทุจริต ผลซ้ำ และข้อพิพาท</p></div></div></div>{data.risks.length ? <div className="risk-list">{data.risks.map((risk) => <RiskAdminRow key={risk.id} risk={risk} onAction={onAction} busyKey={busyKey} />)}</div> : <EmptyState icon={ShieldCheck} title="ยังไม่พบความเสี่ยง" detail="ระบบจะแสดงธงความเสี่ยงเมื่อพบรูปแบบผิดปกติ" />}</section>
    <section className="admin-panel"><div className="panel-head"><div><span className="panel-icon"><FileClock /></span><div><h3>Audit Trail ล่าสุด</h3><p>ผู้ทำ รายการเปลี่ยนแปลง เป้าหมาย และเหตุผล</p></div></div></div>{data.audit.length ? <div className="audit-list">{data.audit.map((event) => <article key={event.id}><span><FileClock /></span><div><strong>{event.action}</strong><small>{event.targetType} • {event.targetId}</small><p>{event.reason}</p></div><div><strong>{event.actorCode}</strong><small>{formatDateTime(event.createdAt)}</small></div></article>)}</div> : <EmptyState icon={FileClock} title="ยังไม่มีรายการ Audit" detail="เมื่อ Admin เริ่มทำรายการ ประวัติจะแสดงที่นี่" />}</section>
  </div>;
}

export function AdminConsole({ initialData }: { initialData: AdminDashboardData }) {
  const [data, setData] = useState(initialData);
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const refresh = async () => {
    setBusyKey("refresh");
    try {
      const response = await fetch("/api/admin", { cache: "no-store" });
      const nextData = await response.json() as AdminDashboardData & { error?: string };
      if (!response.ok) throw new Error(nextData.error ?? "ไม่สามารถโหลดข้อมูลได้");
      setData(nextData);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลได้" });
    } finally {
      setBusyKey(null);
    }
  };

  const runAction: RunAction = async (payload, key) => {
    setBusyKey(key);
    setNotice(null);
    try {
      const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as AdminActionResponse;
      if (!response.ok) throw new Error(result.error ?? "บันทึกไม่สำเร็จ");
      const refreshed = await fetch("/api/admin", { cache: "no-store" });
      if (refreshed.ok) setData(await refreshed.json() as AdminDashboardData);
      setNotice({ type: "success", message: result.message ?? "บันทึกเรียบร้อย" });
      return true;
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "บันทึกไม่สำเร็จ" });
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const activeItem = NAV_ITEMS.find((item) => item.id === activeSection) ?? NAV_ITEMS[0];
  let section: ReactNode;
  if (activeSection === "operations") section = <OperationsSection data={data} onAction={runAction} busyKey={busyKey} />;
  else if (activeSection === "members") section = <MembersSection data={data} onAction={runAction} busyKey={busyKey} />;
  else if (activeSection === "competitions") section = <CompetitionsSection data={data} onAction={runAction} busyKey={busyKey} />;
  else if (activeSection === "ranking") section = <RankingSection data={data} onAction={runAction} busyKey={busyKey} />;
  else if (activeSection === "staff") section = <StaffSection data={data} onAction={runAction} busyKey={busyKey} />;
  else if (activeSection === "content") section = <ContentSection data={data} onAction={runAction} busyKey={busyKey} />;
  else if (activeSection === "settings") section = <SettingsSection data={data} onAction={runAction} busyKey={busyKey} />;
  else section = <OverviewSection data={data} onNavigate={setActiveSection} />;

  return <div className="admin-stage">
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/admin"><Image src="/poolbattle-logo.jpg" alt="POOL BATTLE" width={54} height={54} priority /><span><strong>POOL BATTLE</strong><small>ADMIN CONTROL CENTER</small></span></Link>
      <div className="owner-lock"><ShieldCheck /><span><strong>OWNER ONLY</strong><small>พื้นที่ควบคุมส่วนตัว</small></span></div>
      <nav>{NAV_ITEMS.map((item) => { const Icon = item.icon; const active = activeSection === item.id; return <button type="button" key={item.id} className={active ? "active" : ""} onClick={() => setActiveSection(item.id)} aria-current={active ? "page" : undefined}><Icon /><span>{item.label}</span>{item.id === "competitions" && data.summary.pendingResults ? <i>{data.summary.pendingResults}</i> : null}</button>; })}</nav>
      <Link className="admin-back-link" href="/"><ArrowLeft /> กลับระบบสมาชิก</Link>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><div><span>{activeItem.label}</span><h1>{activeItem.label === "ภาพรวม" ? "ศูนย์ควบคุมสนาม" : activeItem.label}</h1></div><div className="admin-top-actions"><span className="system-live"><i /> SYSTEM LIVE</span><button type="button" disabled={busyKey === "refresh"} onClick={() => void refresh()}><RefreshCw className={busyKey === "refresh" ? "spin" : ""} /> รีเฟรช</button></div></header>
      <div className="admin-content">{notice ? <div className={`admin-notice ${notice.type}`} role="status">{notice.type === "success" ? <CheckCircle2 /> : <AlertTriangle />}<span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="ปิดแจ้งเตือน"><XCircle /></button></div> : null}{section}</div>
    </main>
    <nav className="admin-mobile-nav" aria-label="เมนู Admin">{NAV_ITEMS.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" className={activeSection === item.id ? "active" : ""} onClick={() => setActiveSection(item.id)}><Icon /><span>{item.label.replace("และรางวัล", "")}</span></button>; })}</nav>
  </div>;
}
