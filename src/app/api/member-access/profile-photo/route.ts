import { getMemberStorage, hashPassword, memberRowToClient, type MemberRow } from "@/lib/server/member-storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData();
  const phone = String(formData.get("phone") ?? "").replace(/\D/g, "").slice(0, 10);
  const password = String(formData.get("password") ?? "");
  const photo = formData.get("photo");

  if (!/^0[689]\d{8}$/.test(phone) || !password) {
    return Response.json({ error: "กรุณากรอกรหัสผ่านเพื่อยืนยันการเปลี่ยนรูป" }, { status: 400 });
  }
  if (!(photo instanceof File) || photo.size < 1 || photo.size > 1_500_000 || photo.type !== "image/jpeg") {
    return Response.json({ error: "กรุณาเลือกรูปภาพใหม่ที่ถูกต้อง" }, { status: 400 });
  }

  const { db, bucket } = getMemberStorage();
  const member = await db.prepare("SELECT * FROM members WHERE phone = ? LIMIT 1").bind(phone).first<MemberRow>();
  if (!member) return Response.json({ error: "ไม่พบบัญชีสมาชิก" }, { status: 404 });
  if (member.status === "blocked") return Response.json({ error: "บัญชีนี้ถูกระงับชั่วคราว กรุณาติดต่อเจ้าหน้าที่" }, { status: 403 });
  if (member.first_login) return Response.json({ error: "กรุณาตั้งรหัสผ่านครั้งแรกก่อนเปลี่ยนรูปสมาชิก" }, { status: 409 });

  const passwordHash = await hashPassword(password, member.password_salt);
  if (passwordHash !== member.password_hash) {
    return Response.json({ error: "รหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง" }, { status: 401 });
  }

  const photoKey = `member-photos/${crypto.randomUUID()}.jpg`;
  try {
    await bucket.put(photoKey, await photo.arrayBuffer(), { httpMetadata: { contentType: "image/jpeg" } });
    await db.batch([db.prepare("UPDATE members SET photo_key = ? WHERE id = ?").bind(photoKey, member.id)]);
  } catch (error) {
    await bucket.delete(photoKey).catch(() => undefined);
    console.error("member profile photo update failed", error);
    return Response.json({ error: "ไม่สามารถบันทึกรูปสมาชิกได้ กรุณาลองอีกครั้ง" }, { status: 500 });
  }

  if (member.photo_key && member.photo_key !== photoKey) {
    await bucket.delete(member.photo_key).catch((error) => console.warn("old member photo cleanup failed", error));
  }

  return Response.json({ member: memberRowToClient({ ...member, photo_key: photoKey }) });
}
