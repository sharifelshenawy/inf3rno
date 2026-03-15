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

    // In dev, log the code to console so you don't need Resend delivery
    if (process.env.NODE_ENV === "development") {
      console.log(`\n🔑 Auth code for ${email}: ${formatted}\n`);
    }

    try {
      await sendAuthCodeEmail(email, formatted);
    } catch (emailError) {
      // Don't fail the request if email fails in dev — code is logged above
      if (process.env.NODE_ENV !== "development") throw emailError;
      console.warn("Email send failed (dev mode, code logged above):", emailError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send auth code:", error);
    return NextResponse.json(
      { error: "Failed to send code. Please try again." },
      { status: 500 }
    );
  }
}
