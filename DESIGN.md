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
  of Vellore in the footer, status lines on projects. Only *true* values are shown (no fabricated metrics).
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
  3. *Wipe* — project rows enter with a clip-path wipe, staggered by index.
  4. *Spring* — the particle fields respond to cursor and finger with spring physics (see §8).
* **Smooth scroll:** Lenis (≈1.1s glide), disabled on touch devices' native momentum where it hurts,
  and entirely under reduced motion.
* **Page transitions:** Astro View Transitions. Nav and the theme toggle persist; the page body
  exits with a short fade/lift and the next page enters with a bottom-up wipe.
* **`prefers-reduced-motion`:** no smooth scroll, no scroll-linked animation, no transitions, no
  WebGL animation. Content is simply there. The particle field is replaced by a static SVG render
  of the same data.

## 8. The 3D signature element — three concepts

All three share the same technology (a GPU point cloud). Concept A was chosen; its implementation is
described under "Decision" below.

**A. "Reconstruction" (chosen).** A cloud of soft, Gaussian-profile splats begins as uninitialised
noise (like the random initialisation that precedes 3DGS training), *converges* into a captured scene
as the page loads. Each project then has its own form — a leaf (self-supervised pre-training on crop
images), an agent graph, a failing network, a directory tree with links, a splat object that can be
erased — and the cursor or a finger moves the particles. Tells the story of the research without words,
and each form is tied to a real project.

**B. "Orbit scan".** One scanned object (e.g. a statue) that rotates with scroll and is relit by the
cursor. Beautiful, but it says "3D model viewer" rather than "research", and one object cannot carry
a whole page.

**C. "Seismograph field".** A heightfield of points whose amplitude follows scroll velocity and cursor
energy. Elegant and cheap, but abstract; it has no link to Gaussian splatting.

**Decision: A**, then simplified after testing on a real phone (review round 1): the field no longer
travels down the page behind the text. It lives only where it can be looked at — inside the hero, on each
project's card and on its page — and every use is properly interactive instead of decorative.

**Interaction model** (`src/scripts/stage/stage.ts`):
* A small CPU spring-physics engine (a few thousand particles) writes positions into a GPU point cloud.
  Each particle springs toward its home position (slightly under-damped, so things drift back softly
  with a little overshoot). A finger or cursor pushes particles aside with a smooth falloff and a faint
  swirl; a tap or click sends a ripple outward. Pointer position and strength are eased, so contact
  never teleports.
* **Touch never blocks scrolling.** Fingers are read through *passive* `touchstart/move/end` listeners
  (touchmove keeps firing while the page scrolls, so the field keeps reacting), containers declare
  `touch-action: pan-y`, and `overscroll-behavior-x: none` stops a sideways drag from triggering
  browser history swipes. Mouse and pen use pointer events.
* At most 4 WebGL contexts exist (a renderer pool lends canvases to whichever stages are on screen);
  stages mount when they approach the viewport and pause when they leave it or the tab is hidden.
* Budget: hero 12,000 / 5,500 particles, cards 5,200 / 3,400, project page 8,500 / 4,500 (desktop /
  phone); DPR capped at 1.75 / 1.5; half frame-rate when idle. Measured on an emulated phone with 4×
  CPU throttle: ≈ 3.5–5 ms of JS per frame (budget 16.7 ms).
* Phones start the live field on first touch or scroll (or after 9 s); until then the identical
  server-rendered SVG is shown. Reduced motion and missing WebGL keep the SVG.

**Scenes** (`scenes.ts` builds them, `behaviours.ts` gives them meaning). One scene per project, used on
its card and its page:

| Scene | Used for | What touching does |
| --- | --- | --- |
| `scene` | home hero (a captured landscape) | parts around the finger |
| `leaf` | LeafScope | parts around the finger (a whole leaf: surface, midrib, veins, outline, stem) |
| `ghost` | Ghosts in the Splat | dissolves the splat object under the finger, leaving a faint residue that slowly heals |
| `graph` | MAST framework extension | lights the agent under the finger; a pulse travels along its edges and one hop beyond |
| `network` | Fault-tolerant feedback | one node has failed (red); messages try it, bounce back and reroute. Tap a node to fail it instead |
| `tree` | Agentic Shell | broken symlinks dangle in red; touching one reconnects it (it slowly breaks again) |
| `noise` | 404 | the field never converges |

The same generators produce the static SVG fallback, so it always matches the live scene. Captions are
uniform: project name on one side, a device-aware hint on the other ("Drag across the field" on touch,
"Move the cursor across the field" with a mouse).

## 9. Page map

```
/                    Home (config-ordered sections)
/work/               Project index, grouped under the three research areas (filters are an optional module)
/work/<slug>/        Project detail (one per Markdown file)
/about/              Bio, education, interests, skills, [timeline], [publications]
/notes/              Notes index           (exists only when notes are enabled AND ≥ 1 post)
/notes/<slug>/       Note
/404                 Not found (particles fail to converge)
/og/*.png            Generated Open Graph images
/robots.txt, /sitemap-index.xml
```

## 10. Homepage sections, in order (`site.config.ts → homeSections`)

1. `hero` — name at display size, one status line, two buttons; the interactive field lives inside it.
2. `focus` — "What I work on": the three research areas, each with a sentence and links to its projects.
3. `work` — all featured projects as an index list.
4. `about` — short bio and education (a portrait appears beside the text once `public/images/profile.jpg`
   exists).
5. `stack` — skills as a specification sheet.
6. `timeline` / `publications` / `notes` / `github` — optional (flag + content).
7. `contact` — heading, large mailto link with a copy button, GitHub (and other filled social links), optional form.

No particles appear behind body text anywhere.

Adding a section = create `src/sections/<Name>.astro` and add `'<name>'` to `homeSections`.

## 11. Content model (Astro content collections, `src/content.config.ts`)

* **projects** (`src/content/projects/*.md`): `title`, `type` (`Research project` | `Team project` |
  `Course project`), `stage?` (`In progress` | `Early stage` | `Completed`), `area?` (one of the research
  areas in `site.config.ts → interests`; groups the project on /work/), `summary`, `tags[]` (max 2, from
  the controlled list `TAGS`), `role?`, `links?` (`github?`, `paper?`, `demo?`, `other[]?`), `cover?`
  (image), `featured`, `order`, `visual?` (`leaf` | `ghost` | `graph` | `network` | `tree`), `facts?`,
  `draft?`. Shown as one quiet line, "Research project · In progress". Body = Markdown.
* **notes**, **timeline**, **publications**: as before (see README).
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
| `workFilters` | off | topic / type / stage filters on /work/ (replaces the grouped layout with a filterable grid; for when there are many projects) |

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

---

## 15. Deviations and additions made during the build

* **Review round 1 (real Android phone):** see REVIEW.md for the full list. In short: the field is
  contained (hero, cards, project pages), touch uses spring physics with passive listeners, each project
  has its own interactive scene, the Work page is grouped by research area, the scroll readout and the
  index card were removed.
* **Phones:** the live field starts on first touch/scroll (or after 9 s); the identical SVG render is shown
  until then. Desktop starts it when the browser is idle.
* **Section index numbers** are CSS counters (`data-numbered`), so hiding a section renumbers the rest.
* **404** uses the `noise` scene: the field never converges.
* **Contrast:** lowest measured pair is red text on the panel colour in light mode (4.82 : 1).
