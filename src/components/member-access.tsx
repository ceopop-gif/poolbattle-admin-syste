"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Eye,
  EyeOff,
  ImagePlus,
  LockKeyhole,
  LoaderCircle,
  Minus,
  Phone,
  Plus,
  ShieldCheck,
  TicketCheck,
  UserRound,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import {
  DAY_PASS_PRICE,
  formatThaiDayPassExpiry,
  formatThaiDate,
  isValidThaiMobile,
  maskPhone,
  normalizePhone,
  type PurchaseResult,
  type PoolBattleMember,
  type PurchaseRecipient,
} from "@/lib/member-access";

type LoginScreenProps = {
  initialPhone?: string;
  onCheckPhone: (phone: string) => Promise<{ step: "password" | "setup-password" } | { error: string }>;
  onLogin: (phone: string, password: string) => Promise<string | null>;
  onSetPassword: (phone: string, password: string) => Promise<string | null>;
  onBuy: () => void;
};

type LoginStep = "phone" | "password" | "setup-password";

export function LoginScreen({ initialPhone = "", onCheckPhone, onLogin, onSetPassword, onBuy }: LoginScreenProps) {
  const [step, setStep] = useState<LoginStep>("phone");
  const [phone, setPhone] = useState(initialPhone);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (step === "phone") {
        const result = await onCheckPhone(phone);
        if ("error" in result) setError(result.error);
        else setStep(result.step);
        return;
      }
      if (step === "setup-password") {
        if (password.length < 6) {
          setError("กรุณาตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร");
          return;
        }
        if (password !== confirmPassword) {
          setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
          return;
        }
        setError(await onSetPassword(phone, password));
        return;
      }
      setError(await onLogin(phone, password));
    } finally {
      setSubmitting(false);
    }
  }

  function changePhone() {
    setStep("phone");
    setPassword("");
    setConfirmPassword("");
    setError(null);
  }

  const isPasswordSetup = step === "setup-password";
  const cardTitle = step === "phone" ? "ใส่เบอร์มือถือ" : isPasswordSetup ? "ตั้งรหัสผ่านของคุณ" : "กรอกรหัสผ่าน";
  const cardDescription = step === "phone" ? "ครั้งแรกยังไม่ต้องใช้รหัสผ่าน" : isPasswordSetup ? "ตั้งครั้งเดียว แล้วใช้เข้าสู่ระบบครั้งต่อไป" : "ใช้รหัสผ่านส่วนตัวที่คุณตั้งไว้";

  return (
    <div className="access-screen">
      <section className="login-hero">
        <span className="login-logo"><Image src="/poolbattle-logo.jpg" alt="POOL BATTLE" width={76} height={76} priority /></span>
        <span className="eyebrow">POOL BATTLE MEMBER</span>
        <h1>เข้าสู่สนามของคุณ</h1>
        <p>ใช้เบอร์มือถือรับบัตรเข้า ต่อคิว และแข่งขันได้ทันที</p>
      </section>

      <button className="buy-pass-callout" type="button" onClick={onBuy}>
        <span className="buy-pass-icon"><TicketCheck size={28} /></span>
        <span><small><CalendarDays size={14} /> ตัดรอบทุกวัน 17:00 น.</small><strong>ซื้อบัตรเข้าสนาม</strong><em>150 บาท / คน • ซื้อให้เพื่อนได้</em></span>
        <span className="callout-action">ซื้อบัตร</span>
      </button>

      <form className="login-card" onSubmit={submitLogin}>
        <div className="login-card-title"><span><ShieldCheck size={19} /></span><div><strong>{cardTitle}</strong><small>{cardDescription}</small></div>{step !== "phone" ? <button className="login-change-phone" type="button" onClick={changePhone}><ChevronLeft size={15} /> เปลี่ยนเบอร์</button> : null}</div>
        <div className="login-step-bar" aria-label={`ขั้นตอน ${step === "phone" ? 1 : 2} จาก 2`}><i className="active" /><i className={step === "phone" ? "" : "active"} /><span>{step === "phone" ? "ขั้นตอน 1/2" : "ขั้นตอน 2/2"}</span></div>
        <label className="access-field"><span>เบอร์มือถือสมาชิก</span><div><Phone size={19} /><input type="tel" inputMode="numeric" autoComplete="tel" value={phone} readOnly={step !== "phone"} onChange={(event) => setPhone(normalizePhone(event.target.value))} placeholder="08X-XXX-XXXX" required /></div></label>
        {step !== "phone" ? <label className="access-field"><span>{isPasswordSetup ? "สร้างรหัสผ่าน" : "รหัสผ่าน"}</span><div><LockKeyhole size={19} /><input type={showPassword ? "text" : "password"} autoComplete={isPasswordSetup ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isPasswordSetup ? "อย่างน้อย 6 ตัวอักษร" : "กรอกรหัสผ่านของคุณ"} minLength={isPasswordSetup ? 6 : undefined} required /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label> : null}
        {isPasswordSetup ? <label className="access-field"><span>ยืนยันรหัสผ่าน</span><div><LockKeyhole size={19} /><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="กรอกรหัสเดิมอีกครั้ง" minLength={6} required /></div></label> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="primary-action access-submit" type="submit" disabled={submitting}>{submitting ? <><LoaderCircle className="spin" size={19} /> กำลังตรวจสอบ</> : step === "phone" ? "ดำเนินการต่อ" : isPasswordSetup ? "ตั้งรหัสผ่านและเข้าสู่ระบบ" : "เข้าสู่ระบบ"}</button>
        {step === "phone" ? <p className="first-password"><ShieldCheck size={15} /> สมาชิกครั้งแรกใช้เบอร์มือถือก่อน ไม่ต้องมีรหัสผ่าน</p> : null}
      </form>
    </div>
  );
}

type TicketPurchaseSheetProps = {
  members: PoolBattleMember[];
  currentTime: number;
  onClose: () => void;
  onPurchase: (recipients: PurchaseRecipient[]) => Promise<PurchaseResult>;
  onUseMember: (phone: string) => void;
};

type PreparedPhoto = { blob: Blob; preview: string };

export async function prepareProfilePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith("image/") || file.size > 10_000_000) throw new Error("กรุณาเลือกรูปภาพขนาดไม่เกิน 10 MB");
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("ไม่สามารถอ่านรูปนี้ได้"));
      element.src = source;
    });
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - size) / 2;
    const sourceY = (image.naturalHeight - size) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("อุปกรณ์นี้ไม่รองรับการเตรียมรูป");
    context.drawImage(image, sourceX, sourceY, size, size, 0, 0, 512, 512);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("ไม่สามารถบันทึกรูปได้")), "image/jpeg", .82));
    return { blob, preview: canvas.toDataURL("image/jpeg", .82) };
  } finally {
    URL.revokeObjectURL(source);
  }
}

type MemberProfileSheetProps = {
  member: PoolBattleMember;
  onClose: () => void;
  onSave: (photo: Blob, password: string) => Promise<string | null>;
};

export function MemberProfileSheet({ member, onClose, onSave }: MemberProfileSheetProps) {
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function selectPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setError(null);
    try {
      setPhoto(await prepareProfilePhoto(file));
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "รูปไม่ถูกต้อง");
    }
  }

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo) {
      setError("กรุณาถ่ายรูปหรือเลือกภาพใหม่ก่อนบันทึก");
      return;
    }
    if (!password) {
      setError("กรุณากรอกรหัสผ่านเพื่อยืนยัน");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const saveError = await onSave(photo.blob, password);
      if (saveError) setError(saveError);
      else onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sheet-layer" role="presentation">
      <button className="sheet-backdrop" type="button" onClick={onClose} aria-label="ปิดหน้าต่าง" />
      <section className="feature-sheet profile-sheet" role="dialog" aria-modal="true" aria-labelledby="profile-sheet-title">
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header"><div><span>MEMBER PROFILE</span><h2 id="profile-sheet-title">เปลี่ยนรูปโปรไฟล์</h2></div><button type="button" onClick={onClose} aria-label="ปิด"><X size={22} /></button></header>
        <form className="profile-photo-form" onSubmit={submitProfile}>
          <div className="profile-photo-preview">
            <Image src={photo?.preview ?? member.photoUrl} alt={`รูปสมาชิก ${member.displayName}`} width={132} height={132} unoptimized />
            <span><strong>{photo ? "รูปใหม่พร้อมบันทึก" : member.displayName}</strong><small>{photo ? "ตรวจสอบรูปก่อนยืนยัน" : `${member.playerId} • รูปปัจจุบัน`}</small></span>
          </div>
          <div className="profile-photo-actions">
            <label className="photo-source-button"><Camera size={20} /><span>ถ่ายรูปใหม่</span><input type="file" accept="image/*" capture="user" onChange={selectPhoto} /></label>
            <label className="photo-source-button"><ImagePlus size={20} /><span>เลือกจากเครื่อง</span><input type="file" accept="image/*" onChange={selectPhoto} /></label>
          </div>
          <label className="access-field profile-password"><span>ยืนยันด้วยรหัสผ่านสมาชิก</span><div><LockKeyhole size={19} /><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="กรอกรหัสผ่านของคุณ" required /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="primary-action" type="submit" disabled={submitting}>{submitting ? <><LoaderCircle className="spin" size={20} /> กำลังบันทึกรูป</> : <><ShieldCheck size={20} /> บันทึกรูปโปรไฟล์</>}</button>
          <p className="photo-privacy"><ShieldCheck size={14} /> รูปใหม่จะใช้กับโปรไฟล์และบัตรผ่านประตูทันที</p>
        </form>
      </section>
    </div>
  );
}

export function TicketPurchaseSheet({ members, currentTime, onClose, onPurchase, onUseMember }: TicketPurchaseSheetProps) {
  const [quantity, setQuantity] = useState(1);
  const [phones, setPhones] = useState([""]);
  const [displayNames, setDisplayNames] = useState([""]);
  const [photos, setPhotos] = useState<Array<PreparedPhoto | null>>([null]);
  const [knownMembers, setKnownMembers] = useState<Record<string, { hasPhoto: boolean; photoUrl?: string; displayName?: string }>>(() => Object.fromEntries(members.map((member) => [member.phone, { hasPhoto: Boolean(member.photoUrl), photoUrl: member.photoUrl || undefined, displayName: member.displayName }])));
  const [errors, setErrors] = useState<string[]>([]);
  const [nameErrors, setNameErrors] = useState<string[]>([]);
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PurchaseResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const total = quantity * DAY_PASS_PRICE;
  const memberCounts = useMemo(() => {
    if (!receipt) return { newMembers: 0, existingMembers: 0 };
    const newMembers = receipt.tickets.filter((ticket) => ticket.membershipCreated).length;
    return { newMembers, existingMembers: receipt.tickets.length - newMembers };
  }, [receipt]);

  function changeQuantity(next: number) {
    const safeQuantity = Math.max(1, Math.floor(next || 1));
    setQuantity(safeQuantity);
    setPhones((current) => Array.from({ length: safeQuantity }, (_, index) => current[index] ?? ""));
    setDisplayNames((current) => Array.from({ length: safeQuantity }, (_, index) => current[index] ?? ""));
    setPhotos((current) => Array.from({ length: safeQuantity }, (_, index) => current[index] ?? null));
    setErrors([]);
    setNameErrors([]);
    setPhotoErrors([]);
  }

  function changePhone(index: number, value: string) {
    setPhones((current) => current.map((phone, phoneIndex) => phoneIndex === index ? normalizePhone(value) : phone));
    setErrors((current) => current.map((error, errorIndex) => errorIndex === index ? "" : error));
  }

  function changeDisplayName(index: number, value: string) {
    setDisplayNames((current) => current.map((name, nameIndex) => nameIndex === index ? value.slice(0, 30) : name));
    setNameErrors((current) => current.map((error, errorIndex) => errorIndex === index ? "" : error));
  }

  async function changePhoto(index: number, file: File | undefined) {
    if (!file) return;
    try {
      const prepared = await prepareProfilePhoto(file);
      setPhotos((current) => current.map((photo, photoIndex) => photoIndex === index ? prepared : photo));
      setPhotoErrors((current) => current.map((error, errorIndex) => errorIndex === index ? "" : error));
    } catch (error) {
      setPhotoErrors((current) => Array.from({ length: quantity }, (_, errorIndex) => errorIndex === index ? (error instanceof Error ? error.message : "รูปไม่ถูกต้อง") : current[errorIndex] ?? ""));
    }
  }

  function selectPhoto(index: number, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    void changePhoto(index, file);
  }

  async function fetchMemberPhoto(phone: string) {
    const response = await fetch("/api/member-access/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { member?: { phone: string; hasPhoto: boolean } | null };
    return payload.member ?? null;
  }

  async function lookupMember(phoneValue: string) {
    const phone = normalizePhone(phoneValue);
    if (!isValidThaiMobile(phone) || knownMembers[phone]) return;
    const member = await fetchMemberPhoto(phone);
    if (member) setKnownMembers((current) => ({ ...current, [member.phone]: { hasPhoto: member.hasPhoto } }));
  }

  async function submitPurchase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittedRef.current) return;
    const normalized = phones.map(normalizePhone);
    const duplicates = new Set(normalized.filter((phone, index) => normalized.indexOf(phone) !== index));
    const nextErrors = normalized.map((phone) => {
      if (!isValidThaiMobile(phone)) return "กรุณากรอกเบอร์มือถือไทยให้ครบ 10 หลัก";
      if (duplicates.has(phone)) return "เบอร์นี้ซ้ำในคำสั่งซื้อ กรุณาใช้หนึ่งเบอร์ต่อหนึ่งบัตร";
      return "";
    });
    setErrors(nextErrors);
    if (nextErrors.some(Boolean)) return;

    const discoveredMembers = { ...knownMembers };
    const lookups = await Promise.all(normalized.map(async (phone) => {
      if (discoveredMembers[phone]) return null;
      return fetchMemberPhoto(phone);
    }));
    lookups.forEach((member) => {
      if (member) discoveredMembers[member.phone] = { hasPhoto: member.hasPhoto };
    });
    setKnownMembers(discoveredMembers);
    const nextNameErrors = normalized.map((phone, index) => {
      if (discoveredMembers[phone]) return "";
      if (!displayNames[index].trim()) return "กรุณากรอกชื่อเล่นของสมาชิก";
      return "";
    });
    const nextPhotoErrors = normalized.map((phone, index) => {
      const existingMember = discoveredMembers[phone];
      if (!existingMember?.hasPhoto && !photos[index]) return "กรุณาเพิ่มรูปสมาชิกเพื่อใช้ยืนยันที่ประตู";
      return "";
    });
    setNameErrors(nextNameErrors);
    setPhotoErrors(nextPhotoErrors);
    if (nextNameErrors.some(Boolean) || nextPhotoErrors.some(Boolean)) return;
    submittedRef.current = true;
    setSubmitting(true);
    setPurchaseError(null);
    try {
      setReceipt(await onPurchase(normalized.map((phone, index) => ({ phone, displayName: displayNames[index].trim(), photo: photos[index]?.blob ?? null }))));
    } catch (error) {
      submittedRef.current = false;
      setPurchaseError(error instanceof Error ? error.message : "ไม่สามารถออกบัตรได้ กรุณาลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sheet-layer" role="presentation">
      <button className="sheet-backdrop" type="button" onClick={onClose} aria-label="ปิดหน้าต่าง" />
      <section className="feature-sheet ticket-sheet" role="dialog" aria-modal="true" aria-labelledby="ticket-sheet-title">
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header"><div><span>DAY PASS • 150 บาท</span><h2 id="ticket-sheet-title">{receipt ? "รับบัตรเรียบร้อย" : "ซื้อบัตรเข้าสนาม"}</h2></div><button type="button" onClick={onClose} aria-label="ปิด"><X size={22} /></button></header>
        <div className="sheet-body">
          {receipt ? (
            <div className="ticket-receipt">
              <div className="receipt-success"><CheckCircle2 size={36} /><span>สั่งซื้อสำเร็จ</span><strong>{formatThaiDate(new Date(receipt.order.purchasedAt))}</strong><small>{receipt.order.quantity} ใบ • รวม ฿{receipt.order.totalAmount.toLocaleString("th-TH")}</small><em>ใช้ได้ถึง {formatThaiDayPassExpiry(new Date(receipt.order.purchasedAt))}</em></div>
              <div className="member-result-row"><span><UserPlus size={18} /> สมาชิกใหม่ <strong>{memberCounts.newMembers}</strong></span><span><UsersRound size={18} /> สมาชิกเดิม <strong>{memberCounts.existingMembers}</strong></span></div>
              <div className="issued-ticket-list">
                {receipt.tickets.map((ticket, index) => (
                  <article key={ticket.id}>
                    {receipt.members[index]?.photoUrl ? <Image className="receipt-member-photo" src={receipt.members[index].photoUrl} alt={`รูปสมาชิก ${maskPhone(ticket.phone)}`} width={42} height={42} unoptimized /> : <span className="ticket-index">{index + 1}</span>}
                    <div><strong>{receipt.members[index]?.displayName ?? ticket.ticketNumber}</strong><span>{ticket.ticketNumber} • {maskPhone(ticket.phone)} • {ticket.membershipCreated ? "สร้างสมาชิกใหม่แล้ว" : "ส่งเข้าบัญชีสมาชิกเดิมแล้ว"}</span></div>
                    <CheckCircle2 size={20} />
                  </article>
                ))}
              </div>
              <div className="temporary-password"><Phone size={19} /><div><strong>ครั้งแรกใช้เบอร์มือถือ</strong><span>ระบบจะให้สมาชิกใหม่ตั้งรหัสผ่านของตัวเองในขั้นตอนถัดไป</span></div></div>
              <button className="primary-action" type="button" onClick={() => onUseMember(receipt.tickets[0].phone)}>ไปหน้าเข้าสู่ระบบ</button>
              <button className="secondary-action" type="button" onClick={onClose}>ปิดหน้าต่าง</button>
            </div>
          ) : (
            <form className="ticket-order-form" onSubmit={submitPurchase}>
              <div className="purchase-date-card"><CalendarDays size={24} /><div><span>รอบบัตรเข้า</span><strong>ใช้ได้ถึง {formatThaiDayPassExpiry(new Date(currentTime))}</strong></div><em>ตัดรอบ 17:00</em></div>
              <div className="quantity-control"><div><span>จำนวนบัตร</span><small>1 เบอร์มือถือ ต่อ 1 ใบ</small></div><div><button type="button" onClick={() => changeQuantity(quantity - 1)} aria-label="ลดจำนวนบัตร" disabled={quantity === 1}><Minus size={19} /></button><input type="number" inputMode="numeric" min="1" value={quantity} onChange={(event) => changeQuantity(Number(event.target.value))} aria-label="จำนวนบัตร" /><button type="button" onClick={() => changeQuantity(quantity + 1)} aria-label="เพิ่มจำนวนบัตร"><Plus size={19} /></button></div></div>
              <div className="phone-ticket-fields">
                {phones.map((phone, index) => (
                  <div className="ticket-phone-field" key={index}>
                    <span><b>บัตรใบที่ {index + 1}</b><small>เบอร์นี้จะได้รับสิทธิ์สมาชิก</small></span>
                    <div className={errors[index] ? "invalid" : ""}><Phone size={18} /><input aria-label={`เบอร์มือถือบัตรใบที่ ${index + 1}`} type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={(event) => changePhone(index, event.target.value)} onBlur={() => void lookupMember(phone)} placeholder="08X-XXX-XXXX" required /></div>
                    {errors[index] ? <em>{errors[index]}</em> : null}
                    {knownMembers[normalizePhone(phone)] ? <div className="known-member-name"><UserRound size={18} /><span><small>ชื่อเล่นสมาชิกเดิม</small><strong>{knownMembers[normalizePhone(phone)]?.displayName ?? "ใช้ชื่อที่บันทึกไว้"}</strong></span></div> : <div className={`nickname-field ${nameErrors[index] ? "invalid" : ""}`}><UserRound size={18} /><input aria-label={`ชื่อเล่นบัตรใบที่ ${index + 1}`} type="text" autoComplete="off" maxLength={30} value={displayNames[index]} onChange={(event) => changeDisplayName(index, event.target.value)} placeholder="ชื่อเล่น เช่น ป็อบ" /></div>}
                    {nameErrors[index] ? <em>{nameErrors[index]}</em> : null}
                    <div className={`member-photo-upload ${photoErrors[index] ? "invalid" : ""}`}>
                      {photos[index]?.preview ? <Image src={photos[index].preview} alt={`รูปสมาชิกบัตรใบที่ ${index + 1}`} width={62} height={62} unoptimized /> : knownMembers[normalizePhone(phone)]?.photoUrl ? <Image src={knownMembers[normalizePhone(phone)]?.photoUrl ?? ""} alt="รูปสมาชิกเดิม" width={62} height={62} unoptimized /> : <span className="photo-placeholder">{knownMembers[normalizePhone(phone)]?.hasPhoto ? <ShieldCheck size={25} /> : <Camera size={25} />}</span>}
                      <span className="photo-upload-copy"><strong>{knownMembers[normalizePhone(phone)]?.hasPhoto && !photos[index] ? "ใช้รูปสมาชิกเดิม" : photos[index] ? "เลือกรูปสมาชิกแล้ว" : "เพิ่มรูปสมาชิก"}</strong><small>รูปหน้าตรง ใช้ตรวจสิทธิ์เข้าประตู</small></span>
                      <div className="photo-source-actions">
                        <label className="photo-source-button"><Camera size={18} /><span>ถ่ายรูป</span><input type="file" accept="image/*" capture="user" onChange={(event) => selectPhoto(index, event)} /></label>
                        <label className="photo-source-button"><ImagePlus size={18} /><span>เลือกจากเครื่อง</span><input type="file" accept="image/*" onChange={(event) => selectPhoto(index, event)} /></label>
                      </div>
                    </div>
                    {photoErrors[index] ? <em>{photoErrors[index]}</em> : null}
                  </div>
                ))}
              </div>
              <div className="order-total"><span>รวม {quantity} ใบ</span><strong>฿{total.toLocaleString("th-TH")}</strong></div>
              {purchaseError ? <p className="form-error" role="alert">{purchaseError}</p> : null}
              <button className="primary-action" type="submit" disabled={submitting}>{submitting ? <><LoaderCircle className="spin" size={20} /> กำลังออกบัตร</> : <><TicketCheck size={20} /> ยืนยันสั่งซื้อบัตร</>}</button>
              <p className="helper-text">เมื่อออกบัตรแล้ว ทุกเบอร์จะเป็นสมาชิก POOL BATTLE และเข้าสู่ระบบได้ทันที • หลัง 17:00 น. ต้องซื้อบัตรรอบใหม่</p>
              <p className="photo-privacy"><ShieldCheck size={14} /> รูปสมาชิกใช้เพื่อยืนยันตัวตนและสิทธิ์เข้าประตูเท่านั้น</p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
