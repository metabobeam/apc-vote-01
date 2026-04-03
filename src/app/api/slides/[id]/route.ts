import { NextRequest, NextResponse } from "next/server";
import { dbGetSlideById, dbUpdateSlide, dbDeleteSlide } from "@/lib/db";

// GET /api/slides/[id] → 画像データ含む全情報
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const slide = dbGetSlideById(id);
    if (!slide) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

    // 画像の場合はバイナリレスポンスとして返す
    if (slide.type === "image") {
      const base64 = slide.data.replace(/^data:image\/[^;]+;base64,/, "");
      const buf = Buffer.from(base64, "base64");
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
    return NextResponse.json({ id: slide.id, name: slide.name, type: slide.type, url: slide.data });
  } catch {
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// PUT /api/slides/[id] → 更新
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, type, data, order } = body as {
      name?: string; type?: "image" | "link"; data?: string; order?: number;
    };
    const slide = dbGetSlideById(id);
    if (!slide) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    dbUpdateSlide(id, { name, type, data, order });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}

// DELETE /api/slides/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ok = dbDeleteSlide(id);
    if (!ok) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
