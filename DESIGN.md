# DESIGN.md

Design record for the portfolio of Debojyoti Barai Mitul. Decisions are written down here so that
future edits stay coherent. Where I had to choose without being able to ask, the reasoning is given.

> **Note on references.** The sandbox this was built in blocks outbound traffic to apple.com,
> nothing.tech, product.inc and streamlinehq.com (HTTP 403 from the egress proxy), so they could not
> be screenshotted. The lessons below are principles I already know from those sites, not a
> pixel study. Nothing from them (layout, copy, images, icons, fonts) is reused.

---

## 1. Lessons from the references (principles only)

| Reference | What is worth learning | How it shows up here |
| --- | --- | --- |
| **apple.com** | One idea per screen. Type is the image. Huge, tightly tracked headlines with very quiet supporting copy. Scroll is the narrative device: things change *because* you scrolled, not because a timer fired. | The name is set at display size. The research-focus section is a pinned, scroll-scrubbed sequence: three lines, one active at a time. Whitespace is a feature; sections are tall. |
| **Nothing (intl.nothing.tech)** | Monochrome with a single red accent used as a *signal*, not decoration. A dot-matrix display face for numerals and labels. Technical micro-labels, visible grids, "industrial" honesty (it shows its construction). | Near-black/off-white palette with one red. Doto (OFL dot-matrix) for numerals, status tags and the wordmark. Mono micro-labels, hairline grid, registration marks. Red appears only on: the active state, the status dot, the 3D accent particles and the focus ring. |
| **product.inc** | Information architecture of a personal site that is *used*: selected work, experiments, notes, a resume timeline, a contribution graph, strong nav and a footer that works as a sitemap. Each block has a clear job and a consistent header pattern. | One section-header pattern (index, label, title, rule). Every module in the brief exists as an optional section behind a flag. The footer repeats navigation, contact and colophon. |
| **Streamline "sharp" sets** | Crisp geometric icons on a precise grid; square terminals; no softness. | Icons come from Material Symbols *Sharp* (Apache-2.0), drawn at 24px grid with a light weight, always paired with a text label. Radius is 0 everywhere in the UI. |

Anti-lessons (AI-site tells deliberately avoided): gradient blobs, glassmorphism, purple/blue
gradients, emoji, "Hi, I'm …", grids of identical rounded icon cards, centred-everything layouts,
stock illustrations, invented statistics, skill bars.

---

## 2. Direction: "research instrument"

The site behaves like a measuring instrument that has been pointed at one person's work: a calm
monochrome field, a hairline grid, readouts in a dot-matrix display, and a single red signal lamp.
Authority comes from precision and restraint, not decoration.

* **Voice:** confident, precise, quiet, technical. Sentences are short and factual. No superlatives.
* **Shape language:** right angles only. 1px rules. Registration marks (`+`) where rules cross.
* **Annotations (with restraint):** index numbers on sections, status tags on projects, coordinates
  of Vellore in the footer/hero readout, a scroll/section readout (home only), live particle count
  in the 3D caption. Only *true* values are shown (no fabricated metrics).
* **Content honesty:** nothing is invented. Any figure shown is either supplied by the owner or is a
  property of the page itself (e.g. the number of particles being drawn).

---

## 3. Colour tokens

Defined on `:root` in `src/styles/tokens.css`; dark values apply under
`prefers-color-scheme: dark` (unless the visitor chose otherwise) and under `[data-theme="dark"]`.
The visitor's explicit choice is stored in `localStorage` only (no cookies).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#EEEDE8` | `#0B0B0C` | page |
| `--bg-2` | `#E5E4DE` | `#141416` | panels, hover fills |
| `--fg` | `#0C0C0D` | `#EEEDE8` | headlines, body |
| `--fg-2` | `#3B3B38` | `#C9C8C2` | secondary body |
| `--muted` | `#5A5A55` | `#9C9B95` | labels, metadata |
| `--rule` | `fg @ 16%` | `fg @ 16%` | hairlines |
| `--rule-strong` | `fg @ 45%` | `fg @ 45%` | borders on controls |
| `--accent` | `#E4161F` | `#FF4638` | shapes, 3D accent particles |
| `--accent-text` | `#C40E18` | `#FF5D50` | red used as text/focus (AA on `--bg`) |

`npm run contrast` checks every text/background pair in both themes against WCAG AA (4.5:1 body,
3:1 large/UI) and fails the build script if one drops below.

---

## 4. Fonts (all self-hosted, all OFL; no third-party requests)

| Role | Family | Licence | Files |
| --- | --- | --- | --- |
| Display (numerals, tags, wordmark, readouts) | **Doto** (variable, `wght`) by Oliver Lalan — a dot-matrix face; used as an open alternative to Nothing's proprietary dot font | SIL OFL 1.1 | `Doto-var.woff2` |
| Headings + body | **Instrument Sans** (variable, `wght`) | SIL OFL 1.1 | `InstrumentSans-var.woff2` |
| Metadata, code, labels | **IBM Plex Mono** 400 / 500 | SIL OFL 1.1 | `IBMPlexMono-400/500.woff2` |

Latin subsets only (≈ 66 KB total). Files live in `src/assets/fonts/` with licence texts in
`src/assets/fonts/licenses/`. Two are preloaded (Instrument Sans, Plex Mono 400). `font-display: swap`
with a metric-matched fallback to avoid layout shift. Doto is never set below 14px (the dots stop
reading); small labels use Plex Mono.

## 5. Type scale (fluid, `clamp()`, ratio ≈ 1.25 at the low end opening to 1.4 at the high end)

| Token | Range | Use |
| --- | --- | --- |
| `--t-mono` | 11–12px, tracking .08em, uppercase | labels, metadata |
| `--t-small` | 13–14px | captions |
| `--t-body` | 16–18px / 1.55 | body (measure ≤ 62ch) |
| `--t-lead` | 19–26px / 1.4 | intros |
| `--t-h3` | 22–32px | row titles |
| `--t-h2` | 36–88px / 0.98, tracking −0.035em | section titles |
| `--t-h1` | 52–240px / 0.86, tracking −0.05em | name / page titles |
| `--t-dot` | 14–120px Doto | indices, status tags |

## 6. Grid and spacing

* 12 columns, gutter `clamp(12px, 1.6vw, 24px)`, page margin `clamp(16px, 4vw, 56px)`, content
  max-width 1760px (so 2560px screens do not stretch lines of text).
* Faint vertical column guides (4 lines) are drawn on ≥ 900px as a fixed background — the "graph
  paper" of the instrument. Content sits on them.
* Spacing scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 144 · 224 (fluid between breakpoints).
  Sections are separated by `--space-section` (96–224px), headers by a 1px rule.
* Breakpoints: 640 / 900 / 1280 (content-driven; layouts are fluid between them). Verified from 360px
  to 2560px with no horizontal scroll.

## 7. Motion principles

* **Purposeful and rare.** Each effect has one job; not everything fades up.
* **Durations:** micro 150ms (hover/press), UI 300ms (menus, theme), reveals 800–1100ms, page
  transition 450ms out / 700ms in.
* **Easings:** `--ease-out: cubic-bezier(.16,1,.3,1)` (expo-out feel) for entrances;
  `--ease-in-out: cubic-bezier(.76,0,.24,1)` for wipes; no bounce, no overshoot.
* **Vocabulary:**
  1. *Line-mask rise* for display headings (text slides up inside an overflow mask).
  2. *Rule draw* — hairlines scale in from the left.
  3. *Scrub* — the focus section and the manifesto words are driven by scroll position.
  4. *Wipe* — project rows and plates enter with a clip-path wipe, staggered by index.
  5. *Morph* — the 3D particle field changes form with scroll (see §8).
* **Smooth scroll:** Lenis (≈1.1s glide), disabled on touch devices' native momentum where it hurts,
  and entirely under reduced motion.
* **Page transitions:** Astro View Transitions. Nav and the theme toggle persist; the page body
  exits with a short fade/lift and the next page enters with a bottom-up wipe.
* **`prefers-reduced-motion`:** no smooth scroll, no scroll-linked animation, no transitions, no
  WebGL animation. Content is simply there. The particle field is replaced by a static SVG render
  of the same data.

## 8. The 3D signature element — three concepts

All three share the same technology (a GPU point cloud driven entirely by shader maths; the CPU only
uploads buffers once and updates a handful of uniforms per frame).

**A. "Reconstruction" (chosen).** A cloud of soft, Gaussian-profile splats begins as uninitialised
noise (like the random initialisation that precedes 3DGS training), *converges* into a captured scene
as the page loads, and then re-assembles into different structures as you scroll — a leaf (self-
supervised pre-training on crop images), an agent graph (multi-agent systems), a sphere with a region
carved out (scene unlearning / object removal), a tree with looping links (the inode/symlink agent),
a flat measurement grid — before dispersing again at the end. The cursor acts as a lens that pushes
and swirls nearby splats. Tells the story of the research (noise → structure → erasure) without
words, and each form is tied to a real project.

**B. "Orbit scan".** One scanned object (e.g. a statue) that rotates with scroll and is relit by the
cursor. Beautiful, but it says "3D model viewer" rather than "research", and one object cannot carry
a whole page.

**C. "Seismograph field".** A heightfield of points whose amplitude follows scroll velocity and cursor
energy. Elegant and cheap, but abstract; it has no link to Gaussian splatting.

**Decision: A.** B's rotation and C's heightfield survive as two of A's forms (`scene`, `grid`).

**Implementation notes** (`src/scripts/stage/`):
* `forms.ts` — pure functions that generate each form (`noise`, `scene`, `leaf`, `graph`, `erase`,
  `tree`, `grid`) as `Float32Array`s. The same generators render the static SVG fallback at build
  time, so the fallback is never out of sync with the real thing.
* Vertex shader blends three position buffers: A and B (the forms either side of the current scroll
  position, scrubbed with a per-particle stagger and an arc of dispersion) and C (a hover form,
  e.g. hovering a project row morphs the cloud to that project's form). Cursor displacement, breathing
  motion and point size are computed in the shader.
* Fragment shader draws a Gaussian falloff (`exp(-r²k)`) — the "splat" look. Additive blending in
  dark mode, normal blending in light mode.
* Budget: 16,000 points desktop / 6,000 mobile; DPR capped at 1.75 / 1.25; renderer created only
  after the page is idle and the stage is visible; `three` is a dynamic import (separate chunk);
  render loop pauses on `visibilitychange` and when the stage leaves the viewport; falls back to the
  static SVG when WebGL is unavailable, on context loss, or under reduced motion.
* Each project can set `form:` in its front matter to choose its shape; otherwise one is derived from
  the slug so every project still has a distinct mark.

## 9. Page map

```
/                    Home (config-ordered sections)
/work/               Project index — filter by topic and status (?tag= & ?status= deep-link)
/work/<slug>/        Project detail (one per Markdown file)
/about/              Bio, education, interests, skills, [timeline], [publications]
/notes/              Notes index           (exists only when notes are enabled AND ≥ 1 post)
/notes/<slug>/       Note
/404                 Not found (particles fail to converge)
/og/*.png            Generated Open Graph images
/robots.txt, /sitemap-index.xml
```

## 10. Homepage sections, in order (`site.config.ts → homeSections`)

1. `hero` — name at display size, tagline, status line, readout, 3D stage (form: `scene`).
2. `focus` — pinned, scrubbed sequence of the three research interests (forms: `scene` → `leaf` → `graph`).
3. `work` — selected (featured) projects as an index list; hover morphs the 3D field (form: `erase`).
4. `about` — short bio, education, portrait plate (photo if `public/images/profile.jpg` exists, a
   typographic plate otherwise).
5. `stack` — skills as a specification sheet (form: `grid`).
6. `timeline` — optional (flag + content).
7. `publications` — optional (flag + content).
8. `notes` — optional (flag + content).
9. `github` — optional (flag; build-time fetch; hidden on failure).
10. `contact` — large mailto link with copy button, social links, optional form (flag) (form: `noise`).

Adding a section = create `src/sections/<Name>.astro` and add `'<name>'` to `homeSections`.

## 11. Content model (Astro content collections, `src/content.config.ts`)

* **projects** (`src/content/projects/*.md`): `title`, `status`, `summary`, `tags[]`, `role?`,
  `links?` (`github?`, `paper?`, `demo?`, `other[]?`), `cover?` (image), `featured`, `order`,
  `form?` (3D shape), `draft?`. Body = Markdown.
* **notes** (`src/content/notes/*.md`): `title`, `date`, `summary`, `tags?`, `draft?`.
* **timeline** (`src/content/timeline/*.md`): `title`, `org`, `kind`
  (`education|experience|research|award|other`), `start`, `end?` (absent = present), `location?`,
  `summary?`.
* **publications** (`src/content/publications/*.md`): `title`, `authors[]`, `venue`, `year`,
  `status?`, `links?` (`paper?`, `code?`, `doi?`).
* Files whose name begins with `_` are ignored by every loader — each collection ships with an
  `_example.md` to copy.

## 12. Feature flags and empty states

`site.config.ts → features`:

| Flag | Default | Effect |
| --- | --- | --- |
| `notes` | off | `/notes/`, nav link, home section |
| `publications` | off | home + about section |
| `timeline` | off | about + home section |
| `githubGraph` | off | build-time contribution graph |
| `contactForm` | off | form in contact section |

A module renders only when **flag on AND content exists**. Optional front-matter fields render only
when present. Social links render only when filled. "Download CV" renders only if `public/cv.pdf`
exists at build time. No "coming soon" placeholders anywhere.

## 13. Deploy configuration

`SITE_URL` and `BASE_PATH` env vars drive `astro.config.mjs` (defaults: the preview URL and
`/portfolio-v2/`). `NOINDEX` defaults to `true` whenever the base is not `/`; it emits
`<meta name="robots" content="noindex">`, a disallowing `robots.txt` and omits the sitemap. All
internal links go through `href()` in `src/lib/url.ts`, so moving to `https://debojyoti17.github.io/`
with base `/` is a configuration change only.

## 14. Stack and licences

| Piece | Licence | Note |
| --- | --- | --- |
| Astro 5 | MIT | static output, content collections, View Transitions (`ClientRouter`) |
| TypeScript | Apache-2.0 | |
| Three.js | MIT | dynamic import, only where the stage appears |
| GSAP + ScrollTrigger | GSAP "Standard 'no charge' licence" | free for commercial and personal use since the 2025 licence change; verified in the npm manifest. Loaded lazily |
| Lenis | MIT | smooth scroll |
| Material Symbols (Sharp) | Apache-2.0 | only the handful of SVGs used are inlined (`src/components/Icon.astro`) |
| Doto / Instrument Sans / IBM Plex Mono | SIL OFL 1.1 | self-hosted |
| satori + @resvg/resvg-js | MPL-2.0 | build-time Open Graph images |
| sharp | Apache-2.0 | Astro image optimisation |

No analytics, no tracking, no cookies, no third-party requests at runtime. The optional GitHub
graph is fetched at **build time** only.
