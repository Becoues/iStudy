import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const tags = searchParams.get("tags") || "";
    const sort = searchParams.get("sort") || "desc";

    // Build where clause for Prisma query
    const where: { topic?: { contains: string } } = {};

    if (search) {
      where.topic = { contains: search };
    }

    // Parse tag filter (applied in application layer since tags are stored as JSON string)
    let tagFilter: string[] | undefined;
    if (tags) {
      tagFilter = tags.split(",").map((t: string) => t.trim());
    }

    let modules = await prisma.knowledgeModule.findMany({
      where,
      orderBy: { createdAt: sort === "asc" ? "asc" : "desc" },
    });

    // Apply tag filtering in application layer
    if (tagFilter && tagFilter.length > 0) {
      modules = modules.filter((m) => {
        try {
          const moduleTags: string[] = JSON.parse(m.tags);
          return tagFilter.some((t: string) => moduleTags.includes(t));
        } catch {
          return false;
        }
      });
    }

    const result = modules.map((m) => ({
      id: m.id,
      topic: m.topic,
      tags: JSON.parse(m.tags) as string[],
      itemCount: m.itemCount,
      status: m.status,
      createdAt: m.createdAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch modules" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, tags, items } = body;

    if (!topic) {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    const module = await prisma.knowledgeModule.create({
      data: {
        topic,
        tags: JSON.stringify(tags || []),
        status: "completed",
        itemCount: items?.length || 0,
        items: items?.length
          ? {
              create: items.map(
                (
                  item: {
                    title: string;
                    content: string;
                    difficulty?: string;
                    orderIndex?: number;
                    depth?: number;
                  },
                  index: number
                ) => ({
                  title: item.title,
                  content: item.content,
                  difficulty: item.difficulty || "basic",
                  orderIndex: item.orderIndex ?? index,
                  depth: item.depth || 0,
                })
              ),
            }
          : undefined,
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json(
      {
        ...module,
        tags: JSON.parse(module.tags),
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create module" },
      { status: 500 }
    );
  }
}
