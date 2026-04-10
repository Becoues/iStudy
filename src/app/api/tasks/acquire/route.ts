import { NextResponse } from "next/server";
import { acquire } from "../semaphore";

export async function POST() {
  const result = acquire();
  return NextResponse.json(result);
}
