import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DAYS = ["السبت", "الاحد", "الاثنين", "الثلاثاء", "الاربعاء", "الخميس"];

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (inQ && csv[i + 1] === '"') { cell += '"'; i++; }
      else { inQ = !inQ; }
    } else if (c === "," && !inQ) {
      current.push(cell.replace(/\s+/g, " ").trim());
      cell = "";
    } else if ((c === "\n" || c === "\r") && !inQ) {
      if (c === "\r" && csv[i + 1] === "\n") i++;
      current.push(cell.replace(/\s+/g, " ").trim());
      if (current.some((x) => x !== "")) rows.push(current);
      current = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell || current.length) {
    current.push(cell.replace(/\s+/g, " ").trim());
    rows.push(current);
  }
  return rows;
}

function parseCell(raw: string): { subject: string; instructor: string; room: string } {
  const text = raw.replace(/<br\s*\/?>/gi, "\n").trim();
  if (!text) return { subject: "", instructor: "", room: "" };
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1 && lines[0].includes(" - ")) {
    const parts = lines[0].split(" - ").map((p) => p.trim());
    return { subject: parts[0] || "", instructor: parts[1] || "", room: parts[2] || "" };
  }
  return { subject: lines[0] || "", instructor: lines[1] || "", room: lines[2] || "" };
}

function isSection(raw: string): boolean {
  return /ai lab|simulation lab|معمل/i.test(raw) && !/مدرج|f-sem/i.test(raw);
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sheet_url } = await req.json();
    if (!sheet_url) {
      return new Response(JSON.stringify({ error: "sheet_url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const match = sheet_url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      return new Response(JSON.stringify({ error: "Invalid Google Sheets URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sheetId = match[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

    const csvRes = await fetch(csvUrl);
    if (!csvRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch Google Sheet. Make sure it's shared as 'Anyone with the link'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const csv = await csvRes.text();
    if (csv.includes("<!DOCTYPE") || csv.includes("<html>")) {
      return new Response(JSON.stringify({ error: "Sheet is not public. Share → Anyone with the link → Viewer" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = parseCSV(csv);
    if (rows.length < 6) {
      return new Response(JSON.stringify({ error: "Sheet is empty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse all sections
    const entries: { section: number; day: string; period: number; subject: string; instructor: string; room: string; entry_type: string }[] = [];

    for (let i = 4; i < Math.min(rows.length, 20); i++) {
      const secNum = parseInt((rows[i][1] || "").replace(/\s+/g, "").trim());
      if (isNaN(secNum) || secNum < 1) continue;

      const dataRow = rows[i];
      for (let d = 0; d < 6; d++) {
        const baseCol = 1 + d * 8;
        for (let p = 0; p < 8; p++) {
          const ci = baseCol + p;
          const raw = (dataRow[ci] || "").replace(/\s+/g, " ").trim();
          if (!raw || raw === " ") continue;

          const { subject, instructor, room } = parseCell(raw);
          if (!subject) continue;

          entries.push({
            section: secNum,
            day: DAYS[d],
            period: p + 1,
            subject,
            instructor,
            room,
            entry_type: isSection(raw) ? "section" : "lecture",
          });
        }
      }
    }

    // Save to database using Supabase service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Delete existing data
    await fetch(`${supabaseUrl}/rest/v1/published_schedule?section=gt.0`, {
      method: "DELETE",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "return=minimal",
      },
    });

    // Insert new data
    if (entries.length > 0) {
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/published_schedule`, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(entries),
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text();
        return new Response(JSON.stringify({ error: "Failed to save: " + errText }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sections_imported: [...new Set(entries.map(e => e.section))].length,
      total_entries: entries.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
