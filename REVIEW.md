# REVIEW.md

Build report for the portfolio. Read this first; details of the design are in [DESIGN.md](DESIGN.md) and
day-to-day instructions are in [README.md](README.md).

---

## Review round 2: one coherent experience (this update)

**Theme:** the site should feel like one intentional interactive experience, not a collection of separate
ideas. The guiding rule was to remove more than to add.

### What was removed
* **Static red:** the red square in the header and footer marks, the status dots and the red index numbers
  are all gone. Red now appears only inside the interaction: the field's accent particles, the failed
  node and broken links the field is about, and the keyboard focus ring. On the Work-page stills, red is
  kept only where it means something (network and tree).
* **Numbering:** section indices (01, 02 …), menu numbers and the numbered timeline dates are gone. The
  "Portfolio" label above the name is gone too.
* **Other leftovers:**
  * the background column guides;
  * the "What I work on" section, merged into the project list below;
  * the separate Contact section, now in the footer;
  * the copy-email button;
  * the duplicate GitHub link in the footer.
* **Motion without a job:**
  * line-mask title reveals and word splitting;
  * rule-draw and clip-path wipes;
  * row hover fills, title shifts, button fills and image zooms;
  * GSAP and ScrollTrigger, which are no longer a dependency.

### 1. Research & projects (one section)
Each research area is a heading with its one sentence, and its projects sit directly underneath. Every
project shows:
* its type · stage line;
* its title, which links to the project page;
* its summary;
* Code / Paper / Demo links, when they are set.

Each project appears once. `/work/` uses the same structure (`src/components/ResearchIndex.astro`) and adds
a still of each project's field. The still links to the project page, where the field comes alive.

### 2. Code / Paper / Demo links per project
Set `links.github`, `links.paper` or `links.demo` in a project's front matter. A quiet mono link appears with
an icon on the home entry, the Work entry and the project page; nothing appears when the field is absent.
The README has a copy-paste example. This was verified with a temporary GitHub link on LeafScope:
* screenshots at 1440 px (light) and 390 px (dark) on all three places;
* the link was then removed, and `leafscope.md` is unchanged in git.

**Waiting on you:** the real URLs.

### 3. Contact
The footer now opens with the contact block on every page:
* a small "Contact" heading;
* the email, large, as a mailto link;
* GitHub as a second link.

There is no copy button and no tagline. The footer's link lists (Index, Projects, Elsewhere) follow, then
the wordmark. The hero's "Contact" button jumps to this block.

### 4. One motion grammar (written down in DESIGN.md §7)
* **Entrance:** everything that appears rises 16 px while fading in. This covers on-load text, content
  revealed on scroll and menu items. It runs for 0.9 s with the same easing and a 70 ms stagger.
* **Hover / focus:** every link, action, nav item and icon control draws a 1 px underline from the left
  (0.3 s). Arrows nudge 3 px in their own direction. Press dims the label. Nothing else moves.
* **Hint:** every field has the same caption, the project name plus "Move the cursor across the field" or
  "Drag across the field" on touch, and every field responds the same way: the particles part and spring
  back.
* **One persistent field across pages.** There is now a single WebGL canvas for the whole site:
  * **Navigation:** the canvas is carried into the next page's slot. Its particles flow from the form they
    held into the new page's form (home landscape → leaf → back to the landscape, and so on).
  * **Glide:** if the field was on screen, it glides to its new place during the view transition; if not,
    it fades in where it belongs.
  * **Pages without a field:** Work and About park it. It keeps its last form.
  * **First appearance:** the field flows in from noise.
  * **Fallback:** where view transitions are not supported, the page cross-fades and the morph still runs.

### 5. Phone hero
The field, name, status line and buttons now read as one block. The field is a 2:1 band capped at 40% of the
screen height, with the form lifted slightly toward the name. The gap between field and name is 37 px; at
390 × 844 the buttons end at 542 px. "Third-year B.Tech CSE · VIT Vellore" stays, in the secondary text
colour (AA contrast in both themes).

### Checks after this round
**Cross-page morph test** (`node scripts/perf-morph.mjs`): Playwright with Chromium, Pixel 5 emulation, touch,
4× CPU throttle and software WebGL. The test navigates home → project → home → Work → project → next
project and records every frame.

| Navigation | Frames | p50 | p95 | Frames > 33 ms | Long tasks | Field attach |
| --- | --- | --- | --- | --- | --- | --- |
| home → LeafScope | 174 | 16.7 ms | 33.3 ms | 4 | 1 (153 ms) | 2.2 ms |
| LeafScope → home (glide) | 146 | 16.7 ms | 33.4 ms | 6 | 1 (54 ms) | 0.7 ms |
| home → Work (field parks) | 143 | 16.7 ms | 33.4 ms | 7 | 1 (57 ms) | — |
| Work → Ghosts in the Splat | 123 | 16.7 ms | 33.4 ms | 5 | 1 (211 ms) | 4.8 ms |
| Ghosts → next project | 167 | 16.7 ms | 33.4 ms | 9 | 0 | 4.1 ms |

* **Canvas carried across:** the same canvas element was carried across every navigation, and the new form
  was morphing 0.3 s after each one.
* **Field cost:** about 4.8 ms of JS per frame on average (p95 7.9 ms, budget 16.7 ms).
* **Long tasks:** the one long task per navigation is Astro swapping the page DOM, not the field.
* **Scrolling:** a drag over the field after all those navigations still scrolled the page (235 px).

**Lighthouse** (mobile preset):

| Page | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Home | 100 | 100 | 100 | 100 |
| Work | 99 | 100 | 100 | 100 |
| LeafScope | 100 | 100 | 100 | 100 |
| Ghosts in the Splat | 100 | 100 | 100 | 100 |
| About | 100 | 100 | 100 | 100 |

LCP is 1.7–1.8 s, TBT 0 ms and CLS ≤ 0.001 on every page.

**Other checks:**
* `astro check` reports 0 errors.
* The link checker found 0 broken links.
* `scripts/interact.mjs` passes all 29 browser checks. New ones cover:
  * no static red and no index numbering on four pages;
  * one hover and one entrance rule site-wide;
  * the same canvas surviving home → project → home → Work → project;
  * the phone hero block and touch behaviour;
  * reduced motion and no WebGL.

**Screenshots** (two critique rounds): Home, Work, LeafScope, Ghosts, About and the footer at 390 px in light
and dark, and at 1440 px.
* **Round 1 fixed:**
  * a dead band under the phone hero field;
  * an oversized Work title;
  * the duplicate GitHub link in the footer;
  * random red accents in the Work stills;
  * cramped pager arrows.
* **Round 2:** no leftover decoration found.

### Limitations of this round
* **No real device:** the numbers come from emulation with a software GPU. On a real phone the p95 should be
  lower, because the GPU does the drawing that SwiftShader does on the CPU here. The DOM swap long task
  (54–211 ms at 4× throttle) happens on every navigation regardless of the field.
* **Glide timing:** the field glides only when it is on screen as you leave the page. Navigating from the
  footer (field scrolled away) makes it fade in at its new place instead, which avoids a long diagonal
  flight across the page.
* **Browser support:** browsers without view-transition support get Astro's cross-fade fallback instead of
  the glide. The particle morph itself works everywhere WebGL does.

---

## Review round 1 — feedback from a real Android phone

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
