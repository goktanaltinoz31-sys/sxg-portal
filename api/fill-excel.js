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
function norm(v) {
  return cellText(v).toLowerCase().replace(/\s+/g, " ").trim();
}
function genderCode(g) {
  const s = String(g || "").toLowerCase().trim();
  if (s === "w" || s.includes("weib") || s.includes("female") || s === "f") return "W";
  if (s === "m" || s.includes("männ") || s.includes("maenn") || s.includes("male")) return "M";
  return "";
}
function findColumns(sheet) {
  const found = {};
  for (let r = 1; r <= Math.min(sheet.rowCount || 1, 40); r++) {
    const row = sheet.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      const t = norm(cell.value).replace(/:/g, "");
      if (!found.company && (t === "firma" || t.includes("firma"))) found.company = { row: r, col: c };
      if (!found.area && (t === "bereich" || t.includes("bereich"))) found.area = { row: r, col: c };
      if (!found.first && (t === "vorname" || t.includes("first name"))) found.first = { row: r, col: c };
      if (!found.last && (t === "name" || t === "nachname" || t.includes("last name") || t.includes("surname"))) found.last = { row: r, col: c };
      if (!found.full && !found.last && (t.includes("mitarbeiter") || t.includes("personal"))) found.full = { row: r, col: c };
      if (!found.guard && (t.includes("§34a") || t.includes("34a") || t.includes("bewacher") || t.includes("guard") || t.includes("ausweis"))) found.guard = { row: r, col: c };
      if (!found.epin && (t.includes("e-pin") || t.includes("epin") || t.includes("e pin") || t.includes("i-pin") || t.includes("ipin") || t.includes("dfb"))) found.epin = { row: r, col: c };
      if (!found.gender && (t === "m/w" || t.includes("geschlecht") || t.includes("gender"))) found.gender = { row: r, col: c };
      if (!found.phone && (t.includes("telefon") || t.includes("phone") || t.includes("handy"))) found.phone = { row: r, col: c };
      if (!found.email && (t.includes("mail") || t.includes("e-mail"))) found.email = { row: r, col: c };
    });
    if ((found.first || found.last || found.full) && (found.epin || found.guard || found.gender)) break;
  }
  return found;
}
function firstName(emp) {
  return emp.first_name || String(emp.full_name || "").trim().split(/\s+/)[0] || "";
}
function lastName(emp) {
  if (emp.last_name) return emp.last_name;
  const p = String(emp.full_name || "").trim().split(/\s+/);
  return p.slice(1).join(" ") || "";
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
    const headerRow = c.first?.row || c.last?.row || c.full?.row || c.epin?.row || c.guard?.row || c.gender?.row || 1;
    const startRow = headerRow + 1;

    employees.forEach((emp, i) => {
      const row = sheet.getRow(startRow + i);
      if (c.company) row.getCell(c.company.col).value = "SXG Service";
      if (c.last) row.getCell(c.last.col).value = lastName(emp);
      else if (c.full) row.getCell(c.full.col).value = emp.full_name || [firstName(emp), lastName(emp)].filter(Boolean).join(" ");
      else row.getCell(1).value = emp.full_name || [firstName(emp), lastName(emp)].filter(Boolean).join(" ");
      if (c.first) row.getCell(c.first.col).value = firstName(emp);
      if (c.guard) row.getCell(c.guard.col).value = emp.guard_id || "";
      if (c.epin) row.getCell(c.epin.col).value = emp.epin || "";
      if (c.gender) row.getCell(c.gender.col).value = genderCode(emp.gender);
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
