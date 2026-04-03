import { NextRequest, NextResponse } from "next/server";
import { dbGetConfig } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const config = dbGetConfig();
    if (password === config.adminPassword) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "パスワードが正しくありません" }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false, error: "認証エラー" }, { status: 500 });
  }
}
