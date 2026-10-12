# REVIEW.md

Build report for the portfolio. Read this first; details of the design are in [DESIGN.md](DESIGN.md) and
day-to-day instructions are in [README.md](README.md).

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
* **Homepage sections** (order set in `site.config.ts`): hero, research focus (pinned and scroll-scrubbed),
  selected work, about, skills, then the optional timeline / publications / notes / GitHub graph, and contact.
* **3D signature:** "Reconstruction" — a Gaussian-splat-style GPU point cloud that starts as noise,
  converges into a captured scene, then re-forms as a leaf, an agent graph, a sphere with a region
  removed, a file tree with looping links, and a measurement grid as you scroll. The cursor pushes and
  swirls nearby splats; hovering a project row morphs the field to that project's shape. Project pages
  show their own shape in a framed viewport.
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
