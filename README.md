# Debojyoti Barai Mitul — portfolio

A static site built with [Astro](https://astro.build), plain CSS, and a small amount of TypeScript.
It has an interactive particle field (a small WebGL renderer, no 3D library) that travels with you between
pages: it assembles the name on a first visit, shows each project's form as you hover or scroll past it,
and grows that form into the project page. Smooth scrolling, light and dark themes, and no analytics,
cookies or third-party requests.

Preview: <https://debojyoti17.github.io/portfolio-v2/>

> Design decisions live in [DESIGN.md](DESIGN.md). Build notes, scores and open items live in
> [REVIEW.md](REVIEW.md).

---

## Run it locally

You need Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:4321/portfolio-v2/
npm run build      # outputs to dist/
npm run preview    # serve the built site
npm run check      # type-check
npm run links      # check every internal link in dist/
npm run contrast   # check the colour tokens against WCAG AA
node scripts/interact.mjs     # browser smoke tests (needs `npm run preview` running)
node scripts/anchors.mjs      # Work / About / Contact links from every page, phone and desktop
node scripts/perf-morph.mjs   # frame timing of every moment, phone and desktop, 4x CPU throttle
node scripts/lighthouse.mjs "" work/ about/   # build with NOINDEX=false first
```

## The one file you edit most: `site.config.ts`

Everything everyday lives here: your name, tagline, bio, email, social links, skills, the three research
focus lines, the navigation, **feature flags** and the **order of homepage sections**.

* **Social link**: put the URL in `social` (for example `linkedin: 'https://…'`). Empty ones are never
  shown. It then appears in the contact section and footer automatically.
* **Reorder or remove a homepage section**: edit `homeSections`. Delete a name to hide that section.
* **Menu descriptions**: each `nav` item can have a `description`, shown under it in the phone menu.

## Add a project

1. Copy `src/content/projects/_example.md` to `src/content/projects/my-project.md`
   (the file name becomes the URL: `/work/my-project/`).
2. Fill in the front matter. Required: `title`, `type` (Research project / Team project / Course project),
   `summary`. Optional: `stage` (In progress / Early stage / Completed), `area`, `tags`.
3. Write the description in Markdown under the second `---`.

* **`area`** puts the project under one of your research areas on the Work page. It must match a `title`
  in `interests` in `site.config.ts`. Projects without an area appear under "More work".
* **`tags`**: at most two, from the controlled list at the top of `src/content.config.ts` (add a name there
  first when you need a new tag).
* **`visual`** chooses the project's form in the site's particle field (its specimen in the project lists,
  and the large field on its page): `leaf`, `ghost`, `graph`, `network` or `tree`. If omitted, one is
  picked from the file name.
* The project line under each title is built from `type` and `stage`: "Research project · In progress".
* Optional fields (`links.*`, `role`, `cover`, `facts`) show up only when you fill them in. `featured: true`
  puts the project on the home page; `order` sorts (lower first).

### Link a project's code, paper or demo

Add a `links` block to the project's front matter. Each link appears — on the home page, the Work page and the
project page — only when it is filled in; there is no placeholder when it is missing.

```yaml
links:
  github: https://github.com/Debojyoti17/leafscope   # shown as "Code" with the GitHub mark
  paper: https://example.com/leafscope.pdf            # shown as "Paper"
  demo: https://leafscope.example.com                 # shown as "Demo"
  other:                                              # optional extra links
    - { label: Slides, url: https://example.com/slides }
```

**Cover image:** put the file in `src/assets/projects/` and set
`cover: ../../assets/projects/my-project.jpg` and `coverAlt: "describe it"`. It appears on the project page,
and on touch screens it replaces the project's inline specimen in the lists.

**Research areas:** edit `interests` in `site.config.ts` (a title and one sentence each). Each area is a
heading in "Research & projects" (home page and Work page) with its projects listed underneath.

## Add a note (blog post)

1. Turn on `notes: true` in `features` in `site.config.ts`.
2. Copy `src/content/notes/_example.md` to `src/content/notes/my-note.md` and write.

The Notes page, nav link and home section stay hidden until at least one published note exists.
Add `draft: true` to keep a note private.

## Add a timeline entry

1. Turn on `timeline: true`.
2. Copy `src/content/timeline/_example.md` to a new file, e.g. `research-intern.md`.

Leave out `end` for “present”. Your education is already there (`education.md`) and always shows in About.

## Add a publication

Turn on `publications: true`, then copy `src/content/publications/_example.md`.

## Add your CV

Put a file called **`cv.pdf`** in `public/`. “Download CV” buttons (hero, about, contact, footer) appear
automatically. Delete the file and they disappear.

## Add your photo

Put **`profile.jpg`** in `public/images/` (portrait, roughly 4:5, at least 880 × 1100 px). The About
plate switches from the typographic card to your photo, in black and white with colour on hover.
No other change is needed.

## Add a homepage section

1. Create `src/sections/Awards.astro`. Look at `src/sections/Stack.astro` for the smallest example. Wrap
   the markup in `{condition && (…)}` so the section disappears when it has nothing to show.
2. Add `'awards'` to `homeSections` in `site.config.ts` (the id is the lower-case file name).

Give the `<section>` an `id` and `aria-labelledby`, and add `data-reveal` to the blocks that should rise into
view (the site's single entrance animation). Use `SectionHead` for the label + title + hairline header.

## Switch modules on and off

In `site.config.ts`:

```ts
export const features = {
  notes: false,        // /notes/ + nav + home section
  publications: false, // publications list
  timeline: false,     // resume timeline
  githubGraph: false,  // GitHub contribution graph, fetched at build time (hides itself on failure)
  contactForm: false,  // contact form in the footer's contact block (see below)
  workFilters: false,  // topic / type / stage filters on /work/ (for when there are many projects)
};
```

A module appears only when its flag is on **and** it has content. Nothing says “coming soon”.

**Work filters:** with `workFilters: true` the Work page becomes one filterable list (topic, type, stage)
instead of the grouping by research area. Leave it off while there are only a few projects.

**Contact form:** with the flag on and `contactForm.action` empty, the form opens the visitor’s mail
app. To use a form service (Formspree, Basin, …), paste its endpoint into `contactForm.action`.

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` builds and deploys on every push to `main`.

1. In the repository go to **Settings → Pages → Build and deployment → Source: GitHub Actions** (once).
2. Push to `main`.

Two repository variables (Settings → Secrets and variables → Actions → Variables) control the address.
Both are optional:

| Variable | Default | When moving to `https://debojyoti17.github.io/` |
| --- | --- | --- |
| `SITE_URL` | `https://debojyoti17.github.io` | unchanged |
| `BASE_PATH` | `/portfolio-v2/` | `/` |
| `NOINDEX` | `true` unless `BASE_PATH` is `/` | leave empty |

While the base path is not `/`, every page carries `<meta name="robots" content="noindex">` and
`robots.txt` disallows crawling. On the root site both flip automatically and a sitemap is generated.

Locally you can emulate the root site with:

```bash
BASE_PATH=/ npm run build && npm run preview
```

## Project layout

```
site.config.ts            all everyday settings
src/content/              Markdown content (projects, notes, timeline, publications)
src/sections/             homepage sections (one component each)
src/components/           shared UI (Nav, Footer, Icon, …)
src/pages/                routes (home, work, about, notes, 404, og images, robots)
src/styles/               tokens.css (design tokens) + plain CSS
src/scripts/              client code: ui (theme, menu, anchors), motion (Lenis + entrances), cursor, continuity (page-to-page pairing)
src/scripts/stage/       the particle fields: engine.ts (physics), gl.ts (renderers), stage.ts (which field goes where), scenes, behaviours
src/assets/fonts, icons   self-hosted fonts and SVG icons, with licences
public/                   cv.pdf, images/profile.jpg, favicon
scripts/                  screenshots, Lighthouse, link and contrast checks
```

## Licences of what is bundled

Astro (MIT), Lenis (MIT), the Simple Icons GitHub mark (CC0),
Doto, Instrument Sans and IBM Plex Mono (SIL OFL 1.1), Material Symbols Sharp icons (Apache-2.0).
Full texts for fonts and icons are in `src/assets/fonts/licenses/` and `src/assets/icons/`.
