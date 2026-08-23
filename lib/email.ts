/** Server-only transactional email delivery through Resend. */

interface PasswordResetEmail {
  to: string;
  name: string;
  token: string;
  resetId: string;
  requestUrl: string;
}

function configuredOrigin(requestUrl: string): string {
  const configured = process.env.BHAROSA_APP_URL?.trim();
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("Password email is not configured.");
  }
  const url = new URL(configured || requestUrl);
  if (url.username || url.password)
    throw new Error("Password email is not configured.");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("Password email is not configured.");
  }
  return url.origin;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

function resetUrl(token: string, requestUrl: string): string {
  // A URL fragment is not sent in the page request or Referer header, keeping
  // the bearer token out of ordinary access logs. The client form reads it.
  return `${configuredOrigin(requestUrl)}/reset-password#token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(
  input: PasswordResetEmail,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.BHAROSA_EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Password email is not configured.");

  const link = resetUrl(input.token, input.requestUrl);
  const safeName = escapeHtml(input.name || "there");
  const safeLink = escapeHtml(link);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `password-reset-${input.resetId}`,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "Reset your Bharosa Wellness password",
      text: [
        `Hello ${input.name || "there"},`,
        "",
        "Use this secure link to choose a new Bharosa Wellness password:",
        link,
        "",
        "The link expires in 30 minutes and works once. If you did not request it, you can ignore this email.",
      ].join("\n"),
      html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f3f1ea;color:#132d2e;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:40px 20px">
      <div style="background:#fcfbf7;border:1px solid #dce2dd;border-radius:20px;padding:28px">
        <p style="margin:0 0 8px;color:#0b5557;font-size:12px;font-weight:700;letter-spacing:1px">BHAROSA WELLNESS</p>
        <h1 style="margin:0 0 18px;font-size:28px;line-height:1.2">Choose a new password</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.6">Hello ${safeName},</p>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.6">We received a request to reset your password. This private link expires in 30 minutes and works once.</p>
        <a href="${safeLink}" style="display:inline-block;background:#073f43;color:#fff;text-decoration:none;border-radius:12px;padding:14px 20px;font-size:14px;font-weight:700">Reset my password</a>
        <p style="margin:24px 0 0;color:#566665;font-size:13px;line-height:1.55">If you did not request this, ignore the email. Your password will stay unchanged.</p>
      </div>
    </div>
  </body>
</html>`,
    }),
  });

  if (!response.ok) {
    // Provider responses may contain recipient details; never surface or log
    // them. The public password-help response stays generic as well.
    throw new Error("Password email could not be delivered.");
  }
}
