(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const STORAGE_KEY = "resumint_profile_v1";

  // Theme sync with profile/landing (read-only in export)
  const storedTheme = localStorage.getItem("theme");
  if (storedTheme === "light") document.documentElement.setAttribute("data-theme", "light");

  // Listen for theme updates from parent
  window.addEventListener("message", (e) => {
    if (e.data?.type === "theme") {
      const theme = e.data.theme;
      if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
      else document.documentElement.removeAttribute("data-theme");
    }
  });

  // Request initial theme from parent
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "requestTheme" }, "*");
  }

  function loadProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  const profile = loadProfile();
  const resumeGrid = $("#resumeGrid");
  const portfolioGrid = $("#portfolioGrid");
  const exportBtn = $("#exportPdf");
  const exportInfo = $("#exportInfo");
  const printRoot = $("#printRoot");

  if (!profile) {
    exportInfo.textContent = "No saved profile found. Go back and fill your profile first.";
  }

  const resumeDesigns = [
    { id: "resume-a", name: "Signal resume", meta: "Compact, signal-first layout" },
    { id: "resume-b", name: "Classic resume", meta: "Left-aligned, education-first" },
  ];

  const portfolioDesigns = [
    { id: "portfolio-a", name: "Project gallery", meta: "Cards with impact bullets" },
    { id: "portfolio-b", name: "Case-study list", meta: "One project per section" },
  ];

  function renderDesignCard(design, type) {
    const btn = document.createElement("button");
    btn.className = "designCard";
    btn.type = "button"; // Added type="button" for consistency with original
    btn.dataset.id = design.id; // Added dataset.id
    btn.dataset.kind = type; // Added dataset.kind

    // Create a mini preview based on the design ID
    let previewHtml = "";
    if (design.id === "resume-a") { // Changed to lowercase to match design IDs
      previewHtml = `
        <div class="miniResume miniResume--a">
          <div class="mini__header">
            <div class="mini__name"></div>
            <div class="mini__role"></div>
          </div>
          <div class="mini__body">
            <div class="mini__col">
              <div class="mini__block"></div>
              <div class="mini__block"></div>
            </div>
            <div class="mini__col mini__col--wide">
              <div class="mini__line"></div>
              <div class="mini__line"></div>
              <div class="mini__line mini__line--short"></div>
              <div class="mini__gap"></div>
              <div class="mini__line"></div>
              <div class="mini__line"></div>
            </div>
          </div>
        </div>`;
    } else if (design.id === "resume-b") { // Changed to lowercase to match design IDs
      previewHtml = `
        <div class="miniResume miniResume--b">
          <div class="mini__sidebar">
             <div class="mini__avatar"></div>
             <div class="mini__block mini__block--light"></div>
             <div class="mini__block mini__block--light"></div>
          </div>
          <div class="mini__main">
             <div class="mini__name mini__name--dark"></div>
             <div class="mini__line"></div>
             <div class="mini__line"></div>
             <div class="mini__gap"></div>
             <div class="mini__line"></div>
             <div class="mini__line"></div>
          </div>
        </div>`;
    } else if (design.id === "portfolio-a") {
      previewHtml = `
        <div class="miniPortfolio miniPortfolio--a">
           <div class="mini__card"></div>
           <div class="mini__card"></div>
           <div class="mini__card"></div>
           <div class="mini__card"></div>
        </div>`;
    } else if (design.id === "portfolio-b") {
      previewHtml = `
        <div class="miniPortfolio miniPortfolio--b">
           <div class="mini__list-item"></div>
           <div class="mini__list-item"></div>
           <div class="mini__list-item"></div>
        </div>`;
    } else {
      // Fallback for portfolios or others
      previewHtml = `<div class="designCard__preview" style="background:${design.color || '#ccc'}"></div>`; // Added fallback color
    }

    btn.innerHTML = `
      <div class="designCard__thumb">${previewHtml}</div>
      <div class="designCard__body">
        <div>
          <div class="designCard__title">${design.name}</div>
          <div class="designCard__meta">${design.meta}</div>
        </div>
        <div>
          <span class="designCard__tag">${type === "resume" ? "Resume" : "Portfolio"} · ${design.id.toUpperCase()}</span>
        </div>
      </div>
    `;
    return btn;
  }

  function renderChoices(list, gridEl, kind) {
    gridEl.innerHTML = "";
    list.forEach((design) => {
      const card = renderDesignCard(design, kind);
      gridEl.appendChild(card);
    });
  }

  renderChoices(resumeDesigns, resumeGrid, "resume");
  renderChoices(portfolioDesigns, portfolioGrid, "portfolio");

  let selectedResume = null;
  let selectedPortfolio = null;

  function updateExportState() {
    const hasAny = !!selectedResume || !!selectedPortfolio;
    exportBtn.disabled = !hasAny || !profile;
    if (!profile) {
      exportInfo.textContent = "No saved profile found. Go back and fill your profile first.";
    } else if (!hasAny) {
      exportInfo.textContent = "Select at least one design to enable export.";
    } else {
      exportInfo.textContent = "Ready. Click “Export as PDF” and use your browser’s print-to-PDF.";
    }
  }

  function handleSelect(card) {
    const kind = card.dataset.kind;
    const id = card.dataset.id;
    if (kind === "resume") {
      selectedResume = id;
      $$('[data-kind="resume"]', document).forEach((c) => c.classList.toggle("is-selected", c === card));
    } else {
      selectedPortfolio = id;
      $$('[data-kind="portfolio"]', document).forEach((c) => c.classList.toggle("is-selected", c === card));
    }
    updateExportState();
  }

  resumeGrid?.addEventListener("click", (e) => {
    const card = e.target.closest(".designCard");
    if (card) handleSelect(card);
  });
  portfolioGrid?.addEventListener("click", (e) => {
    const card = e.target.closest(".designCard");
    if (card) handleSelect(card);
  });

  function textOrFallback(val, fb) {
    return (val || "").trim() || fb;
  }

  function buildResumeNodeA() {
    const root = document.createElement("article");
    root.className = "resumeA";
    const fullName = textOrFallback(profile.fullName, "Your Name");
    const role = textOrFallback(profile.targetRole, "Target role");
    const metaParts = [
      role,
      textOrFallback(profile.location, ""),
      textOrFallback(profile.email, ""),
      textOrFallback(profile.linkedin, ""),
      textOrFallback(profile.github, ""),
    ].filter(Boolean);
    const edu = [
      textOrFallback(profile.university, ""),
      textOrFallback(profile.degree, ""),
      textOrFallback(profile.eduDates, ""),
      profile.cgpa ? `CGPA: ${profile.cgpa}` : "",
    ]
      .filter(Boolean)
      .join(" • ");

    const skills = (profile.skillsTech || "")
      .split(/[,\n]/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);

    root.innerHTML = `
      <header class="resumeA__head">
        <h1>${fullName}</h1>
        <div class="resumeA__meta">${metaParts.join(" • ")}</div>
      </header>
      <section>
        <h2>Summary</h2>
        <p>${textOrFallback(
      profile.summary,
      "Write a short summary about your skills, projects, and the kind of roles you want."
    )}</p>
      </section>
      <section>
        <h2>Education</h2>
        <p>${edu || "University • Degree • Dates"}</p>
      </section>
      <section>
        <h2>Skills</h2>
        <ul class="tagList">
          ${skills.length
        ? skills.map((t) => `<li>${t}</li>`).join("")
        : "<li>Add skills in the profile builder to populate this area.</li>"
      }
        </ul>
      </section>
    `;
    return root;
  }

  function buildResumeNodeB() {
    const root = document.createElement("article");
    root.className = "resumeB";
    root.innerHTML = `
      <h1>${textOrFallback(profile.fullName, "Your Name")}</h1>
      <h2>Projects</h2>
      <ul>
        ${(profile.projects || [])
        .slice(0, 3)
        .map(
          (p) =>
            `<li><strong>${textOrFallback(
              p.name,
              "Untitled project"
            )}</strong> — ${textOrFallback(p.notes, "Describe what you built and what impact it had.")}</li>`
        )
        .join("") || "<li>Add at least one project in the profile builder.</li>"
      }
      </ul>
    `;
    return root;
  }

  function buildPortfolioNodeA() {
    const root = document.createElement("section");
    root.className = "portfolioA";
    root.innerHTML = `
      <h1>Projects</h1>
      <div class="cardGrid">
        ${(profile.projects || [])
        .map(
          (p) => `
          <article class="projCard">
            <h2>${textOrFallback(p.name, "Untitled project")}</h2>
            <p class="projCard__meta">${textOrFallback(p.tech, "")}</p>
            <p>${textOrFallback(p.notes, "Describe what you built, how, and why it mattered.")}</p>
          </article>
        `
        )
        .join("")}
      </div>
    `;
    return root;
  }

  function buildPortfolioNodeB() {
    const root = document.createElement("section");
    root.className = "portfolioB";
    root.innerHTML = `
      <h1>Portfolio</h1>
      ${(profile.projects || [])
        .map(
          (p) => `
        <article class="case">
          <h2>${textOrFallback(p.name, "Case study")}</h2>
          <p><strong>Stack:</strong> ${textOrFallback(p.tech, "Add tech stack")}</p>
          <p>${textOrFallback(p.notes, "Explain the problem, your approach, and the outcome.")}</p>
        </article>
      `
        )
        .join("")}
    `;
    return root;
  }

  exportBtn?.addEventListener("click", () => {
    if (!profile) return;
    printRoot.innerHTML = "";
    if (selectedResume === "resume-a") printRoot.appendChild(buildResumeNodeA());
    if (selectedResume === "resume-b") printRoot.appendChild(buildResumeNodeB());
    if (selectedPortfolio === "portfolio-a") printRoot.appendChild(buildPortfolioNodeA());
    if (selectedPortfolio === "portfolio-b") printRoot.appendChild(buildPortfolioNodeB());
    window.print();
  });

  updateExportState();
})();

