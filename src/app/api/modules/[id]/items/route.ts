import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { parentId, items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Items array is required and must not be empty" },
        { status: 400 }
      );
    }

    const module = await prisma.knowledgeModule.findUnique({
      where: { id },
    });

    if (!module) {
      return NextResponse.json(
        { error: "Module not found" },
        { status: 404 }
      );
    }

    // If parentId is provided, verify it exists
    if (parentId) {
      const parent = await prisma.knowledgeItem.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Parent item not found" },
          { status: 404 }
        );
      }
    }

    // Create all items
    const createdItems = await Promise.all(
      items.map(
        (
          item: {
            title: string;
            content: string;
            difficulty?: string;
            orderIndex?: number;
            depth?: number;
          },
          index: number
        ) =>
          prisma.knowledgeItem.create({
            data: {
              moduleId: id,
              parentId: parentId || null,
              title: item.title,
              content: item.content,
              difficulty: item.difficulty || "basic",
              orderIndex: item.orderIndex ?? index,
              depth: item.depth || 0,
            },
          })
      )
    );

    // Update module item count
    const totalItems = await prisma.knowledgeItem.count({
      where: { moduleId: id },
    });

    await prisma.knowledgeModule.update({
      where: { id },
      data: { itemCount: totalItems },
    });

    return NextResponse.json(createdItems, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to add items" },
      { status: 500 }
    );
  }
}
