import { NextResponse } from "next/server";
import { getMemberStorage } from "@/lib/server/member-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { db } = await getMemberStorage();
    const result = await db.prepare(`
      SELECT id, title, summary, COALESCE(published_at, created_at) AS publishedAt
      FROM admin_news
      WHERE status = 'published'
      ORDER BY COALESCE(published_at, created_at) DESC, id DESC
      LIMIT 5
    `).all<{ id: string; title: string; summary: string; publishedAt: string }>();
    return NextResponse.json({ news: result.results });
  } catch (error) {
    console.error("Published news error", error);
    return NextResponse.json({ news: [] });
  }
}
