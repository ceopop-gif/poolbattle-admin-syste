import { isValidThaiMobile, normalizePhone } from "@/lib/member-access";
import { getMemberStorage } from "@/lib/server/member-storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { phone?: string } | null;
  const phone = normalizePhone(body?.phone ?? "");
  if (!isValidThaiMobile(phone)) return Response.json({ member: null });
  const { db } = getMemberStorage();
  const member = await db.prepare("SELECT phone, photo_key FROM members WHERE phone = ? LIMIT 1").bind(phone).first<{ phone: string; photo_key: string }>();
  return Response.json({ member: member ? { phone: member.phone, hasPhoto: Boolean(member.photo_key) } : null });
}
