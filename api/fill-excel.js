const ExcelJS = require("exceljs");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function cellText(v) {
  if (v == null) return "";
  if (typeof v === "object" && v.text) return String(v.text);
  if (typeof v === "object" && v.richText) return v.richText.map(x => x.text || "").join("");
  return String(v);
}
function norm(v) { return cellText(v).toLowerCase().trim(); }

function findColumns(sheet) {
  const found = {};
  for (let r = 1; r <= Math.min(sheet.rowCount || 1, 30); r++) {
    const row = sheet.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      const t = norm(cell.value);
      if (!found.name && (t.includes("name") || t.includes("mitarbeiter") || t.includes("personal"))) found.name = { row: r, col: c };
      if (!found.epin && (t.includes("e-pin") || t.includes("epin") || t === "pin" || t.includes("e pin"))) found.epin = { row: r, col: c };
      if (!found.guard && (t.includes("bewacher") || t.includes("guard") || t.includes("ausweis"))) found.guard = { row: r, col: c };
      if (!found.phone && (t.includes("telefon") || t.includes("phone") || t.includes("handy"))) found.phone = { row: r, col: c };
      if (!found.email && (t.includes("mail") || t.includes("e-mail"))) found.email = { row: r, col: c };
    });
    if (found.name || found.epin || found.guard) break;
  }
  return found;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!supabaseUrl) return res.status(500).json({ error: "SUPABASE_URL fehlt in Vercel ENV." });
    if (!serviceKey) return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY fehlt in Vercel ENV." });

    const { templatePath, templateName, employees = [], jobId } = req.body || {};
    if (!templatePath) return res.status(400).json({ error: "templatePath fehlt." });
    if (!jobId) return res.status(400).json({ error: "jobId fehlt." });
    if (!Array.isArray(employees) || employees.length === 0) return res.status(400).json({ error: "Keine Mitarbeiter zum Eintragen gefunden." });
    if (templateName && !String(templateName).toLowerCase().endsWith(".xlsx")) {
      return res.status(400).json({ error: "Bitte eine .xlsx-Datei hochladen. .xls wird nicht unterstützt." });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const dl = await supabase.storage.from("job-excel").download(templatePath);
    if (dl.error) return res.status(500).json({ error: "Excel-Vorlage konnte nicht geladen werden: " + dl.error.message });

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(Buffer.from(await dl.data.arrayBuffer()));
    } catch (e) {
      return res.status(400).json({ error: "Excel konnte nicht gelesen werden. Bitte als neue .xlsx-Datei speichern und erneut hochladen." });
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) return res.status(400).json({ error: "Keine Tabelle in der Excel gefunden." });

    const c = findColumns(sheet);
    const startRow = (c.name?.row || c.epin?.row || c.guard?.row || 1) + 1;

    employees.forEach((emp, i) => {
      const row = sheet.getRow(startRow + i);
      row.getCell(c.name?.col || 1).value = emp.full_name || "";
      row.getCell(c.epin?.col || 2).value = emp.epin || "";
      if (c.guard) row.getCell(c.guard.col).value = emp.guard_id || "";
      if (c.phone) row.getCell(c.phone.col).value = emp.phone || "";
      if (c.email) row.getCell(c.email.col).value = emp.email || "";
      row.commit();
    });

    const out = await workbook.xlsx.writeBuffer();
    const safe = (templateName || "kundenliste.xlsx").replace(/[^a-zA-Z0-9._-]/g, "_");
    const generatedPath = `job-${jobId}/generated-${Date.now()}-${safe}`;

    const up = await supabase.storage.from("job-excel").upload(generatedPath, Buffer.from(out), {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: false
    });
    if (up.error) return res.status(500).json({ error: "Fertige Excel konnte nicht gespeichert werden: " + up.error.message });

    return res.status(200).json({ ok: true, generatedPath, generatedName: `ausgefüllt-${safe}`, employeesWritten: employees.length });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
};
