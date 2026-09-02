import { DAY_PASS_PRICE, getBangkokBusinessDate, isValidThaiMobile, normalizePhone } from "@/lib/member-access";
import { getMemberStorage, hashPassword, memberRowToClient, type MemberRow } from "@/lib/server/member-storage";

export const dynamic = "force-dynamic";

type RecipientInput = { phone?: string; displayName?: string };

function makePlayerId(date: Date) {
  const year = new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric" }).format(date);
  return `PB-${year}-${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  const recipients = JSON.parse(String(formData.get("recipients") ?? "[]")) as RecipientInput[];
  if (!idempotencyKey || !Array.isArray(recipients) || recipients.length < 1) {
    return Response.json({ error: "ข้อมูลคำสั่งซื้อไม่ครบถ้วน" }, { status: 400 });
  }

  const phones = recipients.map((recipient) => normalizePhone(recipient.phone ?? ""));
  const displayNames = recipients.map((recipient) => String(recipient.displayName ?? "").replace(/\s+/g, " ").trim().slice(0, 30));
  if (phones.some((phone) => !isValidThaiMobile(phone)) || new Set(phones).size !== phones.length) {
    return Response.json({ error: "เบอร์มือถือไม่ถูกต้องหรือซ้ำกัน" }, { status: 400 });
  }

  const { db, bucket } = getMemberStorage();
  const duplicate = await db.prepare("SELECT id FROM ticket_orders WHERE idempotency_key = ? LIMIT 1").bind(idempotencyKey).first<{ id: string }>();
  if (duplicate) return Response.json({ error: "คำสั่งซื้อนี้ถูกบันทึกแล้ว" }, { status: 409 });

  const now = new Date();
  const purchasedAt = now.toISOString();
  const businessDate = getBangkokBusinessDate(now);
  const orderId = crypto.randomUUID();
  const uploadedKeys: string[] = [];
  const statements = [];
  const clientMembers = [];
  const clientTickets = [];

  const existingMembers: Array<MemberRow | null> = [];
  for (const phone of phones) {
    existingMembers.push(await db.prepare("SELECT * FROM members WHERE phone = ? LIMIT 1").bind(phone).first<MemberRow>());
  }
  for (let index = 0; index < phones.length; index += 1) {
    const photo = formData.get(`photo-${index}`);
    const hasNewPhoto = photo instanceof File && photo.size > 0;
    if (existingMembers[index]?.status === "blocked") return Response.json({ error: `สมาชิกบัตรใบที่ ${index + 1} ถูกระงับ กรุณาติดต่อเจ้าหน้าที่` }, { status: 403 });
    if (!existingMembers[index] && displayNames[index].length < 1) return Response.json({ error: `กรุณากรอกชื่อเล่นสำหรับบัตรใบที่ ${index + 1}` }, { status: 400 });
    if (!existingMembers[index]?.photo_key && !hasNewPhoto) return Response.json({ error: `กรุณาเพิ่มรูปสมาชิกสำหรับบัตรใบที่ ${index + 1}` }, { status: 400 });
    if (hasNewPhoto && (photo.size > 1_500_000 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type))) {
      return Response.json({ error: `รูปสมาชิกใบที่ ${index + 1} ไม่ถูกต้องหรือมีขนาดใหญ่เกินไป` }, { status: 400 });
    }
  }

  try {
    for (let index = 0; index < phones.length; index += 1) {
      const phone = phones[index];
      let member = existingMembers[index];
      const membershipCreated = !member;
      const photo = formData.get(`photo-${index}`);
      const hasNewPhoto = photo instanceof File && photo.size > 0;

      let photoKey = member?.photo_key ?? "";
      if (hasNewPhoto) {
        photoKey = `member-photos/${crypto.randomUUID()}.jpg`;
        await bucket.put(photoKey, await photo.arrayBuffer(), { httpMetadata: { contentType: "image/jpeg" } });
        uploadedKeys.push(photoKey);
      }

      if (!member) {
        const memberId = crypto.randomUUID();
        const passwordSalt = crypto.randomUUID();
        member = {
          id: memberId,
          phone,
          display_name: displayNames[index],
          player_id: makePlayerId(now),
          photo_key: photoKey,
          password_salt: passwordSalt,
          password_hash: await hashPassword(crypto.randomUUID(), passwordSalt),
          first_login: 1,
          status: "active",
          joined_at: purchasedAt,
        };
        statements.push(db.prepare("INSERT INTO members (id, phone, display_name, player_id, photo_key, password_salt, password_hash, first_login, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(member.id, member.phone, member.display_name, member.player_id, member.photo_key, member.password_salt, member.password_hash, member.first_login, member.joined_at));
      } else if (hasNewPhoto) {
        member = { ...member, photo_key: photoKey };
        statements.push(db.prepare("UPDATE members SET photo_key = ? WHERE id = ?").bind(photoKey, member.id));
      }

      const ticketId = crypto.randomUUID();
      const ticketNumber = `DP-${businessDate.replaceAll("-", "")}-${ticketId.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
      statements.push(db.prepare("INSERT INTO day_passes (id, order_id, member_id, business_date, purchased_at, ticket_number, status, membership_created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(ticketId, orderId, member.id, businessDate, purchasedAt, ticketNumber, "active", membershipCreated ? 1 : 0));
      clientMembers.push(memberRowToClient(member));
      clientTickets.push({ id: ticketId, orderId, phone, playerId: member.player_id, businessDate, purchasedAt, ticketNumber, status: "active" as const, membershipCreated });
    }

    statements.unshift(db.prepare("INSERT INTO ticket_orders (id, idempotency_key, business_date, purchased_at, quantity, total_amount, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(orderId, idempotencyKey, businessDate, purchasedAt, phones.length, phones.length * DAY_PASS_PRICE, "confirmed"));
    await db.batch(statements);

    return Response.json({
      order: { id: orderId, businessDate, purchasedAt, quantity: phones.length, totalAmount: phones.length * DAY_PASS_PRICE, ticketIds: clientTickets.map((ticket) => ticket.id) },
      tickets: clientTickets,
      members: clientMembers,
    });
  } catch (error) {
    await Promise.all(uploadedKeys.map((key) => bucket.delete(key)));
    console.error("member purchase failed", error);
    return Response.json({ error: "ไม่สามารถออกบัตรได้ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
