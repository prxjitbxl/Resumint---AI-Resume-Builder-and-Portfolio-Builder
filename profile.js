(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Theme listener (from 3d.js parent)
  window.addEventListener("message", (e) => {
    if (e.data?.type === "theme") {
      const theme = e.data.theme;
      if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
      else document.documentElement.removeAttribute("data-theme");
    }
  });

  // Request initial theme from parent (fixes back button reset)
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "requestTheme" }, "*");
  }

  // ---------- Sticky header elevate ----------
  const topbar = document.querySelector("[data-elevate]");
  const onScroll = () => topbar?.setAttribute("data-elevated", window.scrollY > 8 ? "true" : "false");
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // ---------- State ----------
  const STORAGE_KEY = "resumint_profile_v1";
  const roleEl = $("#targetRole");
  const aiMsg = $("#aiMsg");
  const completionChip = $("#completionChip");
  const exportNote = $("#exportNote");
  const jumpPreviewBtn = $("#jumpPreview");

  const defaults = () => ({
    fullName: "",
    targetRole: "Full-Stack Developer",
    email: "",
    location: "",
    linkedin: "",
    github: "",
    headline: "",
    summary: "",
    university: "",
    degree: "",
    eduDates: "",
    cgpa: "",
    coursework: "",
    skillsTech: "",
    skillsTools: "",
    projects: [],
    experience: [],
    custom: [],
  });

  let state = load() ?? defaults();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      exportNote.textContent = "Saved locally.";
      setTimeout(() => (exportNote.textContent = ""), 1200);
    } catch {
      exportNote.textContent = "Could not save locally (storage blocked).";
      setTimeout(() => (exportNote.textContent = ""), 1800);
    }
  }

  // ---------- Wizard navigation ----------
  const stepOrder = ["basics", "education", "skills", "projects", "experience", "custom"];
  let activeStepIdx = 0;

  const stepsEl = $("#steps");
  const panels = $$(".panel");
  const prevStepBtn = $("#prevStep");
  const nextStepBtn = $("#nextStep");

  function setActiveStep(stepKey) {
    activeStepIdx = Math.max(0, stepOrder.indexOf(stepKey));
    $$(".step", stepsEl).forEach((li) => li.classList.toggle("is-active", li.getAttribute("data-step") === stepKey));
    panels.forEach((p) => p.classList.toggle("is-active", p.getAttribute("data-panel") === stepKey));
    prevStepBtn.disabled = activeStepIdx === 0;
    nextStepBtn.textContent = activeStepIdx === stepOrder.length - 1 ? "Finish" : "Next →";
    aiMsg.textContent = aiHintFor(stepKey);
  }

  stepsEl?.addEventListener("click", (e) => {
    const li = e.target?.closest?.(".step");
    if (!li) return;
    setActiveStep(li.getAttribute("data-step"));
  });
  prevStepBtn?.addEventListener("click", () => setActiveStep(stepOrder[Math.max(0, activeStepIdx - 1)]));
  nextStepBtn?.addEventListener("click", () => {
    if (activeStepIdx === stepOrder.length - 1) {
      aiMsg.textContent = "Nice. Export JSON or copy the resume text below.";
      document.getElementById("export")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setActiveStep(stepOrder[activeStepIdx + 1]);
  });



  function cardTemplate(kind, idx, item) {
    const label = kind === "projects" ? `Project ${idx + 1}` : kind === "experience" ? `Experience ${idx + 1}` : `Item ${idx + 1}`;
    const nameLabel = kind === "projects" ? "Project name" : kind === "experience" ? "Role / Position" : "Title (e.g. Award)";
    const orgLabel = kind === "projects" ? "Link (optional)" : kind === "experience" ? "Company / Org" : "Category (e.g. Cert)";
    const techLabel = kind === "projects" ? "Tech stack" : kind === "experience" ? "Tech / Tools" : "";
    const metricLabel = kind === "projects" ? "Impact metric (optional)" : kind === "experience" ? "Impact metric (optional)" : "";
    const notesLabel = kind === "projects" ? "Notes (what you built)" : kind === "experience" ? "Notes (what you did)" : "Details";

    return `
      <div class="cardItem" data-kind="${kind}" data-idx="${idx}">
        <div class="cardItem__top">
          <div class="cardItem__title">${escapeHtml(label)}</div>
          <button class="miniBtn" type="button" data-action="remove">Remove</button>
        </div>
        <div class="grid2">
          <label class="field">
            <span class="field__label">${escapeHtml(nameLabel)}</span>
            <input class="field__control" data-k="name" value="${escapeAttr(item.name || "")}" placeholder="Example: Resume Builder" />
          </label>
          <label class="field">
            <span class="field__label">${escapeHtml(orgLabel)}</span>
            <input class="field__control" data-k="link" value="${escapeAttr(item.link || "")}" placeholder="https://..." />
          </label>
        </div>
        </div>
        ${kind !== 'custom' ? `
        <div class="grid2">
          <label class="field">
            <span class="field__label">${escapeHtml(techLabel)}</span>
            <input class="field__control" data-k="tech" value="${escapeAttr(item.tech || "")}" placeholder="React, Node, Python..." />
          </label>
          <label class="field">
            <span class="field__label">${escapeHtml(metricLabel)}</span>
            <input class="field__control" data-k="metric" value="${escapeAttr(item.metric || "")}" placeholder="Example: reduced load time 38%" />
          </label>
        </div>` : ''}
        <label class="field">
          <span class="field__label">${escapeHtml(notesLabel)}</span>
          <textarea class="field__control" rows="3" data-k="notes" placeholder="Write raw notes; AI will help.">${escapeHtml(item.notes || "")}</textarea>
        </label>
      </div>
    `;
  }

  // ---------- Render dynamic cards ----------
  const projectsWrap = $("#projects");
  const expWrap = $("#experience");
  const customWrap = $("#custom");
  const addProjectBtn = $("#addProject");
  const addExperienceBtn = $("#addExperience");
  const addCustomBtn = $("#addCustom"); // Ensure this is selected

  function renderCards() {
    if (projectsWrap) projectsWrap.innerHTML = state.projects.map((p, i) => cardTemplate("projects", i, p)).join("");
    if (expWrap) expWrap.innerHTML = state.experience.map((x, i) => cardTemplate("experience", i, x)).join("");
    if (customWrap && state.custom) customWrap.innerHTML = state.custom.map((c, i) => cardTemplate("custom", i, c)).join("");
  }

  function attachCardHandlers() {
    const onWrapClick = (wrap, kind) => {
      wrap?.addEventListener("click", (e) => {
        const btn = e.target?.closest?.("button[data-action='remove']");
        if (!btn) return;
        const card = e.target.closest(".cardItem");
        const idx = Number(card?.getAttribute("data-idx") || "-1");
        if (idx < 0) return;
        state[kind].splice(idx, 1);
        renderCards();
        bindCardInputs();
        updateAll();
      });
    };
    onWrapClick(projectsWrap, "projects");
    onWrapClick(expWrap, "experience");
    onWrapClick(customWrap, "custom");
  }

  function bindCardInputs() {
    const bind = (wrap, kind) => {
      $$(".cardItem", wrap).forEach((card) => {
        const idx = Number(card.getAttribute("data-idx") || "0");
        $$("[data-k]", card).forEach((el) => {
          el.addEventListener("input", () => {
            const k = el.getAttribute("data-k");
            state[kind][idx][k] = el.value;
            updateAll();
          });
        });
      });
    };
    bind(projectsWrap, "projects");
    bind(expWrap, "experience");
    bind(customWrap, "custom");
  }

  addProjectBtn?.addEventListener("click", () => {
    state.projects.push({ name: "", link: "", tech: "", metric: "", notes: "" });
    renderCards();
    bindCardInputs();
    updateAll();
  });
  addExperienceBtn?.addEventListener("click", () => {
    state.experience.push({ name: "", link: "", tech: "", metric: "", notes: "" });
    renderCards();
    bindCardInputs();
    updateAll();
  });

  if (addCustomBtn || document.getElementById("addCustom")) {
    const btn = addCustomBtn || document.getElementById("addCustom");
    btn.addEventListener("click", () => {
      if (!state.custom) state.custom = [];
      // reused fields: name=Title, link=Category, notes=Details
      state.custom.push({ name: "", link: "", notes: "" });
      renderCards();
      bindCardInputs();
      updateAll();
    });
  }

  // ---------- Form bindings ----------
  const form = $("#profileForm");
  const fieldIds = [
    "fullName",
    "targetRole",
    "email",
    "location",
    "linkedin",
    "github",
    "headline",
    "summary",
    "university",
    "degree",
    "eduDates",
    "cgpa",
    "coursework",
    "skillsTech",
    "skillsTools",
  ];

  function hydrateFields() {
    fieldIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === "SELECT") el.value = state[id] || el.value;
      else el.value = state[id] || "";
    });
  }

  form?.addEventListener("input", (e) => {
    const el = e.target;
    if (!el?.id) return;
    if (!fieldIds.includes(el.id)) return;
    state[el.id] = el.value;
    updateAll();
  });

  // ---------- Preview ----------
  const pvName = $("#pvName");
  const pvMeta = $("#pvMeta");
  const pvHeadline = $("#pvHeadline");
  const pvSummary = $("#pvSummary");
  const pvEdu = $("#pvEdu");
  const pvCoursework = $("#pvCoursework");
  const pvSkills = $("#pvSkills");
  const pvProjects = $("#pvProjects");
  const pvExperience = $("#pvExperience");

  function renderPreview() {
    if (pvName) pvName.textContent = state.fullName?.trim() || "Your Name";

    const metaParts = [];
    if (state.targetRole?.trim()) metaParts.push(state.targetRole.trim());
    if (state.location?.trim()) metaParts.push(state.location.trim());
    if (state.email?.trim()) metaParts.push(state.email.trim());
    if (state.linkedin?.trim()) metaParts.push(state.linkedin.trim());
    if (state.github?.trim()) metaParts.push(state.github.trim());
    if (pvMeta) pvMeta.textContent = metaParts.length ? metaParts.join(" • ") : "Role • Location • Email • Links";

    if (pvHeadline) pvHeadline.textContent = state.headline?.trim() || "Your 1-line headline";
    if (pvSummary) pvSummary.textContent = state.summary?.trim() || "Write a short summary. The AI guide will keep it crisp.";

    const eduBits = [];
    if (state.university?.trim()) eduBits.push(state.university.trim());
    if (state.degree?.trim()) eduBits.push(state.degree.trim());
    if (state.eduDates?.trim()) eduBits.push(state.eduDates.trim());
    if (state.cgpa?.trim()) eduBits.push(`CGPA: ${state.cgpa.trim()}`);
    if (pvEdu) pvEdu.textContent = eduBits.length ? eduBits.join(" • ") : "University • Degree • Dates • CGPA";

    const cw = (state.coursework || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (pvCoursework) pvCoursework.textContent = cw.length ? `Coursework: ${cw.join(", ")}` : "";

    const skillTags = normalizeTags(state.skillsTech, state.skillsTools);
    if (pvSkills) {
      pvSkills.innerHTML = "";
      if (!skillTags.length) {
        const s = document.createElement("span");
        s.textContent = "Add skills to show tags";
        pvSkills.appendChild(s);
      } else {
        skillTags.slice(0, 18).forEach((t) => {
          const span = document.createElement("span");
          span.textContent = t;
          pvSkills.appendChild(span);
        });
      }
    }

    if (pvProjects) pvProjects.innerHTML = state.projects.length ? "" : `<div class="muted">Add at least one project.</div>`;
    state.projects.forEach((p) => pvProjects?.appendChild(renderItem(p)));

    if (pvExperience) pvExperience.innerHTML = state.experience.length ? "" : `<div class="muted">Add experience (optional).</div>`;
    state.experience.forEach((x) => pvExperience?.appendChild(renderItem(x)));
  }

  function renderItem(obj) {
    const root = document.createElement("div");
    root.className = "item";

    const name = (obj.name || "").trim() || "Untitled";
    const meta = [obj.tech, obj.metric, obj.link].map((x) => (x || "").trim()).filter(Boolean).join(" • ");
    const bullets = bulletsFromNotes(obj.notes, state.targetRole, obj.metric, obj.tech);

    root.innerHTML = `
      <div class="item__row">
        <div class="item__name">${escapeHtml(name)}</div>
        <div class="item__meta">${escapeHtml(meta)}</div>
      </div>
      <ul class="item__bullets">
        ${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}
      </ul>
    `;
    return root;
  }

  // ---------- “AI” helpers (demo-friendly, no backend) ----------
  const verbsByRole = {
    "Full-Stack Developer": ["Built", "Shipped", "Designed", "Implemented", "Optimized", "Integrated"],
    "Frontend Developer": ["Crafted", "Designed", "Implemented", "Optimized", "Improved", "Delivered"],
    "Data Scientist": ["Developed", "Analyzed", "Modeled", "Evaluated", "Validated", "Improved"],
    "AI/ML Engineer": ["Built", "Trained", "Deployed", "Optimized", "Evaluated", "Hardened"],
    "Product Intern": ["Defined", "Led", "Shipped", "Tested", "Measured", "Improved"],
  };
  const roleKeywords = {
    "Full-Stack Developer": ["REST APIs", "SQL", "Auth", "Caching", "Performance", "Testing", "Deployment"],
    "Frontend Developer": ["Accessibility", "Performance", "React", "State management", "Design systems", "Testing"],
    "Data Scientist": ["Evaluation", "Metrics", "Feature engineering", "Baseline", "A/B testing", "Pandas"],
    "AI/ML Engineer": ["NLP", "Retrieval", "Guardrails", "Latency", "Prompting", "Evaluation", "Deployment"],
    "Product Intern": ["Funnels", "Experiments", "Insights", "Stakeholders", "Roadmap", "KPIs"],
  };

  function bulletsFromNotes(notes, role, metric, tech) {
    const t = (notes || "").trim();
    if (!t) return ["Add notes; the AI will convert them into impact-first bullets."];
    const verb = pick(verbsByRole[role] || verbsByRole["Full-Stack Developer"]);
    const headline = t.split(/[.!?\n]/).map((x) => x.trim()).filter(Boolean)[0] || t;
    const metricPhrase = (metric || "").trim() ? `, achieving ${metric.trim()}` : "";
    const techPhrase = (tech || "").trim() ? ` using ${(tech || "").trim()}` : "";

    const bullets = [
      `${verb} ${lowerFirst(headline)}${techPhrase}${metricPhrase}.`,
      `Improved clarity by structuring the work into scope → implementation → results (ATS + human readable).`,
      `Added measurable outcomes and role keywords to increase recruiter signal density.`,
    ];
    return bullets;
  }

  function suggestImprovements() {
    const role = state.targetRole || "Full-Stack Developer";
    const kw = roleKeywords[role] || [];
    const tips = [];

    // Priority 1: Basics
    if (!state.fullName?.trim()) return setAiMsg("First things first: What's your <b>Full Name</b>?");
    if (!state.headline?.trim()) return setAiMsg(`Add a <b>Headline</b>. Example: "Aspiring ${role} building AI tools".`);
    if (!state.summary?.trim()) return setAiMsg(`Write a <b>Summary</b>. Mention your goal to become a ${role}.`);

    // Priority 2: Skills
    const tags = normalizeTags(state.skillsTech, state.skillsTools);
    if (!tags.length) return setAiMsg(`Add your <b>Technical Skills</b>. It helps me tailor the resume checks.`);

    // Priority 3: Projects
    if (!state.projects.length) return setAiMsg("Add at least <b>one Project</b>. Prove you can build things.");

    // Priority 4: Metrics (The "Gold" Standard)
    const missingMetric = state.projects.find((p) => !(p.metric || "").trim());
    if (missingMetric) {
      return setAiMsg(`For project <b>"${missingMetric.name || "Untitled"}"</b>, add a number (e.g., "reduced latency by 40%"). Metrics = Interviews.`);
    }

    // Priority 5: Keywords
    const existingKw = new Set(tags.map(t => t.toLowerCase()));
    const missingKw = kw.find(k => !existingKw.has(k.toLowerCase()));
    if (missingKw) {
      return setAiMsg(`Try adding the keyword <b>"${missingKw}"</b> to your Skills (if you know it). It's popular for ${role}s.`);
    }

    // Priority 6: Polish / "Done" state
    const bonusTips = [
      "Check for spelling errors. Typos kill credibility.",
      "Ensure your LinkedIn link works and profile is public.",
      "Try exporting to PDF and checking the layout.",
      "Great job! Your profile signal is strong. Ready to export?"
    ];
    setAiMsg(pick(bonusTips));
  }

  function setAiMsg(html) {
    aiMsg.innerHTML = html;
    // visual cue
    aiMsg.classList.remove("pop");
    void aiMsg.offsetWidth; // trigger reflow
    aiMsg.classList.add("pop");
  }

  function suggestKeywords() {
    const role = state.targetRole || "Full-Stack Developer";
    const existing = new Set(normalizeTags(state.skillsTech, state.skillsTools).map((x) => x.toLowerCase()));
    const suggested = (roleKeywords[role] || []).filter((k) => !existing.has(k.toLowerCase())).slice(0, 8);

    const msg = suggested.length
      ? `Suggested keywords for ${role}: <b>${suggested.join(", ")}</b>.`
      : `Your skills look great for a ${role}! Focus on adding more metrics to your projects now.`;
    setAiMsg(msg);
  }

  function rewriteAllBullets() {
    setAiMsg("Rewriting bullets into action → impact. Tip: add numbers for stronger bullets.");
    // This preview is derived from notes anyway; just force refresh.
    renderPreview();
  }

  function aiHintFor(stepKey) {
    const role = state.targetRole || "Full-Stack Developer";
    switch (stepKey) {
      case "basics":
        return "Basics: add a clear target role + 1-line headline. Keep it specific (AI + web + HR-tech).";
      case "education":
        return "Education: include degree + dates. Add coursework only if it supports your target role.";
      case "skills":
        return `Skills: for ${role}, include role keywords + tools you actually used. Avoid listing everything.`;
      case "projects":
        return "Projects: write raw notes + tech + a metric. I’ll convert them into impact-first bullets.";
      case "experience":
        return "Experience: show ownership, scope, and outcomes. Add 2–3 bullets max per item.";
      default:
        return "Keep going — I’ll guide each section.";
    }
  }

  // ---------- Completion ----------
  function calcCompletion() {
    // Granular scoring (prevents coarse jumps like 14% per field).
    // Experience is optional and does not block 100%.
    const safeTrim = (v) => String(v ?? "").trim();

    const techTags = normalizeTags(state.skillsTech);
    const toolTags = normalizeTags(state.skillsTools);

    const hasAny = (obj, keys) => keys.some((k) => safeTrim(obj?.[k]).length > 0);

    // Count projects/experience that the user actually started filling,
    // so adding a blank extra card does NOT reduce completion.
    const activeProjects = (Array.isArray(state.projects) ? state.projects : []).filter((p) =>
      hasAny(p, ["name", "link", "tech", "metric", "notes"])
    );
    const activeExperience = (Array.isArray(state.experience) ? state.experience : []).filter((x) =>
      hasAny(x, ["name", "link", "tech", "metric", "notes"])
    );

    const checks = [
      // Basics
      safeTrim(state.fullName).length > 0,
      safeTrim(state.email).length > 0,
      safeTrim(state.location).length > 0,
      safeTrim(state.linkedin).length > 0,
      safeTrim(state.github).length > 0,
      safeTrim(state.headline).length > 0,
      safeTrim(state.summary).length > 0,

      // Education
      safeTrim(state.university).length > 0,
      safeTrim(state.degree).length > 0,
      safeTrim(state.eduDates).length > 0,

      // Skills (count separately so user sees steady progress)
      techTags.length > 0,
      toolTags.length > 0,
    ];

    // Projects: completion should reflect every project the user fills in.
    // Require at least one project overall to reach 100%.
    checks.push(activeProjects.length >= 1);
    activeProjects.forEach((p) => {
      checks.push(safeTrim(p.name).length > 0);
      checks.push(safeTrim(p.tech).length > 0);
      checks.push(safeTrim(p.notes).length > 0);
    });

    // Experience: optional, but if the user starts adding entries, count them.
    activeExperience.forEach((x) => {
      checks.push(safeTrim(x.name).length > 0);
      checks.push(safeTrim(x.tech).length > 0);
      checks.push(safeTrim(x.notes).length > 0);
    });

    const done = checks.reduce((n, ok) => n + (ok ? 1 : 0), 0);
    const pct = Math.round((done / checks.length) * 100);
    return Math.max(0, Math.min(100, pct));
  }

  // ---------- Export ----------
  const exportBtn = $("#openExport");
  const copyAllBtn = $("#copyAll");
  const saveLocalBtn = $("#saveLocal");
  const printBtn = $("#printBtn");
  const resetAllBtn = $("#resetAll");
  jumpPreviewBtn?.addEventListener("click", () => {
    document.getElementById("preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  exportBtn?.addEventListener("click", () => {
    // Save latest state, then navigate to export designer
    save();
    window.location.href = "./export.html";
  });

  copyAllBtn?.addEventListener("click", async () => {
    const text = buildResumeText();
    try {
      await navigator.clipboard.writeText(text);
      exportNote.textContent = "Copied resume text.";
      setTimeout(() => (exportNote.textContent = ""), 1200);
    } catch {
      exportNote.textContent = "Copy failed. Try printing instead.";
      setTimeout(() => (exportNote.textContent = ""), 1600);
    }
  });

  saveLocalBtn?.addEventListener("click", save);
  printBtn?.addEventListener("click", () => window.print());

  resetAllBtn?.addEventListener("click", () => {
    state = defaults();
    localStorage.removeItem(STORAGE_KEY);
    hydrateFields();
    renderCards();
    bindCardInputs();
    updateAll();
    setActiveStep("basics");
    aiMsg.textContent = "Reset done. Start again with Basics.";
  });

  // AI buttons
  $("#aiSuggest")?.addEventListener("click", suggestImprovements);
  $("#aiKeywords")?.addEventListener("click", suggestKeywords);
  $("#aiBullets")?.addEventListener("click", rewriteAllBullets);

  // ---------- Utilities ----------
  function normalizeTags(...fields) {
    const out = [];
    fields
      .join(",")
      .split(/[,\n]/g)
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((t) => {
        const cleaned = t.replace(/\s+/g, " ");
        if (!out.some((x) => x.toLowerCase() === cleaned.toLowerCase())) out.push(cleaned);
      });
    return out;
  }

  function buildResumeText() {
    const lines = [];
    lines.push(state.fullName || "Your Name");
    lines.push([state.targetRole, state.location, state.email, state.linkedin, state.github].filter(Boolean).join(" • "));
    lines.push("");
    if (state.headline) lines.push(state.headline);
    if (state.summary) lines.push(state.summary);
    lines.push("");
    lines.push("EDUCATION");
    lines.push([state.university, state.degree, state.eduDates, state.cgpa ? `CGPA: ${state.cgpa}` : ""].filter(Boolean).join(" • "));
    if (state.coursework) lines.push(`Coursework: ${state.coursework}`);
    lines.push("");
    lines.push("SKILLS");
    const tags = normalizeTags(state.skillsTech, state.skillsTools);
    lines.push(tags.join(", "));
    lines.push("");
    lines.push("PROJECTS");
    state.projects.forEach((p) => {
      lines.push(`- ${p.name} (${[p.tech, p.metric].filter(Boolean).join(" • ")})`);
      bulletsFromNotes(p.notes, state.targetRole, p.metric, p.tech).forEach((b) => lines.push(`  • ${b}`));
    });
    if (state.experience.length) {
      lines.push("");
      lines.push("EXPERIENCE");
      state.experience.forEach((x) => {
        lines.push(`- ${x.name} (${[x.tech, x.metric].filter(Boolean).join(" • ")})`);
        bulletsFromNotes(x.notes, state.targetRole, x.metric, x.tech).forEach((b) => lines.push(`  • ${b}`));
      });

      if (state.custom && state.custom.length) {
        lines.push("");
        lines.push("ADDITIONAL");
        state.custom.forEach((c) => {
          lines.push(`- ${c.name} (${c.link})`);
          if (c.notes) lines.push(`  • ${c.notes}`);
        });
      }
    }
    return lines.join("\n");
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function lowerFirst(s) {
    return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  }
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

  // ---------- Boot ----------

  // Cleanup: remove empty projects that might be persisted from old logic
  if (Array.isArray(state.projects)) {
    state.projects = state.projects.filter(p => p.name || p.link || p.tech || p.metric || p.notes);
  }

  hydrateFields();
  renderCards();
  attachCardHandlers();
  bindCardInputs();
  setActiveStep("basics");
  updateAll();
  initRealTimeAi();

  function initRealTimeAi() {
    // Shared buzzwords list
    const buzzwords = [
      "hardworking", "team player", "fast learner", "self motivated", "go-getter",
      "detail oriented", "synergy", "dynamic", "passionate", "results-driven"
    ];

    // 1. Summary Coach
    const summaryEl = $("#summary");
    summaryEl?.addEventListener("input", () => {
      const txt = summaryEl.value.trim();
      if (!txt) {
        aiMsg.textContent = "Start typing... I'll check the length and keywords.";
        return;
      }
      if (txt.length < 50) {
        aiMsg.innerHTML = "Too short. Mention your <b>target role</b> and one key <b>achievement</b>.";
      } else if (txt.length > 300) {
        aiMsg.innerHTML = "Getting a bit long. Keep it under 3 lines for better readability.";
      } else {
        const hasRole = state.targetRole && txt.toLowerCase().includes(state.targetRole.toLowerCase().split(" ")[0]);
        aiMsg.innerHTML = hasRole
          ? "Great length! ✨ You're telling a clear story."
          : "Good length. Tip: Explicitly mention your <b>Target Role</b> in this summary.";
      }
    });

    // 2. Metrics & Buzzwords Watchdog (Delegated for dynamic cards)
    const checkNotes = (el) => {
      const txt = el.value;
      const lower = txt.toLowerCase();

      // Buzzword check
      const foundBuzz = buzzwords.find(b => lower.includes(b));
      if (foundBuzz) {
        aiMsg.innerHTML = `⚠️ <b>"${foundBuzz}"</b> is a buzzword. Prove it with actions instead (e.g., "Built X", "Led Y").`;
        return;
      }

      // Metric check (simple regex for %, ms, numbers)
      const hasMetric = /\d+%|\d+\s?(ms|s|min|hr)|[\d]+x/i.test(txt);
      if (hasMetric) {
        aiMsg.innerHTML = "🔥 <b>Excellent!</b> Quantifiable metrics (%, ms) make you stand out.";
      } else if (txt.length > 30) {
        aiMsg.innerHTML = "Tip: Can you add a number? (e.g., \"reduced latency by <b>20%</b>\" or \"handled <b>500+</b> requests\")";
      } else {
        aiMsg.textContent = "Describe what you built and the outcome.";
      }
    };

    // Attach to existing and future inputs via delegation or re-binding
    // Since we re-bind inputs on render, we can just hook into the 'input' event on the container
    // or rely on the fact that 'bindCardInputs' is called. 
    // Let's add a global listener for simplicity and robustness.
    document.body.addEventListener("input", (e) => {
      if (e.target.matches('textarea[data-k="notes"]')) {
        checkNotes(e.target);
      }
    });
  }

  function updateAll() {
    renderPreview();
    const pct = calcCompletion();
    completionChip.textContent = `${pct}% complete`;
  }
})();

