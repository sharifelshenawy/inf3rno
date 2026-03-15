import { NextResponse } from "next/server";
import { generateUniqueHandle } from "@/lib/handle-generator";

export async function GET() {
  const handle = await generateUniqueHandle();
  return NextResponse.json({ handle });
}
