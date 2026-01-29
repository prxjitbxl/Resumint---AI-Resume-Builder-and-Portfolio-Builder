(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const STORAGE_KEY = "resumint_profile_v1";
  const THEME_KEY = "theme";

  // Keep ATS checker theme in sync with landing page
  // Keep ATS checker theme in sync with landing page
  function applyTheme(theme) {
    if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
  }

  function syncFromStorage() {
    const t = localStorage.getItem(THEME_KEY);
    applyTheme(t !== "dark" ? "light" : "dark");
  }

  syncFromStorage();

  window.addEventListener("storage", (e) => {
    if (e.key === THEME_KEY) syncFromStorage();
  });

  // Listen for direct messages from parent (3d.js)
  window.addEventListener("message", (e) => {
    if (e.data?.type === "theme") {
      applyTheme(e.data.theme);
    }
  });

  const roleKeywords = {
    "Full-Stack Developer": ["REST APIs", "SQL", "Auth", "Caching", "Performance", "Testing", "Deployment"],
    "Frontend Developer": ["Accessibility", "Performance", "React", "State management", "Design systems", "Testing"],
    "Data Scientist": ["Evaluation", "Metrics", "Feature engineering", "Baseline", "A/B testing", "Pandas"],
    "AI/ML Engineer": ["NLP", "Retrieval", "Guardrails", "Latency", "Prompting", "Evaluation", "Deployment"],
    "Product Intern": ["Funnels", "Experiments", "Insights", "Stakeholders", "Roadmap", "KPIs"],
  };

  const buzzwords = [
    "hardworking",
    "team player",
    "fast learner",
    "self motivated",
    "go-getter",
    "detail oriented",
    "synergy",
    "dynamic",
    "passionate",
    "results-driven",
  ];

  const roleEl = $("#role");
  const levelEl = $("#level");
  const textEl = $("#resumeText");
  const analyzeBtn = $("#analyzeBtn");
  const loadProfileBtn = $("#loadProfile");

  // New UI elements
  const scanOverlay = $("#scanOverlay");
  const scanMsg = $("#scanMsg");
  const scoreNum = $("#scoreNum");
  const kwPct = $("#kwPct");
  const structPct = $("#structPct");
  const impactPct = $("#impactPct");

  const kwBar = $("#kwBar");
  const structBar = $("#structBar");
  const impactBar = $("#impactBar");

  const checksWrap = $("#checks");
  const missingTags = $("#missingTags");
  const fixes = $("#fixes");

  // Animations
  function setBar(el, pct) {
    if (el) el.style.width = `${pct}%`;
  }

  function animateCount(el, target) {
    if (!el) return;
    const start = 0;
    const duration = 1200;
    const startTime = performance.now();

    const step = (t) => {
      const p = Math.min(1, (t - startTime) / duration);
      const eased = 1 - Math.pow(1 - p, 4); // easeOutQuart
      const val = Math.round(start + (target - start) * eased);
      el.textContent = String(val);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  async function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function safeTrim(v) {
    return String(v ?? "").trim();
  }

  function normalize(text) {
    return safeTrim(text).replace(/\r\n/g, "\n");
  }

  function countWords(text) {
    const t = normalize(text);
    if (!t) return 0;
    return t.split(/\s+/g).filter(Boolean).length;
  }

  function hasEmail(text) {
    return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text);
  }

  function hasPhone(text) {
    return /(\+?\d[\d\s().-]{7,}\d)/.test(text);
  }

  function hasLink(text) {
    return /\bhttps?:\/\/|linkedin\.com|github\.com/i.test(text);
  }

  function sectionPresent(text, name) {
    const t = text.toLowerCase();
    const patterns = {
      summary: [/summary/, /objective/, /profile/],
      education: [/education/, /university/, /college/, /b\.tech|btech|b\.e|be|b\.sc|bsc|m\.sc|msc/],
      skills: [/skills/, /tech stack/, /technologies/, /tools/],
      projects: [/projects?/, /work samples/, /case study/],
      experience: [/experience/, /internship/, /employment/, /work history/],
    };
    return (patterns[name] || []).some((re) => re.test(t));
  }

  function metricCount(text) {
    const t = normalize(text);
    if (!t) return 0;
    const matches =
      t.match(
        /(\b\d+(\.\d+)?\s?(%|ms|s|sec|seconds|mins|min|hours|hrs|x|X|users|user|requests|req|accuracy|f1|f1-score|latency|gpa)\b)/gi
      ) || [];
    // Also count “+12%”, “-38%”, “10k”
    const extra = t.match(/([+-]\s?\d+(\.\d+)?\s?%|\b\d+k\b)/gi) || [];
    return new Set([...matches, ...extra].map((x) => x.toLowerCase())).size;
  }

  function keywordMatch(text, role) {
    const kws = roleKeywords[role] || [];
    const lower = text.toLowerCase();
    const hit = kws.filter((k) => lower.includes(k.toLowerCase()));
    const missing = kws.filter((k) => !lower.includes(k.toLowerCase()));
    const pct = kws.length ? Math.round((hit.length / kws.length) * 100) : 0;
    return { pct, hit, missing, total: kws.length };
  }

  function buzzwordHits(text) {
    const lower = text.toLowerCase();
    return buzzwords.filter((b) => lower.includes(b));
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function pctLabel(n) {
    return `${clamp(Math.round(n), 0, 100)}%`;
  }

  function renderCheck(label, ok, details = "") {
    const div = document.createElement("div");
    div.className = "check";
    const v = ok ? "OK" : "Fix";
    div.innerHTML = `
      <div class="check__k">${escapeHtml(label)}</div>
      <div class="check__v ${ok ? "ok" : "warn"}" title="${escapeAttr(details)}">${escapeHtml(v)}</div>
    `;
    div.style.animation = "fadeUp 0.4s ease backwards";
    return div;
  }

  function renderTags(el, items) {
    el.innerHTML = "";
    if (!items.length) {
      const s = document.createElement("span");
      s.textContent = "None";
      el.appendChild(s);
      return;
    }
    items.slice(0, 12).forEach((t) => {
      const span = document.createElement("span");
      span.textContent = t;
      el.appendChild(span);
    });
  }

  function renderFixes(items) {
    fixes.innerHTML = "";
    if (!items.length) {
      const li = document.createElement("li");
      li.textContent = "Looks good. Add more measurable outcomes to push the score higher.";
      fixes.appendChild(li);
      return;
    }
    items.slice(0, 8).forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      fixes.appendChild(li);
    });
  }

  async function analyze() {
    // Notify parent to start scanner animation
    window.parent.postMessage("startScan", "*");

    // UI: Start Scanning
    if (scanOverlay) {
      scanOverlay.classList.add("active");
      scanMsg.textContent = "Initializing scanner...";
      await wait(600);
      scanMsg.textContent = "Extracting keywords...";
      await wait(600);
      scanMsg.textContent = "Calculating impact factor...";
      await wait(700);
    }

    const role = roleEl?.value || "Full-Stack Developer";
    const level = levelEl?.value || "student";
    const text = normalize(textEl?.value || "");

    const words = countWords(text);
    const metrics = metricCount(text);
    const bw = buzzwordHits(text);
    const kw = keywordMatch(text, role);

    const checks = {
      contact: hasEmail(text) && (hasLink(text) || hasPhone(text)),
      summary: sectionPresent(text, "summary"),
      education: sectionPresent(text, "education"),
      skills: sectionPresent(text, "skills"),
      projects: sectionPresent(text, "projects"),
      experience: sectionPresent(text, "experience"),
      metrics: metrics >= (level === "mid" ? 4 : level === "junior" ? 3 : 2),
      length: words >= 220 && words <= 800,
      buzzwords: bw.length <= 2,
    };

    // Structure score
    const structurePts = [checks.contact, checks.education, checks.skills, checks.projects, checks.summary].filter(Boolean).length;
    const structurePct = Math.round((structurePts / 5) * 100);

    // Impact score
    const impactPts = [checks.metrics, checks.projects, checks.experience].filter(Boolean).length;
    const impactScore = Math.round((impactPts / 3) * 100);

    // Weighted final score
    const score =
      0.25 * structurePct +
      0.30 * kw.pct +
      0.25 * impactScore +
      0.10 * (checks.length ? 100 : clamp((words / 220) * 100, 0, 100)) +
      0.10 * (checks.buzzwords ? 100 : 60);

    const finalScore = clamp(Math.round(score), 0, 100);

    // Hide Overlay
    if (scanOverlay) {
      scanOverlay.classList.remove("active");
    }

    // Trigger Animations
    animateCount(scoreNum, finalScore);
    kwPct.textContent = pctLabel(kw.pct);
    structPct.textContent = pctLabel(structurePct);
    impactPct.textContent = pctLabel(impactScore);

    setBar(kwBar, kw.pct);
    setBar(structBar, structurePct);
    setBar(impactBar, impactScore);

    // Checks list
    checksWrap.innerHTML = "";
    const checkItems = [
      { l: "Contact info (email + link/phone)", ok: checks.contact, d: "Include email + LinkedIn/GitHub/phone" },
      { l: "Summary / Objective section", ok: checks.summary, d: "Add a short summary (2–3 lines)" },
      { l: "Education section", ok: checks.education, d: "Add degree, college, dates" },
      { l: "Skills section", ok: checks.skills, d: "Add a skills block with keywords" },
      { l: "Projects section", ok: checks.projects, d: "Add 1–3 projects with bullets" },
      { l: "Experience section (optional)", ok: checks.experience, d: "Internship/club/leadership helps" },
      { l: "Measurable impact (numbers)", ok: checks.metrics, d: `Found ${metrics} metric(s)` },
      { l: "ATS-friendly length", ok: checks.length, d: `${words} words` },
      { l: "Low buzzword density", ok: checks.buzzwords, d: bw.length ? `Found: ${bw.slice(0, 4).join(", ")}` : "Good" }
    ];

    // Staggered render
    let delay = 0;
    checkItems.forEach(item => {
      const el = renderCheck(item.l, item.ok, item.d);
      el.style.animationDelay = `${delay}ms`;
      checksWrap.appendChild(el);
      delay += 50;
    });

    renderTags(missingTags, kw.missing);

    const fixesOut = [];
    if (!checks.contact) fixesOut.push("Add email + at least one link (LinkedIn/GitHub) or phone at the top.");
    if (!checks.summary) fixesOut.push("Add a 2–3 line Summary that states your target role + 1 measurable outcome.");
    if (!checks.skills) fixesOut.push("Add a Skills section with role keywords (avoid huge lists).");
    if (!checks.projects) fixesOut.push("Add a Projects section with 1–3 projects and 2–3 bullets each.");
    if (!checks.metrics) fixesOut.push("Add numbers: %, ms, users, accuracy, latency, revenue, time saved (at least 2–4).");
    if (!checks.length) fixesOut.push("Keep resume text roughly 220–800 words (1 page for students).");
    if (bw.length > 2) fixesOut.push("Reduce buzzwords (team player, hardworking, passionate). Replace with proof + metrics.");
    if (kw.missing.length) fixesOut.push(`Add relevant keywords for ${role}: ${kw.missing.slice(0, 5).join(", ")}.`);

    renderFixes(fixesOut);
  }

  function loadProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        alert("No saved profile found. Open profile builder, fill details, then click Save locally.");
        return;
      }
      const s = JSON.parse(raw);
      const lines = [];
      lines.push(s.fullName || "Your Name");
      lines.push([s.targetRole, s.location, s.email, s.linkedin, s.github].filter(Boolean).join(" • "));
      lines.push("");
      if (s.headline) lines.push(s.headline);
      if (s.summary) lines.push(s.summary);
      lines.push("");
      lines.push("EDUCATION");
      lines.push([s.university, s.degree, s.eduDates, s.cgpa ? `CGPA: ${s.cgpa}` : ""].filter(Boolean).join(" • "));
      if (s.coursework) lines.push(`Coursework: ${s.coursework}`);
      lines.push("");
      lines.push("SKILLS");
      lines.push([s.skillsTech, s.skillsTools].filter(Boolean).join(", "));
      lines.push("");
      lines.push("PROJECTS");
      (s.projects || []).forEach((p) => {
        if (!p) return;
        lines.push(`${p.name || "Untitled"} — ${[p.tech, p.metric, p.link].filter(Boolean).join(" • ")}`);
        if (p.notes) lines.push(p.notes);
        lines.push("");
      });
      if ((s.experience || []).length) {
        lines.push("EXPERIENCE");
        (s.experience || []).forEach((x) => {
          if (!x) return;
          lines.push(`${x.name || "Untitled"} — ${[x.tech, x.metric, x.link].filter(Boolean).join(" • ")}`);
          if (x.notes) lines.push(x.notes);
          lines.push("");
        });
      }

      if (roleEl && s.targetRole) roleEl.value = s.targetRole;
      textEl.value = lines.join("\n").trim();
      analyze();
    } catch {
      alert("Could not load profile (storage blocked or corrupted).");
    }
  }

  function resetStats() {
    scoreNum.textContent = "—";
    kwPct.textContent = "—";
    structPct.textContent = "—";
    impactPct.textContent = "—";
    setBar(kwBar, 0);
    setBar(structBar, 0);
    setBar(impactBar, 0);
    checksWrap.innerHTML = "";
    missingTags.innerHTML = "";
    fixes.innerHTML = "";
  }

  analyzeBtn?.addEventListener("click", analyze);
  loadProfileBtn?.addEventListener("click", loadProfile);
  textEl?.addEventListener("input", () => {
    if (!textEl.value.trim()) resetStats();
  });
  textEl?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analyze();
  });

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }
})();

