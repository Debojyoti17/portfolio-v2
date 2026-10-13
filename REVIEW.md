# REVIEW.md

Build report for the portfolio. Read this first; details of the design are in [DESIGN.md](DESIGN.md) and
day-to-day instructions are in [README.md](README.md).

---

## Review round 1 — feedback from a real Android phone (this update)

**What was wrong:** the particle visuals looked good in stills but felt poorly executed in use — touch was
broken or jerky, labels were confusing, and the visuals were inconsistent between projects. The approach
changed from "many decorative effects" to "few, properly interactive ones".

### 1. Touch interaction (rebuilt)
* New CPU spring-physics engine (`src/scripts/stage/stage.ts`): particles spring back to their home
  position with a little overshoot; a finger or cursor parts them smoothly (eased pointer, smooth falloff,
  faint swirl); a tap/click sends a ripple outward; multi-touch (2 fingers).
* **Does not block scrolling:** fingers are read through *passive* touch listeners (touchmove keeps firing
  while the page scrolls), stages declare `touch-action: pan-y`, and `overscroll-behavior-x: none` stops a
  sideways drag from triggering browser history swipe (this was a real bug found while testing: in touch
  emulation a horizontal drag navigated away from the page).
* **Measured** (`node scripts/perf-touch.mjs`: Playwright + Chromium, Pixel 5 emulation,
  4× CPU throttle): while dragging across the hero and across cards there were **0 long tasks** and **0 frames
  over 33 ms**; the engine costs ≈ 3.5 ms (hero) to 5 ms (card) of JS per frame, p95 ≈ 6–8 ms, against a 16.7 ms
  budget. A vertical drag that starts on a field scrolls the page normally (+285 px / +192 px in the test).
  One honest caveat: in the one run that scrolls the hero *for the first time*, 7 of 134 frames took 33–67 ms
  (a one-off compositor hitch under software GL); repeat scrolls were clean. I could not test on a real GPU.
* Budget: hero 5,500 particles on phones (12,000 desktop), cards 3,400 (5,200), project page 4,500 (8,500);
  DPR ≤ 1.5 on phones; at most 4 WebGL contexts (a renderer pool lends canvases; found and fixed a
  context-exhaustion error while testing the Work page); half frame rate when idle; paused off-screen.

### 2. Hero
* Tagline paragraph removed. The hero keeps one status line ("Third-year B.Tech CSE · VIT Vellore") and
  the two buttons. The label above the name is now just "Portfolio" (no wrapping). The "Form 01 / particle
  count" readout is gone.
* The field is **contained in the hero**; there are no particles behind any other section.

### 3. Project visuals (one meaningful, interactive form per project, same on card and page)
| Project | Visual | Interaction |
| --- | --- | --- |
| LeafScope | whole leaf (surface, midrib, veins, outline, stem) | parts around the finger |
| Ghosts in the Splat | vase-like object made of soft splats | touching dissolves it, leaving a faint ghost residue that heals |
| MAST framework extension | small agent graph | touching an agent lights it; a pulse travels along its edges (and one hop further) |
| Fault-tolerant feedback | agent network, one node failed (red) | messages try the failed node, bounce and reroute; tap a node to fail it instead (also rotates by itself) |
| Agentic Shell | directory tree with links | broken links dangle in red; touching one reconnects it (it slowly breaks again) |

Verified in a browser with ad-hoc pixel-level checks: ghost region dissolves and then heals; graph node goes
red on hover; the failed node moves when another is tapped; dangling red links reduce when touched.
* Captions: project pages show the project name on the left and a device-aware hint on the right
  ("Drag across the field" on touch, "Move the cursor across the field" with a mouse) — identical layout
  for all five. Cards carry only the hint. "4,500 particles", "Form — …" and similar filler are gone.
* Work-page cards are interactive **in place**; only the title (and "View project") is the link, so touching
  the visual never navigates.

### 4. Work page
* Filter bars removed. Projects are grouped under the three research areas with headings; each project
  appears once, under its main area (LeafScope → Self-supervised learning; Ghosts → Computer vision; MAST,
  fault-tolerant feedback and Agentic Shell → Reliable multi-agent AI). Areas come from `interests` in
  `site.config.ts` and a project's `area:` field. The filter code survives as an optional module:
  `features.workFilters` (off by default; tested with it on).
* "Status" is split into **type** (Research project / Team project / Course project) and **stage**
  (In progress / Early stage / Completed), shown as one line: "Research project · In progress". Stage is
  optional: you did not tell me the stage of the two team projects, so they show only "Team project".
* Tags: at most 2 per project, from a controlled list in `src/content.config.ts`, shown as quiet text.

### 5. Content corrections
* MAST framework extension is now "Research project · In progress". arXiv is not mentioned anywhere
  (also removed from templates, the social-link list and the docs).
* About: education reads "2024 – 2028 (expected)" on one line.

### 6. "What I work on"
Replaced the pinned scroll list with three columns (stacked on phones): area name, one sentence, and the
names of its projects as links. No particles behind it.

### 7. About
The "DBM" index card is gone. Without a photo the section is text and education only; with
`public/images/profile.jpg` the portrait appears beside it. The bio is body-sized text.

### 8. Contact and footer
Repeated tagline removed from the footer; contact stays a heading, the email with a copy button, and GitHub.
The fixed "SCROLL 000" bar is removed. The footer mark's red "+" is now a small red square like the header's.

### Checks after this round
* Lighthouse (mobile preset, Chromium with software WebGL): Home, Work, three project pages and About all
  **99 / 100 / 100 / 100** (performance / accessibility / best practices / SEO); LCP ≈ 1.9–2.0 s, TBT 0 ms,
  CLS ≤ 0.001.
* `astro check` 0 errors; link checker 0 broken links; browser smoke tests (`scripts/interact.mjs`, 25 checks
  across desktop, touch phone, reduced motion and no-WebGL) all pass.
* Screenshots reviewed at 390 px (light and dark), 768 px earlier in the build, and 1440 px for Home, Work,
  project pages (Ghosts, MAST, Fault-tolerant, Agentic Shell) and About. Fixes from review: ghost idle sweep
  was erasing too much (smaller, slower, heals faster); leaf/graph had too little structure at card size
  (denser veins, smaller nodes); card and project visuals were clipping at the edges (scaled to leave room
  for the caption); footer square was too large; the status column on home wrapped (wider column).

### Could not do / limitations of this round
* **No real device.** The numbers above come from Chromium touch emulation with a 4× CPU throttle and a
  software GPU. Please try the preview on the phone again: pay attention to the first touch (the live
  field is loaded on first touch/scroll on phones so first load stays light, so the very first drag after
  opening a page can arrive a moment before the particles respond).
* Full-page screenshots of the Work page show some cards mid-assembly (they were all scrolled into view at
  once); in real use each card assembles as it comes on screen.
* The network visual moves its failed node by itself every ~8 s unless you have tapped; if you would
  rather it stay fixed until tapped, that is one line in `behaviours.ts`.

---

## Original build report (previous round)

## Step 0: repository review

* The repository contained one commit with a one-line `README.md` (`# portfolio-v2`) and nothing else.
  Two branches existed (`main` and the pre-created `claude/elegant-dijkstra-1rl4gp`, identical).
* **Unexpected:** the sandbox this was built in could not reach apple.com, nothing.tech, product.inc,
  streamlinehq.com, api.github.com or github.com profile pages (the egress proxy returned 403). So the
  reference sites were **not** screenshotted; the lessons in DESIGN.md are principles I already knew, not a
  pixel study. The GitHub contribution graph fetch could not be tested live; its parser is tested
  against a fixture of GitHub's markup instead (and the section hides itself if the fetch fails).
* I pinned Astro 5.18 and TypeScript 5.9 although Astro 7 / TypeScript 7 are published, to avoid
  surprises in an unattended build.
* Pushes went to both `main` (as you asked) and the pre-assigned branch `claude/elegant-dijkstra-1rl4gp`.

## What was built

* **Stack:** Astro 5 static site, content collections, TypeScript, plain CSS with design tokens, View
  Transitions (`ClientRouter`), Three.js (lazy), GSAP + ScrollTrigger and Lenis (lazy), self-hosted fonts.
* **Pages:** Home, Work (filter by topic and status, deep-linkable `?tag=` / `?status=`), 5 project
  pages, About, 404, plus `/notes/` that only exists once notes are enabled and at least one post exists.
* **Homepage sections** (order set in `site.config.ts`): hero, "What I work on" (three research areas; was a pinned scroll list before round 1),
  selected work, about, skills, then the optional timeline / publications / notes / GitHub graph, and contact.
* **3D signature:** "Reconstruction" — a Gaussian-splat-style point cloud that starts as noise and
  converges into form. (Superseded by review round 1 above: it now lives in the hero, on project cards
  and on project pages only, with per-project interactive scenes.)
* **Modularity:** one `site.config.ts`; add a section = one component + one config string; Markdown
  collections with copy-able `_example.md` templates; all optional modules behind flags and hidden when
  empty; optional fields, social links, CV button (`public/cv.pdf`) and photo (`public/images/profile.jpg`)
  appear only when present.
* **Delivery:** GitHub Actions workflow (type-check → build → link check → deploy). `SITE_URL`,
  `BASE_PATH`, `NOINDEX` are environment-driven; preview carries `noindex` + a disallowing `robots.txt`.
  Generated Open Graph images per page; `robots.txt`; sitemap on the indexable (root) build.
* **Tooling:** `npm run links` (internal link / anchor checker), `npm run contrast` (token contrast),
  `scripts/screenshots.mjs`, `scripts/lighthouse.mjs`, `scripts/interact.mjs` (browser smoke tests).

## Key design decisions

1. Nothing is invented. Project pages restate only what you supplied; no numbers, dates or results.
   "Role" is not shown because you did not give one.
2. Red is a signal, not decoration: status squares, active states, ~3 % of particles, the focus ring.
3. Sharp geometry everywhere (radius 0), hairlines, registration marks, Doto for numerals/status.
4. One-idea-per-screen scroll storytelling instead of everything fading up; reveals are masks, rule-draws and
   wipes; the focus section is scroll-scrubbed.
5. On phones the live 3D field starts on first touch/scroll (or after 9 s) while an identical server-rendered
   SVG is already on screen — keeps first load light and Lighthouse clean. Desktop starts it when idle.
6. No photo? The About "plate" is a deliberate typographic index card; with the photo it becomes a
   black-and-white portrait (colour on hover). Both are first-class.
7. All internal URLs go through `href()`, so moving to `https://debojyoti17.github.io/` with base `/` is a
   variable change only (verified by building with `BASE_PATH=/`: links resolve, sitemap appears, `noindex`
   disappears).

## Verification

**Lighthouse (mobile preset, local build with `NOINDEX=false`; Chromium with software WebGL):**

| Page | Performance | Accessibility | Best Practices | SEO |
| --- | --- | --- | --- | --- |
| Home | 99 | 100 | 100 | 100 |
| Work | 99 | 100 | 100 | 100 |
| Project (LeafScope) | 99 | 100 | 100 | 100 |
| Project (Agentic Shell) | 99 | 100 | 100 | 100 |
| About | 99 | 100 | 100 | 100 |

LCP ≈ 1.9 s, TBT 0 ms, CLS 0 on the simulated slow-4G / 4× CPU profile. The 404 page is not scored (it
returns HTTP 404 by design). With the preview's `noindex` active the SEO "crawlable" audit would fail by
design; that is expected on the preview URL and disappears on the root deployment.

**Other checks that pass:** `astro check` 0 errors; link checker 0 broken internal links (both bases);
contrast tokens ≥ AA in both themes (lowest: 4.82 : 1 for red text on the panel colour in light); no
horizontal scroll at 360, 390, 768, 1440 and 2560 px on every page; browser smoke test (theme toggle,
Lenis, hover morph + release, view-transition navigation with stage dispose/re-mount, filters + URL state,
mobile menu + Escape, first Tab → skip link, reduced motion → static fallback with nothing hidden, WebGL
unavailable → static SVG stays). Optional modules were verified by temporarily switching every flag on
with sample content, a CV file and a photo, then removing them again.

**Visual review rounds:** screenshots at 390 / 768 / 1440 in light and dark were reviewed across the build.
Fixes that came out of it: the focus section competed with its own heading and particles hurt legibility
(compact header, dimmer field, per-section opacity); section numbers disagreed with the scroll readout; the
HUD overlapped content (now a solid bar); the skills sheet collapsed into a column (grid placement bug);
the grid form read as a diagonal stripe (re-oriented); inner-page section gaps were too large; filter chips
took too much height on phones (now a horizontal scroller); the static fallback was too chunky on 2560 px
screens (capped).

## Known limitations

* **Real-GPU performance was not measured.** The sandbox only has software rendering, so frame rates
  could not be profiled. The budget is deliberately conservative (16 k / 6.5 k points, DPR ≤ 1.75 / 1.25,
  pauses when hidden or off-screen, half-rate when idle) but please check on your own phone and laptop.
* The reference sites were not viewed (see Step 0).
* The GitHub graph and Pages deployment URL could not be fetched from the sandbox. The GitHub
  Actions run for the latest push to `main` completed (build and deploy jobs succeeded), but I could not
  open the live URL to confirm it renders.
* Project pages are short on purpose (only supplied facts). They will look richer once you add
  links, a role, cover images or a longer write-up.
* `valid-source-maps` is the only Lighthouse note on the home page; it is informational.
* The Instrument Sans font is the variable weight-only subset (no width axis); fine for this design.
* GitHub's runner warns that `actions/checkout@v4` and `setup-node@v4` run on Node 20 (deprecated
  upstream); harmless today, bump the action versions when v5 is available.

## What I need from you

1. **Photo:** add `public/images/profile.jpg` (portrait ≈ 4:5, ≥ 880 × 1100 px). The site upgrades
   automatically.
2. **CV:** add `public/cv.pdf` if you want the "Download CV" buttons.
3. **Project images** (optional): put files in `src/assets/projects/` and add `cover:` / `coverAlt:` to the
   project's front matter.
4. **Links:** GitHub / paper / demo URLs per project (`links:` in each project file); LinkedIn, Google
   Scholar, ORCID, etc. in `site.config.ts → social`. Only filled ones appear.
5. **Roles and facts** per project if you want them shown (`role`, `facts`).
6. **GitHub setting:** Settings → Pages → Build and deployment → Source must be **GitHub Actions**. The
   workflow ran and its deploy job succeeded, which suggests this is already set; if the site 404s, set it
   and re-run the workflow.
7. **When moving to `https://debojyoti17.github.io/`:** set repository variable `BASE_PATH` to `/` (Settings →
   Secrets and variables → Actions → Variables). `noindex` turns off automatically. Then submit the
   sitemap in Search Console if you wish.
8. Review the copy once: it is intentionally minimal and uses only your wording.
