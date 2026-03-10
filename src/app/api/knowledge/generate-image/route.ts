import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { itemId, title, summary } = await request.json();

    if (!itemId || !title) {
      return NextResponse.json(
        { error: "itemId 和 title 为必填项" },
        { status: 400 }
      );
    }

    const settings = await prisma.settings.findFirst();
    if (!settings?.apiKey) {
      return NextResponse.json(
        { error: "请先在设置中配置 API Key" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: "https://api.deerapi.com/v1",
    });

    const prompt = `请为以下知识概念绘制一张可爱的卡通风格教育插图，扁平化设计，色彩明快，可包含少量中文标注，适合学习卡片使用。

知识点标题：${title}
知识点概述：${summary || ""}

请直接生成一张插图。`;

    const response = await openai.chat.completions.create({
      model: "gemini-3-pro-image",
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "图片生成失败，AI 未返回内容" },
        { status: 500 }
      );
    }

    // Extract base64 image data
    const base64Match = content.match(
      /data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)/
    );
    if (!base64Match) {
      return NextResponse.json(
        { error: "图片生成失败，未能提取图片数据" },
        { status: 500 }
      );
    }

    const ext = base64Match[1];
    const base64Data = base64Match[2];

    // Write image file to public/images/knowledge/
    const imageDir = path.join(process.cwd(), "public", "images", "knowledge");
    await fs.mkdir(imageDir, { recursive: true });

    const filename = `${itemId}.${ext}`;
    const filePath = path.join(imageDir, filename);
    await fs.writeFile(filePath, Buffer.from(base64Data, "base64"));

    // Update item's content JSON with imageUrl
    const item = await prisma.knowledgeItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json(
        { error: "知识项不存在" },
        { status: 404 }
      );
    }

    const timestamp = Date.now();
    const imageUrl = `/api/knowledge/image/${filename}?t=${timestamp}`;

    const parsedContent = JSON.parse(item.content);
    parsedContent.imageUrl = imageUrl;

    await prisma.knowledgeItem.update({
      where: { id: itemId },
      data: { content: JSON.stringify(parsedContent) },
    });

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Image generation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "图片生成失败",
      },
      { status: 500 }
    );
  }
}
