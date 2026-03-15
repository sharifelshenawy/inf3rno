import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "inf3rno <onboarding@resend.dev>";

// Shared email styles
const BG = "#0A0A0A";
const CARD_BG = "#141414";
const BORDER = "#2A2A2A";
const ACCENT = "#FF6B2B";
const TEXT = "#FFFFFF";
const TEXT_MUTED = "#999999";

function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG};padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <span style="font-size:28px;font-weight:700;color:${ACCENT};letter-spacing:2px;">inf3rno</span>
            </td>
          </tr>
          <!-- Content card -->
          <tr>
            <td style="background-color:${CARD_BG};border:1px solid ${BORDER};border-radius:12px;padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${TEXT_MUTED};">
                Ride planning for crews who give a damn.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Send an auth code email for passwordless login.
 */
export async function sendAuthCodeEmail(
  email: string,
  code: string
): Promise<void> {
  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:${TEXT};">
      Your login code
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:${TEXT_MUTED};">
      Enter this code to sign in to inf3rno. It expires in 10 minutes.
    </p>
    <div style="text-align:center;padding:24px;background-color:${BG};border-radius:8px;border:1px solid ${BORDER};">
      <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:${ACCENT};font-family:monospace;">
        ${code}
      </span>
    </div>
    <p style="margin:24px 0 0;font-size:12px;color:${TEXT_MUTED};text-align:center;">
      If you didn't request this code, you can safely ignore this email.
    </p>
  `);

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `${code} — Your inf3rno login code`,
    html,
  });
}

/**
 * Send a ride invite email with a vote CTA button.
 */
export async function sendRideInviteEmail(
  email: string,
  rideTitle: string,
  inviterName: string,
  voteUrl: string
): Promise<void> {
  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:${TEXT};">
      You're invited to ride
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:${TEXT_MUTED};">
      <strong style="color:${TEXT};">${inviterName}</strong> invited you to join
      <strong style="color:${ACCENT};">${rideTitle}</strong>.
    </p>
    <div style="text-align:center;padding:16px 0;">
      <a href="${voteUrl}" style="display:inline-block;padding:14px 32px;background-color:${ACCENT};color:#000000;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;">
        Vote on the route
      </a>
    </div>
    <p style="margin:24px 0 0;font-size:12px;color:${TEXT_MUTED};text-align:center;">
      Can't click the button? Copy this link:<br/>
      <a href="${voteUrl}" style="color:${ACCENT};word-break:break-all;">${voteUrl}</a>
    </p>
  `);

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `${inviterName} invited you to ride — ${rideTitle}`,
    html,
  });
}

/**
 * Send a notification that a ride plan has been locked with final details.
 */
export async function sendRideLockedEmail(
  email: string,
  rideTitle: string,
  routeName: string,
  meetingPointName: string,
  destinationName: string,
  scheduledAt: Date,
  rideUrl: string
): Promise<void> {
  const dateStr = scheduledAt.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = scheduledAt.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:${TEXT};">
      Ride plan locked
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:${TEXT_MUTED};">
      <strong style="color:${ACCENT};">${rideTitle}</strong> is confirmed. Here are the details:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:12px;border-bottom:1px solid ${BORDER};">
          <span style="font-size:12px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:1px;">When</span><br/>
          <span style="font-size:14px;color:${TEXT};font-weight:600;">${dateStr} at ${timeStr}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px;border-bottom:1px solid ${BORDER};">
          <span style="font-size:12px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:1px;">Meeting point</span><br/>
          <span style="font-size:14px;color:${TEXT};font-weight:600;">${meetingPointName}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px;border-bottom:1px solid ${BORDER};">
          <span style="font-size:12px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:1px;">Route</span><br/>
          <span style="font-size:14px;color:${TEXT};font-weight:600;">${routeName}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px;">
          <span style="font-size:12px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:1px;">Destination</span><br/>
          <span style="font-size:14px;color:${TEXT};font-weight:600;">${destinationName}</span>
        </td>
      </tr>
    </table>
    <div style="text-align:center;">
      <a href="${rideUrl}" style="display:inline-block;padding:14px 32px;background-color:${ACCENT};color:#000000;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;">
        View ride details
      </a>
    </div>
  `);

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Ride locked — ${rideTitle}`,
    html,
  });
}

/**
 * Send a notification that a ride plan has been updated.
 */
export async function sendRideChangedEmail(
  email: string,
  rideTitle: string,
  leaderName: string,
  rideUrl: string
): Promise<void> {
  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:${TEXT};">
      Ride plan updated
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:${TEXT_MUTED};">
      <strong style="color:${TEXT};">${leaderName}</strong> made changes to
      <strong style="color:${ACCENT};">${rideTitle}</strong>.
      Check out the updated details.
    </p>
    <div style="text-align:center;">
      <a href="${rideUrl}" style="display:inline-block;padding:14px 32px;background-color:${ACCENT};color:#000000;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;">
        View updated ride
      </a>
    </div>
  `);

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Ride updated — ${rideTitle}`,
    html,
  });
}
