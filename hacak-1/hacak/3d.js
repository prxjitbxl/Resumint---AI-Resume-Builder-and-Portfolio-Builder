(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  // 3D intro removed

  // ---------- Theme ----------
  const themeBtn = $("#themeBtn");
  // Force light mode on load as requested
  localStorage.setItem("theme", "light");
  document.documentElement.setAttribute("data-theme", "light");

  const syncThemePressed = () => {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    themeBtn?.setAttribute("aria-pressed", String(isLight));

    // Broadcast to ALL iframes (ATS, Profile, etc.)
    const iframes = document.querySelectorAll("iframe");
    iframes.forEach(iframe => {
      iframe.contentWindow?.postMessage({ type: "theme", theme: isLight ? "light" : "dark" }, "*");
    });
  };
  syncThemePressed();

  themeBtn?.addEventListener("click", () => {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    if (isLight) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("theme", "light");
    }
    syncThemePressed();
  });

  // Listen for theme requests from child iframes (e.g., on reload/back nav)
  window.addEventListener("message", (e) => {
    if (e.data?.type === "requestTheme") {
      syncThemePressed(); // This broadcasts the current theme
    }
  });

  // ---------- Sticky header elevate ----------
  const topbar = document.querySelector("[data-elevate]");
  const onScroll = () => {
    const elevated = window.scrollY > 8;
    topbar?.setAttribute("data-elevated", elevated ? "true" : "false");
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // ---------- Hero moving dots (canvas sparks) ----------
  const sparks = $("#sparks");
  const ctx = sparks?.getContext?.("2d");
  let particles = [];
  let raf = 0;
  let mouse = { x: 0, y: 0, active: false };

  const getTheme = () => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  const colorsForTheme = (theme) => {
    // Subtle, matches landing palette
    return theme === "light"
      ? ["rgba(7,16,42,.45)", "rgba(46,242,197,.40)", "rgba(139,92,255,.35)", "rgba(51,185,255,.35)"]
      : ["rgba(233,236,255,.12)", "rgba(46,242,197,.12)", "rgba(139,92,255,.10)", "rgba(51,185,255,.10)"];
  };

  function resizeSparks() {
    if (!sparks || !ctx) return;
    const rect = sparks.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    sparks.width = Math.floor(rect.width * dpr);
    sparks.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const area = rect.width * rect.height;
    // Make it clearly visible: more particles than a subtle “dust” layer.
    const count = Math.max(50, Math.min(140, Math.round(area / 15000)));
    const theme = getTheme();
    const palette = colorsForTheme(theme);

    // Rebuild particles for crisp look after resize/theme
    particles = Array.from({ length: count }).map(() => ({
      x: Math.random() * rect.width,
      y: Math.random() * rect.height,
      z: Math.random(), // pseudo-depth 0..1
      r: 1.2 + Math.random() * 3.2,
      // Base drift (faster than before so it's clearly "moving")
      vx: (-0.35 + Math.random() * 0.70),
      vy: (-0.30 + Math.random() * 0.60),
      a: 0.45 + Math.random() * 0.55,
      c: palette[Math.floor(Math.random() * palette.length)],
      tw: Math.random() * Math.PI * 2,
      tws: 0.004 + Math.random() * 0.012,
    }));
  }

  function tickSparks() {
    if (!sparks || !ctx) return;
    const w = sparks.clientWidth;
    const h = sparks.clientHeight;
    ctx.clearRect(0, 0, w, h);

    // faint vignette so dots feel “3D”
    const grd = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, Math.max(w, h) * 0.7);
    grd.addColorStop(0, getTheme() === "light" ? "rgba(255,255,255,.00)" : "rgba(0,0,0,.00)");
    grd.addColorStop(1, getTheme() === "light" ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.28)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    const mx = mouse.active ? mouse.x : w * 0.5;
    const my = mouse.active ? mouse.y : h * 0.45;
    const parX = (mx - w * 0.5) / w;
    const parY = (my - h * 0.5) / h;

    // Draw connection lines first (gives that “3D mesh” feel)
    const linkDist = Math.max(110, Math.min(190, Math.min(w, h) * 0.22));
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d > linkDist) continue;
        const p = 1 - d / linkDist;
        ctx.globalAlpha = 0.18 * p * (0.8 + 0.7 * Math.min(a.z, b.z));
        ctx.strokeStyle = getTheme() === "light" ? "rgba(7,16,42,.45)" : "rgba(233,236,255,.26)";
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    for (const p of particles) {
      // Parallax makes it feel like “3D objects” moving with cursor
      const depth = 0.35 + p.z * 0.85;
      p.x += p.vx * depth;
      p.y += p.vy * depth;
      p.tw += p.tws;

      // wrap around edges
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;

      const pulse = 0.65 + 0.35 * Math.sin(p.tw);
      const px = p.x + parX * (18 * depth);
      const py = p.y + parY * (14 * depth);

      // Outer glow
      ctx.beginPath();
      ctx.fillStyle = p.c;
      ctx.globalAlpha = (p.a * 0.75) * pulse;
      ctx.arc(px, py, (p.r * 2.6) * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.fillStyle = p.c;
      ctx.globalAlpha = (p.a * 1.05) * pulse;
      ctx.arc(px, py, (p.r * 0.95) * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    raf = requestAnimationFrame(tickSparks);
  }

  function startSparks() {
    if (prefersReduced) return;
    if (!sparks || !ctx) return;
    cancelAnimationFrame(raf);
    resizeSparks();
    raf = requestAnimationFrame(tickSparks);
  }

  // Boot sparks after paint
  requestAnimationFrame(() => startSparks());
  window.addEventListener("resize", () => resizeSparks(), { passive: true });
  // Mouse parallax
  sparks?.addEventListener(
    "pointermove",
    (e) => {
      const rect = sparks.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    },
    { passive: true }
  );
  sparks?.addEventListener("pointerleave", () => (mouse.active = false), { passive: true });
  themeBtn?.addEventListener("click", () => {
    // theme toggles on this page; refresh palette
    resizeSparks();
  });

  // ---------- Counters ----------
  const animateCounter = (el, target, duration = 900) => {
    if (prefersReduced) {
      el.textContent = String(target);
      return;
    }
    const start = performance.now();
    const from = 0;
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(from + (target - from) * eased);
      el.textContent = String(val);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const counters = $$("[data-counter]");
  const counterObserver = "IntersectionObserver" in window
    ? new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target;
          const target = Number(el.getAttribute("data-counter") || "0");
          animateCounter(el, target);
          counterObserver.unobserve(el);
        });
      },
      { threshold: 0.5 }
    )
    : null;

  counters.forEach((el) => counterObserver?.observe(el));
  if (!counterObserver) counters.forEach((el) => animateCounter(el, Number(el.getAttribute("data-counter") || "0")));

  // ---------- Pitch dialog ----------
  const pitchDialog = $("#pitchDialog");
  const openPitch = $("#openPitch");
  const closePitch = $("#closePitch");
  const closePitch2 = $("#closePitch2");
  const copyPitch = $("#copyPitch");

  const openDialog = () => {
    if (!pitchDialog) return;
    if (typeof pitchDialog.showModal === "function") pitchDialog.showModal();
  };
  const closeDialog = () => {
    if (!pitchDialog) return;
    if (typeof pitchDialog.close === "function") pitchDialog.close();
  };

  openPitch?.addEventListener("click", openDialog);
  closePitch?.addEventListener("click", closeDialog);
  closePitch2?.addEventListener("click", closeDialog);
  pitchDialog?.addEventListener("click", (e) => {
    // click outside closes
    const rect = pitchDialog.getBoundingClientRect();
    const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside) closeDialog();
  });
  copyPitch?.addEventListener("click", async () => {
    const text =
      "ResuMint AI is a resume + portfolio builder that’s signal-first. Instead of only formatting text, it maps your projects and experience to hiring signals like impact, ownership, and tech depth—then rewrites bullets with measurable outcomes, keeps everything ATS-friendly, and generates a matching portfolio page from the same source profile.";
    try {
      await navigator.clipboard.writeText(text);
      copyPitch.textContent = "Copied";
      setTimeout(() => (copyPitch.textContent = "Copy pitch"), 1100);
    } catch {
      copyPitch.textContent = "Copy failed";
      setTimeout(() => (copyPitch.textContent = "Copy pitch"), 1100);
    }
  });

  // ---------- Demo: “AI-like” bullets ----------
  const roleSelect = $("#roleSelect");
  const notesEl = $("#notes");
  const metricEl = $("#metric");
  const techEl = $("#tech");
  const generateBtn = $("#generate");
  const shuffleBtn = $("#shuffle");
  const bulletsEl = $("#bullets");
  const copyBulletsBtn = $("#copyBullets");
  const resetDemoBtn = $("#resetDemo");
  const clarityBar = $("#clarityBar");
  const impactBar = $("#impactBar");
  const clarityVal = $("#clarityVal");
  const impactVal = $("#impactVal");

  const examples = [
    {
      role: "AI/ML Engineer",
      notes:
        "Built an AI-assisted resume + portfolio builder. Added ATS checks, a keyword optimizer, and a rewrite engine that converts tasks into quantified impact bullets. Implemented guardrails to reduce buzzwords.",
      metric: "+22% completion rate",
      tech: "NLP, React, Node.js, Firebase",
    },
    {
      role: "Full-Stack Developer",
      notes:
        "Built a job-matching platform with a recruiter dashboard and candidate profiles. Implemented search + filters and optimized database queries. Deployed CI/CD for fast iteration.",
      metric: "reduced page load 38%",
      tech: "React, Express, PostgreSQL, Docker",
    },
    {
      role: "Data Scientist",
      notes:
        "Created a resume parser that extracts skills and projects, then recommends role-specific keywords. Evaluated extraction quality and tracked precision/recall improvements over baseline rules.",
      metric: "+14% F1 score",
      tech: "Python, spaCy, pandas, evaluation",
    },
  ];

  const verbsByRole = {
    "Full-Stack Developer": ["Built", "Shipped", "Designed", "Implemented", "Optimized", "Integrated"],
    "Frontend Developer": ["Crafted", "Designed", "Implemented", "Optimized", "Improved", "Delivered"],
    "Data Scientist": ["Developed", "Analyzed", "Modeled", "Evaluated", "Validated", "Improved"],
    "AI/ML Engineer": ["Built", "Trained", "Deployed", "Optimized", "Evaluated", "Hardened"],
    "Product Intern": ["Defined", "Led", "Shipped", "Tested", "Measured", "Improved"],
  };

  const roleSignals = {
    "Full-Stack Developer": ["APIs", "performance", "database", "deployment", "reliability"],
    "Frontend Developer": ["UX", "performance", "accessibility", "state", "design systems"],
    "Data Scientist": ["evaluation", "metrics", "features", "baseline", "insights"],
    "AI/ML Engineer": ["guardrails", "latency", "retrieval", "evaluation", "deployment"],
    "Product Intern": ["experiments", "funnels", "stakeholders", "roadmap", "outcomes"],
  };

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const extractTech = (s) => {
    const raw = (s || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (raw.length) return raw.slice(0, 4);
    // weak fallback from notes
    const m = (notesEl?.value || "").match(/\b(react|node|express|python|tensorflow|pytorch|firebase|postgres|mysql|mongodb|docker|kubernetes|spacy|nlp)\b/gi);
    return (m ? Array.from(new Set(m.map((x) => x[0].toUpperCase() + x.slice(1).toLowerCase()))) : []).slice(0, 4);
  };

  const scoreFromText = (notes, metric, tech) => {
    const t = (notes || "").trim();
    const hasMetric = /\d/.test(metric || "");
    const lengthScore = clamp(Math.round((t.length / 220) * 100), 20, 92);
    const techScore = clamp((tech.length ? 70 + tech.length * 6 : 44), 30, 92);
    const clarity = clamp(Math.round(0.55 * lengthScore + 0.45 * techScore), 28, 95);
    const impact = clamp(Math.round(0.55 * (hasMetric ? 92 : 56) + 0.45 * lengthScore), 24, 98);
    return { clarity, impact };
  };

  const buildBullets = ({ role, notes, metric, techs }) => {
    const verb = pick(verbsByRole[role] || verbsByRole["Full-Stack Developer"]);
    const signals = roleSignals[role] || roleSignals["Full-Stack Developer"];

    const headline = (notes || "").split(/[.!?\n]/).map((x) => x.trim()).filter(Boolean)[0] || "Built a product feature end-to-end";
    const metricPhrase = (metric || "").trim() ? `, achieving ${metric.trim()}` : "";
    const techPhrase = techs.length ? ` using ${techs.join(", ")}` : "";

    const bullets = [
      `${verb} ${headline.toLowerCase()}${techPhrase}${metricPhrase}.`,
      `${pick(["Improved", "Optimized", "Hardened", "Streamlined"])} ${pick(signals)} by adding structure, checks, and iterative refinement loops (human + ATS readable).`,
      `${pick(["Designed", "Implemented", "Deployed", "Validated"])} a signal-based scoring pass (clarity + impact) to detect weak claims and suggest measurable rewrites.`,
      `${pick(["Reduced", "Increased", "Accelerated", "Enhanced"])} output quality with guardrails: removed buzzwords, enforced action→impact phrasing, and aligned keywords to the target role.`,
    ];

    // Make it feel less templated: inject note keywords
    const keywords = Array.from(
      new Set(
        (notes || "")
          .toLowerCase()
          .match(/\b(ats|keyword|portfolio|resume|parser|nlp|dashboard|search|latency|evaluation|f1|accessibility|ci\/cd|deployment)\b/g) || []
      )
    ).slice(0, 3);
    if (keywords.length) bullets[1] = `${pick(["Improved", "Optimized", "Hardened", "Streamlined"])} ${keywords.join(", ")} by mapping content to hiring signals (${signals.slice(0, 3).join(", ")}).`;

    return bullets;
  };

  const setScores = (clarity, impact) => {
    if (!clarityBar || !impactBar || !clarityVal || !impactVal) return;
    clarityBar.style.width = `${clarity}%`;
    impactBar.style.width = `${impact}%`;
    clarityVal.textContent = `${clarity}%`;
    impactVal.textContent = `${impact}%`;
  };

  const renderBullets = (bullets) => {
    if (!bulletsEl) return;
    bulletsEl.innerHTML = "";
    bullets.forEach((b) => {
      const li = document.createElement("li");
      li.textContent = b;
      bulletsEl.appendChild(li);
    });
  };

  const generate = () => {
    const role = roleSelect?.value || "Full-Stack Developer";
    const notes = (notesEl?.value || "").trim();
    const metric = (metricEl?.value || "").trim();
    const techs = extractTech(techEl?.value || "");

    if (!notes) {
      renderBullets(["Add a couple lines of notes (project/experience) to generate bullets."]);
      setScores(0, 0);
      return;
    }

    const bullets = buildBullets({ role, notes, metric, techs });
    renderBullets(bullets);
    const { clarity, impact } = scoreFromText(notes, metric, techs);
    setScores(clarity, impact);
  };

  generateBtn?.addEventListener("click", generate);
  notesEl?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") generate();
  });

  shuffleBtn?.addEventListener("click", () => {
    const ex = pick(examples);
    if (roleSelect) roleSelect.value = ex.role;
    if (notesEl) notesEl.value = ex.notes;
    if (metricEl) metricEl.value = ex.metric;
    if (techEl) techEl.value = ex.tech;
    generate();
  });

  resetDemoBtn?.addEventListener("click", () => {
    if (notesEl) notesEl.value = "";
    if (metricEl) metricEl.value = "";
    if (techEl) techEl.value = "";
    renderBullets(["Click “Generate” to produce role-aligned bullet points."]);
    setScores(0, 0);
  });

  copyBulletsBtn?.addEventListener("click", async () => {
    const bullets = $$("#bullets li").map((li) => li.textContent || "").filter(Boolean);
    const text = bullets.map((b) => `• ${b}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      copyBulletsBtn.textContent = "Copied";
      setTimeout(() => (copyBulletsBtn.textContent = "Copy"), 1100);
    } catch {
      copyBulletsBtn.textContent = "Copy failed";
      setTimeout(() => (copyBulletsBtn.textContent = "Copy"), 1100);
    }
  });

  // Spark canvas animation removed
  // Listen for scan trigger from iframe
  window.addEventListener("message", (e) => {
    if (e.data === "startScan") {
      const scanner = $(".hero__scanner");
      if (scanner) {
        scanner.classList.add("scanning");
        // Remove class after animation (optional, but good for re-triggering if needed, though here it's infinite while analyzing)
        // For now, let's keep it running for a few seconds or until stopped.
        // Let's stop it after 6 seconds (2 cycles)
        setTimeout(() => scanner.classList.remove("scanning"), 6000);
      }
    }
  });

})();

