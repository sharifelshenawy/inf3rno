import { NextResponse } from "next/server";
import { generateAuthCode, formatCode, storeAuthCode } from "@/lib/auth-code";
import { sendAuthCodeEmail } from "@/lib/email";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Valid email address is required" },
        { status: 400 }
      );
    }

    const code = generateAuthCode();
    await storeAuthCode(email, code);

    const formatted = formatCode(code);
    await sendAuthCodeEmail(email, formatted);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send auth code:", error);
    return NextResponse.json(
      { error: "Failed to send code. Please try again." },
      { status: 500 }
    );
  }
}
