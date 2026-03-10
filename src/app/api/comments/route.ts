import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemId, content } = body;

    if (!itemId || !content) {
      return NextResponse.json(
        { error: "itemId and content are required" },
        { status: 400 }
      );
    }

    // Verify the item exists
    const item = await prisma.knowledgeItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Knowledge item not found" },
        { status: 404 }
      );
    }

    const comment = await prisma.comment.create({
      data: {
        itemId,
        content,
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
