import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:info@nur-sxg-service.de";

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    if (!supabaseUrl || !serviceKey || !publicKey || !privateKey) {
      return res.status(500).json({ error: "Push ENV missing" });
    }

    const { title, body, profileIds = [], url = "/" } = req.body || {};
    const supabase = createClient(supabaseUrl, serviceKey);

    let q = supabase.from("push_subscriptions").select("*");
    if (Array.isArray(profileIds) && profileIds.length) q = q.in("profile_id", profileIds);
    const { data, error } = await q;
    if (error) throw error;

    const payload = JSON.stringify({ title: title || "SXG Portal", body: body || "Neue Benachrichtigung", url });

    const results = await Promise.allSettled((data || []).map(async s => {
      const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
        throw err;
      }
    }));

    return res.status(200).json({ ok: true, sent: results.filter(r => r.status === "fulfilled").length, total: results.length });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
