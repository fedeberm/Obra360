import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Called by Vercel Cron every 3 days to keep Supabase from pausing.
export async function GET() {
  try {
    const supabase = await createClient();
    // Minimal query — just enough to show activity to Supabase
    const { error } = await supabase.from("projects").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
