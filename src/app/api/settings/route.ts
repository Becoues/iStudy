import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function maskApiKey(key: string): string {
  if (!key || key.length <= 8) return key ? "****" : "";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

export async function GET() {
  try {
    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: 1 },
      });
    }

    return NextResponse.json({
      ...settings,
      apiKey: maskApiKey(settings.apiKey),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, apiKey, model } = body;

    // If apiKey contains "****", keep the existing key
    let finalApiKey = apiKey;
    if (apiKey && apiKey.includes("****")) {
      const existing = await prisma.settings.findFirst();
      finalApiKey = existing?.apiKey || "";
    }

    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: {
        ...(provider !== undefined && { provider }),
        ...(finalApiKey !== undefined && { apiKey: finalApiKey }),
        ...(model !== undefined && { model }),
      },
      create: {
        id: 1,
        provider: provider || "DeerAPI",
        apiKey: finalApiKey || "",
        model: model || "gpt-4o",
      },
    });

    return NextResponse.json({
      ...settings,
      apiKey: maskApiKey(settings.apiKey),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
