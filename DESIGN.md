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
| **apple.com** | One idea per screen. Type is the image. Huge, tightly tracked headlines with very quiet supporting copy. Scroll is the narrative device: things change *because* you scrolled, not because a timer fired. | The name is set at display size beside one live field. Whitespace is a feature; one idea per block. |
| **Nothing (intl.nothing.tech)** | Monochrome with a single red accent used as a *signal*, not decoration. A dot-matrix display face for numerals and labels. Technical micro-labels, visible grids, "industrial" honesty (it shows its construction). | Near-black/off-white palette with one red. Doto (OFL dot-matrix) for the DBM wordmark only. Mono micro-labels and hairline rules. Red appears **only inside the interaction**: accent particles in the field, a failed node or broken link that the field is about, and the keyboard focus ring. No static red decoration anywhere. |
| **product.inc** | Information architecture of a personal site that is *used*: selected work, experiments, notes, a resume timeline, a contribution graph, strong nav and a footer that works as a sitemap. Each block has a clear job and a consistent header pattern. | One section-header pattern (label, title, rule). Research areas carry their projects, on home and on /work/ alike. Every module exists as an optional section behind a flag. The footer opens with contact and works as a sitemap. |
| **Streamline "sharp" sets** | Crisp geometric icons on a precise grid; square terminals; no softness. | Icons come from Material Symbols *Sharp* (Apache-2.0), drawn at 24px grid with a light weight, always paired with a text label. Radius is 0 everywhere in the UI. |

Anti-lessons (AI-site tells deliberately avoided): gradient blobs, glassmorphism, purple/blue
gradients, emoji, "Hi, I'm …", grids of identical rounded icon cards, centred-everything layouts,
stock illustrations, invented statistics, skill bars.

---

## 2. Direction: "research instrument"

The site behaves like a measuring instrument that has been pointed at one person's work: a calm
monochrome page, hairline rules, and one live particle field that reacts to touch.
Authority comes from precision and restraint, not decoration.

* **Voice:** confident, precise, quiet, technical. Sentences are short and factual. No superlatives.
* **Shape language:** right angles only. 1px rules. No ornaments (no registration marks, no decorative dots).
* **Annotations (with restraint):** one quiet type · stage line per project, the coordinates and local time
  of Vellore in the footer. No index numbers anywhere. Only *true* values are shown (no fabricated metrics).
* **Content honesty:** nothing is invented. Any figure shown is supplied by the owner.

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
| `--accent` | `#E4161F` | `#FF4638` | accent particles and meaningful states inside the field |
| `--accent-text` | `#C40E18` | `#FF5D50` | keyboard focus ring (AA on `--bg`) |

`npm run contrast` checks every text/background pair in both themes against WCAG AA (4.5:1 body,
3:1 large/UI) and fails the build script if one drops below.

---

## 4. Fonts (all self-hosted, all OFL; no third-party requests)

| Role | Family | Licence | Files |
| --- | --- | --- | --- |
| Wordmark only ("DBM" in the header and footer) | **Doto** (variable, `wght`) by Oliver Lalan — a dot-matrix face; used as an open alternative to Nothing's proprietary dot font | SIL OFL 1.1 | `Doto-var.woff2` |
| Headings + body | **Instrument Sans** (variable, `wght`) | SIL OFL 1.1 | `InstrumentSans-var.woff2` |
| Metadata, code, labels | **IBM Plex Mono** 400 / 500 | SIL OFL 1.1 | `IBMPlexMono-400/500.woff2` |

Latin subsets only (≈ 66 KB total). Files live in `src/assets/fonts/` with licence texts in
`src/assets/fonts/licenses/`. Two are preloaded (Instrument Sans, Plex Mono 400). `font-display: swap`
with a metric-matched fallback to avoid layout shift. Numbers are never set in Doto (the dots render
faint on phones); small labels use Plex Mono.

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

## 6. Grid and spacing

* 12 columns, gutter `clamp(12px, 1.6vw, 24px)`, page margin `clamp(16px, 4vw, 56px)`, content
  max-width 1760px (so 2560px screens do not stretch lines of text).
* Structure is carried by type size, weight, spacing and 1px rules alone (the background column guides
  were removed in review round 2: they did not line up with the content columns).
* Spacing scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 144 · 224 (fluid between breakpoints).
  Sections are separated by `--space-section` (96–224px), headers by a 1px rule.
* Breakpoints: 640 / 900 / 1280 (content-driven; layouts are fluid between them). Verified from 360px
  to 2560px with no horizontal scroll.

## 7. Motion grammar (one system, applied everywhere)

Defined after review round 2, when motion felt jumbled. Every rule below is implemented once in
`src/styles/ui.css` / `src/scripts/motion.ts` and reused; `scripts/interact.mjs` checks it.

| Element | The one behaviour | Timing |
| --- | --- | --- |
| **Entrance** (on load, on scroll, mobile menu items) | content rises 16px while fading in. Nothing wipes, slides sideways, scales or splits into words | 0.9s, `cubic-bezier(.16,1,.3,1)`, 70ms stagger within a group |
| **Hover / focus** (every link, action, nav item, icon control, pager) | a 1px underline draws in from the left; arrows nudge 3px in their own direction. No fills, no colour changes, no shifts of the text | 0.3s, same easing |
| **Press** | the label dims to 60% | 0.15s |
| **Page transition** | the old page fades out, the new page fades in and its content rises with the entrance above | 0.25s out / 0.35s in |
| **The field** | particles spring back to their form; a finger parts them, a tap ripples; between pages the field glides to its new place and flows into the new form | springs ≈ 0.3–0.6s settle; morph 1.1s per particle, staggered over 0.6s; glide 0.9s |

* **Removed** because they had no job of their own: line-mask title reveals, word splitting, rule draws,
  clip-path wipes, the scroll-scrubbed focus list, the scroll/section readout, blinking status lamp,
  row hover fills and title shifts, button fills, image zooms, GSAP + ScrollTrigger (the entrance is now
  an IntersectionObserver plus one CSS transition).
* **Kept:** Lenis smooth wheel scrolling on desktop (native on touch), and the header that slides away
  while you scroll down and returns when you scroll up (it frees the screen on phones).
* **`prefers-reduced-motion`:** no smooth scroll, no entrances, no page transitions, no live field (its
  static SVG render is shown instead). Content is simply there.

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

**Decision: A**, simplified twice after testing on a real phone. Round 1: the field no longer travels down
the page behind the text. Round 2: there is now **one** field for the whole site — a single persistent
canvas that is carried across page transitions and takes the form of whatever page you are on.

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
* **One field, many slots.** Pages that show the field contain a slot (`[data-field-slot]`): the home hero,
  each project page, the 404 page. On every Astro view transition the same canvas (one WebGL context) is
  moved into the new page's slot before the new page is captured; its particles then flow from the form
  they last held into the new page's form (per-particle staggered morph with a slight lift toward the
  viewer). If the old slot was on screen, the slot itself glides to its new position (a shared
  view-transition element); if not, the field fades in where it belongs. Pages without a slot (Work,
  About) park it, and it remembers its form for the next page that needs it. The first appearance flows
  in from uninitialised noise. Scenes are prebuilt in idle time so navigations do not build them.
* The Work page shows a **still** of each project's form (rendered at build time from the same scene
  data) that links to the project page, where the form comes alive — so there is never more than one
  live field, and a still is never mistaken for an interactive one.
* Budget: 10,000 particles on desktop, 5,000 on phones; DPR capped at 1.75 / 1.5; half frame-rate when
  idle; paused off-screen and when the tab is hidden. Measured on an emulated phone with 4× CPU throttle:
  ≈ 4 ms of JS per frame (budget 16.7 ms); attaching the field to a new page costs 1–18 ms.
* Phones start the live field on first touch or scroll (or after 9 s); until then the identical
  server-rendered SVG is shown. Reduced motion and missing WebGL keep the SVG.

**Scenes** (`scenes.ts` builds them, `behaviours.ts` gives them meaning). One scene per project, live on its
page and shown as a still on /work/:

| Scene | Used for | What touching does |
| --- | --- | --- |
| `scene` | home hero (a captured landscape) | parts around the finger |
| `leaf` | LeafScope | parts around the finger (a whole leaf: surface, midrib, veins, outline, stem) |
| `ghost` | Ghosts in the Splat | dissolves the splat object under the finger, leaving a faint residue that slowly heals |
| `graph` | MAST framework extension | lights the agent under the finger; a pulse travels along its edges and one hop beyond |
| `network` | Fault-tolerant feedback | one node has failed (red); messages try it, bounce back and reroute. Tap a node to fail it instead |
| `tree` | Agentic Shell | broken symlinks dangle in red; touching one reconnects it (it slowly breaks again) |
| `noise` | 404 | the field never converges |

The same generators produce the static SVG fallback and the Work-page stills, so they always match the live
scene. Every field carries the same caption: the project name (when there is one) and a device-aware hint
("Drag across the field" on touch, "Move the cursor across the field" with a mouse). Every scene responds
the same way (particles part and spring back); a project's scene adds at most one behaviour of its own.

## 9. Page map

```
/                    Home (config-ordered sections)
/work/               Research & projects: areas with their projects, each with a still of its field
/work/<slug>/        Project detail (one per Markdown file)
/about/              Bio, education, interests, skills, [timeline], [publications]
/notes/              Notes index           (exists only when notes are enabled AND ≥ 1 post)
/notes/<slug>/       Note
/404                 Not found (particles fail to converge)
/og/*.png            Generated Open Graph images
/robots.txt, /sitemap-index.xml
```

## 10. Homepage sections, in order (`site.config.ts → homeSections`)

1. `hero` — the field, the name, one status line, two actions ("Research & projects", "Contact").
2. `research` — "Research & projects": each research area is a heading with one sentence and its projects
   directly underneath (type · stage line, title, summary, Code / Paper / Demo links when set). A project
   appears once. The Work page uses the same structure and adds a still of each project's field.
3. `about` — short bio and education (a portrait appears beside the text once `public/images/profile.jpg`
   exists).
4. `stack` — skills as a specification sheet.
5. `timeline` / `publications` / `notes` / `github` — optional (flag + content).

**Contact** is no longer a section: it opens the footer on every page (a short heading, the email as a
large mailto link, GitHub), followed by the footer's link lists.

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
| `contactForm` | off | form in the footer's contact block |
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

* **Review round 2 (real Android phone):** one persistent field morphing between pages; "What I work on"
  and the project list merged into "Research & projects" (same structure on /work/); contact folded into
  the top of the footer; every decorative red dot/square, all index numbering, the "Portfolio" label and
  the column guides removed; one motion grammar (§7). See REVIEW.md.
* **Review round 1:** the field contained to where it can be looked at; spring-physics touch with passive
  listeners; one interactive scene per project; the Work page grouped by research area.
* **Phones:** the live field starts on first touch/scroll (or after 9 s); the identical SVG render is shown
  until then. Desktop starts it when the browser is idle.
* **404** uses the `noise` scene: the field never converges.
* **Contrast:** lowest measured pair is red text on the panel colour in light mode (4.82 : 1); red text is
  now used only for the focus ring.
