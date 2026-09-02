import { isValidThaiMobile, normalizePhone } from "@/lib/member-access";
import { getMemberStorage, hashPassword, memberSessionPayload, type MemberRow } from "@/lib/server/member-storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { phone?: string; password?: string } | null;
  const phone = normalizePhone(body?.phone ?? "");
  const password = body?.password ?? "";
  if (!isValidThaiMobile(phone)) return Response.json({ error: "กรุณากรอกเบอร์มือถือไทยให้ครบ 10 หลัก" }, { status: 400 });

  const { db } = getMemberStorage();
  const member = await db.prepare("SELECT * FROM members WHERE phone = ? LIMIT 1").bind(phone).first<MemberRow>();
  if (!member) return Response.json({ error: "ยังไม่พบสมาชิก กรุณาซื้อบัตรเข้าเพื่อสมัครสมาชิกอัตโนมัติ" }, { status: 404 });
  if (member.status === "blocked") return Response.json({ error: "บัญชีนี้ถูกระงับชั่วคราว กรุณาติดต่อเจ้าหน้าที่" }, { status: 403 });
  if (member.first_login) return Response.json({ step: "setup-password" });
  if (!password) return Response.json({ step: "password" });

  const passwordHash = await hashPassword(password, member.password_salt);
  if (passwordHash !== member.password_hash) return Response.json({ error: "รหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง" }, { status: 401 });

  return Response.json({ step: "complete", ...await memberSessionPayload(db, member) });
}
