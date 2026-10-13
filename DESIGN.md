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
  The only round shapes are the particles and the ring cursor that echoes their touch radius.
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

Defined in review round 2, extended in round 3 for the new moments. Every rule is implemented once
(`src/styles/ui.css`, `src/scripts/motion.ts`, `src/scripts/cursor.ts`, `src/scripts/stage/`) and
`scripts/interact.mjs` checks the shared ones. **One direction (things rise into place), one easing
(`cubic-bezier(.16,1,.3,1)`), two durations: 0.9s for content entering, 0.3s for responses to the hand.**

| Element | The one behaviour | Timing |
| --- | --- | --- |
| **Entrance** (on load, on scroll, menu items, the name revealed after the intro) | content rises 16px while fading in. Nothing wipes, slides sideways, scales or splits into words | 0.9s, 70ms stagger within a group |
| **Hover / focus** (every link, row, action, nav item, icon control, next-project link) | an underline draws in from the left (1px on text, 0.05em on display-size links); arrows nudge 3px in their own direction. A project row underlines its title. No fills, no colour changes, no text shifts | 0.3s |
| **Press** | the label dims to 60% | 0.15s |
| **Hover preview** (fine pointers) | rises 16px and fades in beside the cursor, follows it with easing, morphs from one project's form to the next, fades out | 0.3s in/out; follow ≈ 0.1s lag; morph 0.7s |
| **Ring cursor** (fine pointers) | follows with slight easing; grows to name what a click does: View (projects), Drag (fields), Open (links that leave the site) | 0.3s grow; ≈ 0.05s lag |
| **Magnetic email** | the one large link leans up to 14px toward a nearby cursor and springs back | eased, ≈ 0.1s |
| **Page transition** | the page cross-fades; one element carries the name `field` and morphs into its counterpart: a specimen grows into the project's field, and shrinks back on Back | 0.25s out / 0.35s in; field group 0.9s |
| **The field** | springs back to its form; a finger parts it, a tap ripples; between pages it flows into the new form | springs ≈ 0.3–0.6s; morph 1.1s per particle over a 0.6s stagger |
| **Name assembly** (first visit, home) | noise → the name → the landscape | ≈ 1.5–2s, never blocks input |
| **Scroll** | the hero's particles disperse as it leaves; the contact field gathers as you arrive | tied to scroll / 2.4s gather |

* **Removed** (round 2) because they had no job of their own: line-mask title reveals, word splitting,
  rule draws, clip-path wipes, the scroll-scrubbed focus list, the scroll readout, the blinking lamp, row
  fills and title shifts, button fills, image zooms, GSAP + ScrollTrigger.
* **Kept:** Lenis smooth wheel scrolling on desktop (native on touch), and the header that slides away while
  you scroll down and returns when you scroll up.
* **`prefers-reduced-motion`:** no smooth scroll, no entrances, no page transitions, no name assembly, no
  cursor ring, no preview, no magnetic pull, no live fields (static SVG renders instead). Content is simply
  there. Touch devices never get the ring, the preview or the magnetic pull.
* **Shape:** the ring cursor is the one round UI shape: it echoes the field's circular touch radius.

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

**Decision: A**, simplified twice after testing on a real phone, then given a few signature moments.
Round 1: the field no longer travels down the page behind the text. Round 2: one persistent field for the
whole site, carried across page transitions. Round 3: the moments below, still built on one engine.

**Engine** (`src/scripts/stage/`): `engine.ts` (a `Stage`: canvas, point cloud, spring physics, morphs),
`gl.ts` (renderers), `scenes.ts` / `behaviours.ts` (forms and what touching them does), `stage.ts` (which
stages exist and where they go), `../continuity.ts` (view-transition pairing), `../cursor.ts`.
* **No Three.js any more.** The stage only ever drew one point cloud with a custom shader, so a ~150-line
  WebGL renderer replaces it: the field's script went from 542 KB to 40 KB, which is what lets the first
  visit start at once on phones.
* **2D start, then WebGL.** Creating the first WebGL context while the browser is still starting its GPU
  process can block the page for hundreds of milliseconds (measured: 112–630 ms in a freshly started
  browser, 8 ms a second later). So the first visit draws the name assembly on a 2D canvas (splats written
  straight into pixels, same projection) and moves the same particles to WebGL when the browser is idle.
* **A finger never blocks scrolling:** passive touch listeners, `touch-action: pan-y`,
  `overscroll-behavior-x: none` (a sideways drag must not trigger history swipes).
* **Physics:** each particle springs to its home (slightly under-damped); a finger or cursor parts the
  particles with a smooth falloff and a faint swirl; a tap sends a ripple; each scene may add one behaviour.

**Stages and where they live** (at most 4 WebGL contexts, 3 on phones, whatever the page holds):

| Stage | Particles (desktop / phone) | Where |
| --- | --- | --- |
| main, persistent | 10,000 / 5,000 | home hero, project page, 404. Carried across page transitions and morphs into each page's form; parked on Work and About |
| preview | 4,000 (fine pointers only) | the floating specimen beside the cursor over project rows |
| pool of two | 3,000 / 2,200 | lent to whichever specimen slots are nearest the viewport: inline specimens on touch screens (never more than two live), the next-project specimen, the contact field, the menu backdrop |

**The moments:**
1. **Name assembly** (first visit to home in a session, `sessionStorage`): particles start as drifting
   noise, assemble into the name (sampled from the rendered heading: on desktop exactly where the heading
   sits, which waits hidden; on phones inside the field band above it), hold, then flow into the landscape
   while the heading rises in. Springs are stiffer and better damped while the letters form. Repeat visits,
   reduced motion and no WebGL skip it (a safety net shows everything after 3.6 s).
2. **Scrolling out of the hero** disperses its particles (outward and upward, fading).
3. **Specimens.** Fine pointers: hovering a row shows that project's form in a floating preview that
   follows the cursor and morphs between projects. Touch: each row shows its form inline above the text,
   touchable, lazily live. Every row also shows Code / Paper / Demo when those links exist.
4. **Continuity.** Opening a project, the specimen you were looking at (preview, inline specimen or
   next-project specimen) grows into the project's large field: the main field starts in that same form, so
   it reads as one object growing, not a page reloading. Back reverses it into the row (the preview
   reappears on the row on desktop). Implemented by giving exactly one element per side the
   view-transition name `field` (`continuity.ts`).
5. **Next project:** every project page ends with one large link: title, type line, live specimen.
6. **Menu:** each item has a one-line description; items rise in turn; a faint particle horizon fills the
   empty space; the menu closes on selection; the email stays at the bottom.
7. **Contact ending:** heading, the email as one large mailto link with a subtle magnetic pull, GitHub, and
   a quiet particle cluster that gathers behind the block as you arrive.

**Measured** (Playwright, Pixel 5 emulation, touch, 4× CPU throttle, software WebGL; see REVIEW.md):
the field's JavaScript costs ≈ 2–6 ms per frame (budget 16.7 ms); p50 frame 16.7 ms in every phone flow.

**Scenes** (`scenes.ts` builds them, `behaviours.ts` gives them meaning). One scene per project (its
specimen and its page), plus two quiet ones:

| Scene | Used for | What touching does |
| --- | --- | --- |
| `scene` | home hero (a captured landscape) | parts around the finger |
| `leaf` | LeafScope | parts around the finger (a whole leaf: surface, midrib, veins, outline, stem) |
| `ghost` | Ghosts in the Splat | dissolves the splat object under the finger, leaving a faint residue that slowly heals |
| `graph` | MAST framework extension | lights the agent under the finger; a pulse travels along its edges and one hop beyond |
| `network` | Fault-tolerant feedback | one node has failed (red); messages try it, bounce back and reroute. Tap a node to fail it instead |
| `tree` | Agentic Shell | broken symlinks dangle in red; touching one reconnects it (it slowly breaks again) |
| `noise` | 404 | the field never converges |
| `gather` | contact block | a slowly turning cluster that gathers as you arrive |
| `dust` | menu backdrop | a calm horizon low in the frame |

The same generators produce the static SVG renders (shown until a live stage arrives, and without WebGL or
with reduced motion), so they always match the live scene. Every field carries the same caption: the project name (when there is one) and a device-aware hint
("Drag across the field" on touch, "Move the cursor across the field" with a mouse). Every scene responds
the same way (particles part and spring back); a project's scene adds at most one behaviour of its own.

## 9. Page map

```
/                    Home (config-ordered sections)
/work/               Research & projects: areas with their projects (same rows as home, plus topics)
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
   directly underneath (type · stage line, title, summary, Code / Paper / Demo links when set; the whole
   row opens the project). A project appears once. Specimens: floating preview with a mouse, inline on
   touch. The Work page uses the same rows and adds topics.
3. `about` — short bio and education (a portrait appears beside the text once `public/images/profile.jpg`
   exists).
4. `stack` — skills as a specification sheet.
5. `timeline` / `publications` / `notes` / `github` — optional (flag + content).

**Contact** opens the footer on every page: a short heading, the email as one large mailto link (magnetic
with a mouse), GitHub, and the gathering particle field behind; the footer's link lists follow.

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
| Particle renderer | — | own code (`src/scripts/stage/gl.ts`): WebGL points, plus a 2D start; Three.js and GSAP were removed in rounds 2–3 |
| Lenis | MIT | smooth scroll |
| Material Symbols (Sharp) | Apache-2.0 | only the handful of SVGs used are inlined (`src/components/Icon.astro`) |
| Doto / Instrument Sans / IBM Plex Mono | SIL OFL 1.1 | self-hosted |
| satori + @resvg/resvg-js | MPL-2.0 | build-time Open Graph images |
| sharp | Apache-2.0 | Astro image optimisation |

No analytics, no tracking, no cookies, no third-party requests at runtime. The optional GitHub
graph is fetched at **build time** only.

---

## 15. Deviations and additions made during the build

* **Review round 3:**
  * signature moments (§8): name assembly, hero dispersal, floating preview / inline specimens,
    specimen → project continuity, next-project link, menu descriptions and backdrop, ring cursor, magnetic
    contact ending;
  * Three.js replaced by a small WebGL renderer, with a 2D start on first visits;
  * in-page anchors fixed across view transitions (one handler, header offset, focus);
  * the Work page's static stills are replaced by the same specimen system as home;
  * the previous / next pager is now one large "Next project".
* **Review round 2 (real Android phone):**
  * one persistent field morphing between pages;
  * "What I work on" and the project list merged into "Research & projects";
  * contact folded into the top of the footer;
  * every decorative red dot/square, all index numbering, the "Portfolio" label and the column guides
    removed;
  * one motion grammar (§7).
* **Review round 1:**
  * the field contained to where it can be looked at;
  * spring-physics touch with passive listeners;
  * one interactive scene per project;
  * the Work page grouped by research area.
* **Phones:** on a repeat visit the live field starts on the first touch or scroll (or after 9 s); the
  first visit to home starts it at once, on a 2D canvas, for the name.
* **404** uses the `noise` scene: the field never converges.
* **Contrast:** lowest measured pair is red text on the panel colour in light mode (4.82 : 1); red text is
  used only for the focus ring.
