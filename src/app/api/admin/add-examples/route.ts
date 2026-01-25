import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  subredditId: string;
  examples: string[];
  label?: "good_fit" | "bad_fit" | "neutral";
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subredditId = (body.subredditId || "").trim();
  const label = body.label ?? "neutral";
  const examples = Array.isArray(body.examples) ? body.examples : [];

  if (!subredditId) {
    return NextResponse.json({ error: "subredditId required" }, { status: 400 });
  }
  if (examples.length === 0) {
    return NextResponse.json({ error: "examples required" }, { status: 400 });
  }
  if (examples.length > 100) {
    return NextResponse.json({ error: "max 100 examples per call" }, { status: 400 });
  }

  const rows = examples
    .map((t) => String(t || "").trim())
    .filter((t) => t.length >= 5 && t.length <= 2000)
    .map((text) => ({
      subreddit_id: subredditId,
      text,
      label,
      source: "manual",
    }));

  if (rows.length === 0) {
    return NextResponse.json({ error: "no valid examples (5–2000 chars)" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("subreddit_examples")
    .insert(rows as any);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}
