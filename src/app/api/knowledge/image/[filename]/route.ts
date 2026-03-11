import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Sanitize filename to prevent path traversal
  const sanitized = path.basename(filename);
  const ext = sanitized.split(".").pop()?.toLowerCase() || "";
  const mimeType = MIME_TYPES[ext];

  if (!mimeType) {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }

  // Use absolute path relative to project root
  const filePath = path.resolve(
    process.cwd(),
    "public",
    "images",
    "knowledge",
    sanitized
  );

  try {
    const data = await fs.readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const sanitized = path.basename(filename);

  // Extract itemId from filename (format: {itemId}.{ext})
  const itemId = sanitized.replace(/\.[^.]+$/, "");
  if (!itemId) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.resolve(
    process.cwd(),
    "public",
    "images",
    "knowledge",
    sanitized
  );

  // Delete file from disk
  try {
    await fs.unlink(filePath);
  } catch {
    // File may not exist, continue to clean DB anyway
  }

  // Remove imageUrl from item's content JSON
  try {
    const item = await prisma.knowledgeItem.findUnique({
      where: { id: itemId },
    });

    if (item) {
      const parsedContent = JSON.parse(item.content);
      delete parsedContent.imageUrl;
      await prisma.knowledgeItem.update({
        where: { id: itemId },
        data: { content: JSON.stringify(parsedContent) },
      });
    }
  } catch (error) {
    console.error("Failed to update DB after image delete:", error);
  }

  return NextResponse.json({ success: true });
}
