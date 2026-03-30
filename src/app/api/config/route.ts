import { NextRequest, NextResponse } from "next/server";
import { getConfig, saveConfig } from "@/lib/store";
import { VoteConfig } from "@/lib/types";

export async function GET() {
  try {
    const config = getConfig();
    // パスワードは返さない
    const { adminPassword: _, ...publicConfig } = config;
    return NextResponse.json(publicConfig);
  } catch {
    return NextResponse.json({ error: "設定の取得に失敗しました" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, ...newConfig } = body;

    const currentConfig = getConfig();
    if (password !== currentConfig.adminPassword) {
      return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
    }

    const updatedConfig: VoteConfig = {
      ...currentConfig,
      ...newConfig,
      adminPassword: currentConfig.adminPassword,
    };

    saveConfig(updatedConfig);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "設定の更新に失敗しました" }, { status: 500 });
  }
}
