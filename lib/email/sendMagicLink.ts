export async function sendMagicLink({
  to,
  url,
}: {
  to: string
  url: string
}): Promise<void> {
  const host = new URL(url).host
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not set')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `expaify <dev@expaify.com>`,
      to,
      subject: `Your sign-in link for expaify`,
      html: magicLinkHtml(url, host, to),
      text: `Sign in to expaify\n\nClick this link to sign in:\n${url}\n\nThis link expires in 24 hours. If you didn't request this, you can ignore this email.`,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Resend error: ${JSON.stringify(body)}`)
  }
}

function magicLinkHtml(url: string, host: string, to: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EDE9E0;">
        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #EDE9E0;">
            <span style="font-size:20px;font-weight:700;color:#1A1A18;letter-spacing:-0.3px;">
              expaify<span style="display:inline-block;width:7px;height:7px;background:#FF6B4A;border-radius:50%;margin-left:2px;vertical-align:middle;"></span>
            </span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1A1A18;letter-spacing:-0.3px;">Your sign-in link</h1>
            <p style="margin:0 0 28px;font-size:15px;color:#6B6B63;line-height:1.5;">
              Click the button below to sign in to <strong>${host}</strong>. This link expires in 24 hours.
            </p>
            <a href="${url}"
               style="display:inline-block;background:#0E5A54;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:999px;letter-spacing:-0.1px;">
              Sign in to expaify
            </a>
            <p style="margin:28px 0 0;font-size:13px;color:#9B9B91;line-height:1.5;">
              Or copy this link into your browser:<br>
              <span style="color:#0E5A54;word-break:break-all;">${url}</span>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;background:#FAF7F2;border-top:1px solid #EDE9E0;">
            <p style="margin:0;font-size:12px;color:#9B9B91;">
              If you didn&rsquo;t request this email, you can safely ignore it.
              This link was requested for ${to}.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
    .replace(/\${to}/g, to)
}
