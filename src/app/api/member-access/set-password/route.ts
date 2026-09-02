import { isValidThaiMobile, normalizePhone } from "@/lib/member-access";
import { getMemberStorage, hashPassword, memberSessionPayload, type MemberRow } from "@/lib/server/member-storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { phone?: string; password?: string } | null;
  const phone = normalizePhone(body?.phone ?? "");
  const password = body?.password ?? "";
  if (!isValidThaiMobile(phone)) return Response.json({ error: "กรุณากรอกเบอร์มือถือไทยให้ครบ 10 หลัก" }, { status: 400 });
  if (password.length < 6 || password.length > 72) return Response.json({ error: "รหัสผ่านต้องมี 6–72 ตัวอักษร" }, { status: 400 });

  const { db } = getMemberStorage();
  const member = await db.prepare("SELECT * FROM members WHERE phone = ? LIMIT 1").bind(phone).first<MemberRow>();
  if (!member) return Response.json({ error: "ไม่พบบัญชีสมาชิก" }, { status: 404 });
  if (member.status === "blocked") return Response.json({ error: "บัญชีนี้ถูกระงับชั่วคราว กรุณาติดต่อเจ้าหน้าที่" }, { status: 403 });
  if (!member.first_login) return Response.json({ error: "สมาชิกนี้ตั้งรหัสผ่านแล้ว กรุณาเข้าสู่ระบบตามปกติ" }, { status: 409 });

  const passwordSalt = crypto.randomUUID();
  const passwordHash = await hashPassword(password, passwordSalt);
  await db.batch([db.prepare("UPDATE members SET password_salt = ?, password_hash = ?, first_login = 0 WHERE id = ? AND first_login = 1").bind(passwordSalt, passwordHash, member.id)]);
  const updatedMember = { ...member, password_salt: passwordSalt, password_hash: passwordHash, first_login: 0 };
  return Response.json({ step: "complete", ...await memberSessionPayload(db, updatedMember) });
}
