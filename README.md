# Debojyoti Barai Mitul — portfolio

A static site built with [Astro](https://astro.build), plain CSS, and a small amount of TypeScript.
It has a 3D point-cloud hero (Three.js), smooth scrolling, light and dark themes, and no analytics,
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
```

## The one file you edit most: `site.config.ts`

Everything everyday lives here: your name, tagline, bio, email, social links, skills, the three research
focus lines, the navigation, **feature flags** and the **order of homepage sections**.

* **Social link**: put the URL in `social` (for example `linkedin: 'https://…'`). Empty ones are never
  shown. It then appears in the contact section and footer automatically.
* **Reorder or remove a homepage section**: edit `homeSections`. Delete a name to hide that section.

## Add a project

1. Copy `src/content/projects/_example.md` to `src/content/projects/my-project.md`
   (the file name becomes the URL: `/work/my-project/`).
2. Fill in the front matter. Only `title`, `status`, `summary` are required.
3. Write the description in Markdown under the second `---`.

Optional fields (`links.github`, `links.paper`, `links.demo`, `role`, `cover`, `facts`) show up only when
you fill them in. `featured: true` puts the project on the home page. `order` sorts (lower first).
`form` chooses the 3D shape that represents the project: `scene`, `leaf`, `graph`, `erase`, `tree`
or `grid`.

**Cover image:** put the file in `src/assets/projects/` and set
`cover: ../../assets/projects/my-project.jpg` and `coverAlt: "describe it"`. It is optimised at build time.

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

Optional attributes on the `<section>`:

| Attribute | Meaning |
| --- | --- |
| `data-numbered` | gets the next index number (`03`) in its header |
| `data-label="Awards"` | name shown in the scroll readout |
| `data-form="graph"` | 3D shape shown while this section is on screen |
| `data-sx`, `data-so` | horizontal offset (−1…1) and opacity (0…1) of the 3D field there |

## Switch modules on and off

In `site.config.ts`:

```ts
export const features = {
  notes: false,        // /notes/ + nav + home section
  publications: false, // publications list
  timeline: false,     // resume timeline
  githubGraph: false,  // GitHub contribution graph, fetched at build time (hides itself on failure)
  contactForm: false,  // contact form (see below)
};
```

A module appears only when its flag is on **and** it has content. Nothing says “coming soon”.

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
src/scripts/              client code: ui, motion (Lenis + GSAP), stage (Three.js)
src/scripts/stage/forms.ts  the 3D shapes (also used for static SVG fallbacks)
src/assets/fonts, icons   self-hosted fonts and SVG icons, with licences
public/                   cv.pdf, images/profile.jpg, favicon
scripts/                  screenshots, Lighthouse, link and contrast checks
```

## Licences of what is bundled

Astro (MIT), Three.js (MIT), Lenis (MIT), GSAP and ScrollTrigger (GSAP “Standard no-charge” licence),
Doto, Instrument Sans and IBM Plex Mono (SIL OFL 1.1), Material Symbols Sharp icons (Apache-2.0).
Full texts for fonts and icons are in `src/assets/fonts/licenses/` and `src/assets/icons/`.
