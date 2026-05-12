const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getJobDate(j) {
  return (j.job_date || j.start_date || j.date || "").slice(0, 10);
}

function parseJobEnd(j) {
  const d = getJobDate(j);
  if (!d) return null;
  const startTime = String(j.start_time || "00:00").slice(0, 5);
  const endTime = String(j.end_time || "23:59").slice(0, 5);
  const start = new Date(`${d}T${startTime}:00`);
  const end = new Date(`${d}T${endTime}:00`);
  if (Number.isNaN(end.getTime())) return null;
  if (!Number.isNaN(start.getTime()) && end < start) end.setDate(end.getDate() + 1);
  end.setMinutes(end.getMinutes() + 15);
  return end;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!supabaseUrl) return res.status(500).json({ error: "SUPABASE_URL fehlt in Vercel ENV." });
    if (!serviceKey) return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY fehlt in Vercel ENV." });

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: openRows, error: attErr } = await supabase
      .from("attendance")
      .select("*")
      .is("check_out", null)
      .is("clock_out", null)
      .not("job_id", "is", null);

    if (attErr) throw attErr;
    if (!openRows || !openRows.length) return res.status(200).json({ ok: true, updated: 0, checked: 0 });

    const jobIds = [...new Set(openRows.map(a => a.job_id).filter(Boolean))];

    const { data: jobs, error: jobErr } = await supabase
      .from("jobs")
      .select("*")
      .in("id", jobIds);

    if (jobErr) throw jobErr;

    const jobMap = new Map((jobs || []).map(j => [String(j.id), j]));
    const now = Date.now();
    let updated = 0;
    const details = [];

    for (const a of openRows) {
      const j = jobMap.get(String(a.job_id));
      if (!j) continue;

      const endPlus15 = parseJobEnd(j);
      if (!endPlus15) continue;

      if (now >= endPlus15.getTime()) {
        const outIso = endPlus15.toISOString();

        const { error: updErr } = await supabase
          .from("attendance")
          .update({
            check_out: outIso,
            clock_out: outIso,
            present: false,
            auto_checkout: true
          })
          .eq("id", a.id)
          .is("check_out", null)
          .is("clock_out", null);

        if (!updErr) {
          updated++;
          details.push({ attendance_id: a.id, job_id: a.job_id, checkout: outIso });
        }
      }
    }

    return res.status(200).json({ ok: true, checked: openRows.length, updated, details });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
};
