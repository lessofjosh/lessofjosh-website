/**
 * Authenticated SMTP over STARTTLS client using Cloudflare Workers TCP sockets (cloudflare:sockets).
 * Configured for iCloud Mail SMTP (smtp.mail.me.com:587) or custom SMTP host.
 */

function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function encodeMimeHeader(value) {
  const clean = String(value ?? "").replace(/[\r\n]+/g, " ").trim();
  if (/^[\x20-\x7E]*$/.test(clean)) {
    return clean;
  }
  return `=?UTF-8?B?${encodeBase64(clean)}?=`;
}

function dotStuffBody(text) {
  const normalized = String(text ?? "").replace(/\r?\n/g, "\r\n");
  return normalized.replace(/^\./gm, "..");
}

class SmtpLineReader {
  constructor(readable) {
    this.reader = readable.getReader();
    this.decoder = new TextDecoder();
    this.buffer = "";
  }

  async readResponse() {
    const lines = [];
    while (true) {
      const newlineIdx = this.buffer.indexOf("\n");
      if (newlineIdx !== -1) {
        const line = this.buffer.slice(0, newlineIdx).replace(/\r$/, "");
        this.buffer = this.buffer.slice(newlineIdx + 1);
        lines.push(line);
        if (line.length >= 4 && /^\d{3} /.test(line)) {
          const code = Number.parseInt(line.slice(0, 3), 10);
          return { code, message: lines.join("\n") };
        }
        if (line.length === 3 && /^\d{3}$/.test(line)) {
          const code = Number.parseInt(line, 10);
          return { code, message: lines.join("\n") };
        }
        continue;
      }

      const { value, done } = await this.reader.read();
      if (done) {
        throw new Error(`SMTP connection closed unexpectedly: ${lines.join(" | ")}`);
      }
      this.buffer += this.decoder.decode(value, { stream: true });
    }
  }

  release() {
    try {
      this.reader.releaseLock();
    } catch {
      // Ignore
    }
  }
}

async function sendCommand(writer, reader, command, expectedCodes) {
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(`${command}\r\n`));
  const res = await reader.readResponse();
  if (!expectedCodes.includes(res.code)) {
    throw new Error(`SMTP error (expected ${expectedCodes.join("/")}, got ${res.code}): ${res.message}`);
  }
  return res;
}

export async function sendSmtpEmail({
  host = "smtp.mail.me.com",
  port = 587,
  username,
  password,
  fromEmail = "josh@lessofjosh.com",
  fromName = "Less of Josh Website",
  toEmail,
  replyToName = "",
  replyToEmail = "",
  subject,
  body
}) {
  if (!username || !password) {
    throw new Error("Missing SMTP username or password secret.");
  }

  const { connect } = await import("cloudflare:sockets");
  const socket = connect(
    { hostname: host, port: Number(port) || 587 },
    { secureTransport: "starttls", allowHalfOpen: false }
  );

  let reader = new SmtpLineReader(socket.readable);
  let writer = socket.writable.getWriter();

  try {
    const greeting = await reader.readResponse();
    if (greeting.code !== 220) {
      throw new Error(`Unexpected SMTP greeting: ${greeting.message}`);
    }

    await sendCommand(writer, reader, "EHLO lessofjosh.com", [250]);
    await sendCommand(writer, reader, "STARTTLS", [220]);

    reader.release();
    writer.releaseLock();

    const tlsSocket = socket.startTls();
    reader = new SmtpLineReader(tlsSocket.readable);
    writer = tlsSocket.writable.getWriter();

    await sendCommand(writer, reader, "EHLO lessofjosh.com", [250]);
    await sendCommand(writer, reader, "AUTH LOGIN", [334]);
    await sendCommand(writer, reader, encodeBase64(username), [334]);
    await sendCommand(writer, reader, encodeBase64(password), [235]);

    await sendCommand(writer, reader, `MAIL FROM:<${fromEmail}>`, [250]);
    await sendCommand(writer, reader, `RCPT TO:<${toEmail}>`, [250, 251]);
    await sendCommand(writer, reader, "DATA", [354]);

    const msgId = `<${crypto.randomUUID()}@lessofjosh.com>`;
    const dateHeader = new Date().toUTCString();
    const headers = [
      `Date: ${dateHeader}`,
      `Message-ID: ${msgId}`,
      `From: "${encodeMimeHeader(fromName)}" <${fromEmail}>`,
      `To: <${toEmail}>`,
      `Subject: ${encodeMimeHeader(subject)}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit"
    ];

    if (replyToEmail) {
      const formattedReplyTo = replyToName
        ? `"${encodeMimeHeader(replyToName)}" <${replyToEmail}>`
        : `<${replyToEmail}>`;
      headers.push(`Reply-To: ${formattedReplyTo}`);
    }

    const messageData = `${headers.join("\r\n")}\r\n\r\n${dotStuffBody(body)}\r\n.`;
    await sendCommand(writer, reader, messageData, [250]);

    try {
      await sendCommand(writer, reader, "QUIT", [221]);
    } catch {
      // Ignore QUIT close warnings
    }

    try {
      await tlsSocket.close();
    } catch {
      // Ignore socket close error
    }

    return true;
  } finally {
    reader.release();
    try {
      writer.releaseLock();
    } catch {
      // Ignore
    }
  }
}
