import { NextResponse } from "next/server";
import { z } from "zod";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

const suggestionSchema = z.object({
  name: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email().max(200).optional().or(z.literal("")).default(""),
  message: z.string().trim().min(1, "Message is required").max(5000),
  website: z.string().optional().default(""),
  submittedAt: z.string().optional().default(""),
});

function getTransport() {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true";
  if (!host || !portRaw || !user || !pass) return null;
  const port = Number(portRaw);
  if (!Number.isFinite(port)) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = suggestionSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid submission";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { name, email, message, website, submittedAt } = parsed.data;

  // Simple spam deterrents: hidden honeypot + too-fast submit rejection.
  if (website.trim()) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  if (submittedAt) {
    const t = Number(submittedAt);
    if (Number.isFinite(t) && Date.now() - t < 1500) {
      return NextResponse.json({ error: "Please wait a moment and submit again." }, { status: 429 });
    }
  }

  const transporter = getTransport();
  if (!transporter) {
    return NextResponse.json({ error: "Suggestion service is not configured." }, { status: 500 });
  }

  const timestamp = new Date().toISOString();
  const subject = "CIS — Collaborative Investigation Sleuths suggestion";
  const text = [
    `Timestamp: ${timestamp}`,
    `Name: ${name || "(not provided)"}`,
    `Email: ${email || "(not provided)"}`,
    "",
    "Message:",
    message,
  ].join("\n");

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: "fourmiapps@gmail.com",
      replyTo: email || undefined,
      subject,
      text,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not send suggestion";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

