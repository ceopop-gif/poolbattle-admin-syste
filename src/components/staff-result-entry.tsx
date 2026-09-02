"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, IdCard, LoaderCircle, LockKeyhole, ShieldCheck, Swords, Trophy, UserRoundCheck } from "lucide-react";

type ScannedMember = { displayName: string; playerId: string; photoUrl: string };
type ResultSubmission = {
  id: string;
  playerId: string;
  displayName: string;
  opponentPlayerId: string | null;
  staffCode: string;
  discipline: "8-ball" | "9-ball";
  outcome: "win" | "loss";
  playerScore: number;
  opponentScore: number;
  status: "result_submitted";
  submittedAt: string;
};

export function StaffResultEntry({ playerId }: { playerId: string }) {
  const [member, setMember] = useState<ScannedMember | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loadingMember, setLoadingMember] = useState(true);
  const [staffCode, setStaffCode] = useState("");
  const [discipline, setDiscipline] = useState<"8-ball" | "9-ball">("8-ball");
  const [outcome, setOutcome] = useState<"win" | "loss">("win");
  const [playerScore, setPlayerScore] = useState(1);
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentPlayerId, setOpponentPlayerId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ResultSubmission | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function lookupMember() {
      setLoadingMember(true);
      setLookupError(null);
      try {
        const response = await fetch(`/api/staff/result?player=${encodeURIComponent(playerId)}`, { signal: controller.signal });
        const payload = await response.json() as { member?: ScannedMember; error?: string };
        if (!response.ok || !payload.member) setLookupError(payload.error ?? "ไม่พบสมาชิกจาก QR นี้");
        else setMember(payload.member);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setLookupError("ไม่สามารถตรวจสอบสมาชิกได้ กรุณาลองสแกนใหม่");
      } finally {
        if (!controller.signal.aborted) setLoadingMember(false);
      }
    }
    void lookupMember();
    return () => controller.abort();
  }, [playerId]);

  function chooseOutcome(nextOutcome: "win" | "loss") {
    setOutcome(nextOutcome);
    if (nextOutcome === "win" && playerScore <= opponentScore) {
      setPlayerScore(opponentScore + 1);
    } else if (nextOutcome === "loss" && playerScore >= opponentScore) {
      setOpponentScore(playerScore + 1);
    }
  }

  async function submitResult(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member) return;
    setFormError(null);
    setSubmitting(true);
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/staff/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          playerId: member.playerId,
          opponentPlayerId,
          staffCode,
          discipline,
          outcome,
          playerScore,
          opponentScore,
        }),
      });
      const payload = await response.json() as { submission?: ResultSubmission; error?: string };
      if (!response.ok || !payload.submission) setFormError(payload.error ?? "ไม่สามารถบันทึกผลการแข่งขันได้");
      else setReceipt(payload.submission);
    } catch {
      setFormError("การเชื่อมต่อขัดข้อง กรุณากดส่งผลอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="staff-result-page">
      <header className="staff-result-header"><Image src="/poolbattle-logo.jpg" alt="POOL BATTLE" width={58} height={58} priority /><span><small>POOL BATTLE STAFF</small><strong>บันทึกผลการแข่งขัน</strong></span></header>
      <main className="staff-result-main">
        {loadingMember ? <div className="staff-state-card"><LoaderCircle className="spin" size={32} /><strong>กำลังตรวจสอบ QR สมาชิก</strong></div> : null}
        {!loadingMember && lookupError ? <div className="staff-state-card error"><IdCard size={34} /><strong>{lookupError}</strong><span>กรุณากลับไปสแกน QR สมาชิกอีกครั้ง</span></div> : null}
        {member && !receipt ? (
          <>
            <section className="scanned-member-card">
              <Image src={member.photoUrl} alt={`รูปสมาชิก ${member.displayName}`} width={84} height={84} unoptimized />
              <span><small><UserRoundCheck size={15} /> พบสมาชิกแล้ว</small><strong>{member.displayName}</strong><em>{member.playerId}</em></span>
              <ShieldCheck size={26} />
            </section>
            <form className="staff-result-form" onSubmit={submitResult}>
              <div className="staff-form-title"><span>1</span><div><strong>ระบุการแข่งขัน</strong><small>เลือกประเภทเกมและผลของสมาชิกคนนี้</small></div></div>
              <div className="staff-choice-grid" role="group" aria-label="ประเภทเกม">
                <button className={discipline === "8-ball" ? "selected" : ""} type="button" onClick={() => setDiscipline("8-ball")}><span className="staff-ball ball-8">8</span>8-Ball</button>
                <button className={discipline === "9-ball" ? "selected" : ""} type="button" onClick={() => setDiscipline("9-ball")}><span className="staff-ball ball-9">9</span>9-Ball</button>
              </div>
              <div className="staff-choice-grid result-choice" role="group" aria-label="ผลการแข่งขัน">
                <button className={outcome === "win" ? "selected win" : ""} type="button" onClick={() => chooseOutcome("win")}><Trophy size={19} />ชนะ</button>
                <button className={outcome === "loss" ? "selected loss" : ""} type="button" onClick={() => chooseOutcome("loss")}><Swords size={19} />แพ้</button>
              </div>
              <div className="staff-score-grid">
                <label><span>คะแนนสมาชิก</span><input type="number" inputMode="numeric" min="0" max="99" value={playerScore} onChange={(event) => setPlayerScore(Number(event.target.value))} required /></label>
                <span>–</span>
                <label><span>คะแนนคู่แข่งขัน</span><input type="number" inputMode="numeric" min="0" max="99" value={opponentScore} onChange={(event) => setOpponentScore(Number(event.target.value))} required /></label>
              </div>
              <label className="staff-field"><span>Player ID คู่แข่งขัน <small>(ถ้ามี)</small></span><div><IdCard size={19} /><input type="text" autoCapitalize="characters" value={opponentPlayerId} onChange={(event) => setOpponentPlayerId(event.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 24))} placeholder="PB-2026-XXXXXX" /></div></label>
              <div className="staff-form-title"><span>2</span><div><strong>ยืนยันผู้รายงานผล</strong><small>ระบบจะเก็บรหัสพนักงานพร้อมวันและเวลา</small></div></div>
              <label className="staff-field"><span>รหัสประจำตัวพนักงาน</span><div><LockKeyhole size={19} /><input type="text" autoCapitalize="characters" autoComplete="off" minLength={3} maxLength={20} value={staffCode} onChange={(event) => setStaffCode(event.target.value.toUpperCase().replace(/\s+/g, ""))} placeholder="เช่น STAFF-001" required /></div></label>
              <div className="pending-score-note"><ShieldCheck size={20} /><span><strong>ผลจะอยู่สถานะรอตรวจสอบ</strong><small>ยังไม่เพิ่มคะแนน Ranking จนกว่าจะได้รับการยืนยัน</small></span></div>
              {formError ? <p className="form-error" role="alert">{formError}</p> : null}
              <button className="primary-action" type="submit" disabled={submitting}>{submitting ? <><LoaderCircle className="spin" size={20} /> กำลังบันทึก</> : <><CheckCircle2 size={20} /> ยืนยันและส่งผลการแข่งขัน</>}</button>
            </form>
          </>
        ) : null}
        {member && receipt ? (
          <section className="result-receipt">
            <CheckCircle2 size={48} />
            <span>ส่งผลการแข่งขันแล้ว</span>
            <h1>{receipt.displayName}</h1>
            <div className="receipt-score"><strong>{receipt.playerScore}</strong><em>{receipt.outcome === "win" ? "ชนะ" : "แพ้"}</em><strong>{receipt.opponentScore}</strong></div>
            <p>{receipt.discipline === "8-ball" ? "8-Ball" : "9-Ball"} • ผู้รายงาน {receipt.staffCode}</p>
            <div className="receipt-pending"><ShieldCheck size={19} /><span><strong>รอตรวจสอบผล</strong><small>รายการนี้ยังไม่ถูกนำไปคิดคะแนน</small></span></div>
            <small>เลขอ้างอิง {receipt.id.slice(0, 8).toUpperCase()}</small>
            <Link className="secondary-action" href="/">ปิดและกลับหน้าหลัก</Link>
          </section>
        ) : null}
      </main>
    </div>
  );
}
