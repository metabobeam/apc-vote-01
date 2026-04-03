import { NextRequest, NextResponse } from "next/server";
import { dbGetSlides, dbSaveSlide } from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    const slides = dbGetSlides();
    // 画像データは /api/slides/[id] で個別取得するためリストでは除外
    const list = slides.map(({ id, name, type, data, order, createdAt }) => ({
      id, name, type, order, createdAt,
      url: type === "link" ? data : undefined,
    }));
    return NextResponse.json({ slides: list });
  } catch {
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, type, data } = body as {
      name: string; type: "image" | "link"; data: string;
    };
    if (!name?.trim() || !type || !data) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }
    const existing = dbGetSlides();
    const item = {
      id: randomUUID(),
      name: name.trim(),
      type,
      data,
      order: existing.length,
      createdAt: new Date().toISOString(),
    };
    dbSaveSlide(item);
    return NextResponse.json({ success: true, id: item.id });
  } catch {
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
