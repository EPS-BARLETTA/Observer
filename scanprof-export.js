"use strict";

(function (global) {
  const MAX_QR_BYTES = 2800; // conservative limit to keep QR codes scannable
  const MAX_QR_OBSERVABLES = 8;
  let lastStats = { total: 0, included: 0 };

  function splitFullName(fullName) {
    const safe = (fullName || "").trim();
    if (!safe) return { prenom: "", nom: "" };
    const parts = safe.split(/\s+/);
    if (parts.length === 1) return { prenom: parts[0], nom: "" };
    return { prenom: parts[0], nom: parts.slice(1).join(" ") };
  }

  function summarizeText(value, maxLength) {
    if (!value) return "";
    const clean = String(value).replace(/\s+/g, " ").trim();
    if (!clean) return "";
    if (clean.length <= maxLength) return clean;
    return clean.slice(0, Math.max(1, maxLength - 1)) + "…";
  }

  function buildShortTag(text, maxLength = 12) {
    if (!text) return "";
    const upperMatches = text.match(/[A-Z]{2,}/g);
    if (upperMatches && upperMatches.length) {
      return upperMatches[0].slice(0, maxLength);
    }
    const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleaned = normalized.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
    if (!cleaned) return "";
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length === 0) return "";
    if (words.length === 1) return words[0].slice(0, maxLength).toUpperCase();
    const initials = words.map(w => w[0]).join("").toUpperCase();
    if (initials) return initials.slice(0, maxLength);
    return cleaned.slice(0, maxLength).toUpperCase();
  }

  function buildObservationDetails(target) {
    const summaries = [];
    (target.items || []).forEach((item) => {
      if (!item || !item.text) return;
      const useLevels = typeof item.useLevels === "boolean" ? item.useLevels : true;
      const usePlusMinus = typeof item.usePlusMinus === "boolean" ? item.usePlusMinus : true;
      const useComment = typeof item.useComment === "boolean" ? item.useComment : true;

      const segments = [];
      const label = buildShortTag(item.text) || summarizeText(item.text, 18);
      if (label) segments.push(label);
      if (useLevels && typeof item.level === "number") segments.push(`N${item.level}`);
      if (usePlusMinus) segments.push(`+${item.plus || 0}`);
      if (useComment && item.note) segments.push(summarizeText(item.note, 24));

      const line = segments.filter(Boolean).join(" | ");
      if (line) summaries.push(line);
    });

    lastStats.total += summaries.length;
    const limited = summaries.slice(0, MAX_QR_OBSERVABLES);
    lastStats.included += limited.length;
    return limited;
  }

  function filteredTargets(session, options = {}) {
    const all = Array.isArray(session?.targets) ? session.targets : [];
    if (!options || !options.targetId) return all;
    return all.filter(t => t.id === options.targetId);
  }

  function buildEntries(session, options = {}) {
    const targets = filteredTargets(session, options);
    if (!session || targets.length === 0) return [];
    const isObserver = session.mode === "observer";

    return targets.map((target) => {
      const observedName = isObserver ? target.name : session.selfName;
      const { prenom } = splitFullName(observedName || "");
      const entry = { prenom };
      const summaries = buildObservationDetails(target);
      summaries.forEach((line, idx) => {
        entry[`observable_${idx + 1}`] = line;
      });
      return entry;
    });
  }

  function buildPayload(session, options = {}) {
    lastStats = { total: 0, included: 0 };
    const entries = buildEntries(session, options);
    if (!entries.length) return { entries, payload: null, json: "", byteLength: 0 };

    const payload = entries;
    const json = JSON.stringify(payload);
    let byteLength = json.length;
    if (typeof TextEncoder !== "undefined") {
      byteLength = new TextEncoder().encode(json).length;
    }

    return { entries, payload, json, byteLength };
  }

  global.ScanProfExport = {
    buildEntries,
    buildPayload,
    MAX_QR_BYTES,
    MAX_QR_OBSERVABLES,
    getLastStats: () => ({ ...lastStats })
  };
})(window);
