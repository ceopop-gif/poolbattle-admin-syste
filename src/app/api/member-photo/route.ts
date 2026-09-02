import { getMemberStorage } from "@/lib/server/member-storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!/^member-photos\/[a-f0-9-]+\.jpg$/.test(key)) return new Response("Not found", { status: 404 });

  const { bucket } = getMemberStorage();
  const object = await bucket.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Cache-Control": "private, max-age=3600",
    ETag: object.httpEtag,
    "X-Content-Type-Options": "nosniff",
  });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
}
