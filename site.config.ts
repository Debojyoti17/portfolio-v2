/**
 * site.config.ts — the one file to edit for everyday changes.
 *
 * Name, tagline, contact and social links, feature flags and the order of the
 * homepage sections all live here. See README.md for recipes.
 */

export interface NavItem {
  label: string;
  href: string;
  /** One line under the label in the mobile menu. */
  description?: string;
  /** Show only when this feature flag is on (and it has content). */
  feature?: keyof typeof features;
}

/** Optional modules. Everything here is OFF by default and hides itself when empty. */
export const features = {
  notes: false, // /notes/ + nav link + home section (needs ≥ 1 post in src/content/notes)
  publications: false, // publications list (needs ≥ 1 entry in src/content/publications)
  timeline: false, // resume timeline (needs ≥ 1 entry in src/content/timeline)
  githubGraph: false, // GitHub contribution graph, fetched at build time
  contactForm: false, // contact form in the contact section (see `contactForm` below)
  workFilters: false, // topic / type / stage filters on /work/ (switch on when there are many projects)
} as const;

export const siteConfig = {
  name: 'Debojyoti Barai Mitul',
  /** Used for the wordmark and the OG image monogram. */
  initials: 'DBM',
  tagline:
    'B.Tech Computer Science student working on machine learning, multi-agent AI systems and web development.',
  description:
    'Portfolio of Debojyoti Barai Mitul, a B.Tech Computer Science student at VIT Vellore working on machine learning, multi-agent AI systems and web development.',
  /** One-line status shown in the hero. Leave empty to hide. */
  status: 'Third-year B.Tech CSE · VIT Vellore',
  /** Shown as a small readout in the footer. Remove the object to hide. */
  place: { label: 'Vellore', lat: 12.9165, lon: 79.1325, timeZone: 'Asia/Kolkata' },

  /** Public contact. Only the email is rendered as a large link. */
  email: 'mituldip90@gmail.com',

  /**
   * Social links. An empty string means "not shown anywhere". Fill one in and
   * it appears in the contact section and footer automatically.
   */
  social: {
    github: 'https://github.com/Debojyoti17',
    linkedin: '',
    x: '',
    scholar: '',
    orcid: '',
    huggingface: '',
    kaggle: '',
  } as Record<string, string>,

  /** GitHub account for the contribution graph (feature flag `githubGraph`). */
  githubUser: 'Debojyoti17',

  /** Contact form (feature flag `contactForm`). Paste a provider endpoint here
   *  (Formspree, Basin, Getform …). Left empty, the form opens the visitor's mail app. */
  contactForm: { action: '' },

  /** Header navigation. Items with `feature` appear only when that module is on and non-empty. */
  nav: [
    { label: 'Work', href: '/work/', description: 'Research and projects' },
    { label: 'About', href: '/about/', description: 'Background, education and skills' },
    { label: 'Notes', href: '/notes/', description: 'Writing', feature: 'notes' },
  ] as NavItem[],

  /**
   * Homepage sections, in order. Each id is the file name of a component in
   * src/sections (lower-case): 'hero' → src/sections/Hero.astro.
   * Add a section = create the component + add one line here.
   * Sections with nothing to show render nothing and disappear on their own.
   */
  homeSections: ['hero', 'research', 'about', 'stack', 'timeline', 'publications', 'notes', 'github'],

  /** About text. Paragraphs are rendered in order. */
  bio: [
    'I am a third-year B.Tech Computer Science and Engineering student at VIT Vellore.',
    'My research interests are computer vision, self-supervised learning and reliable multi-agent AI. I also build web and mobile apps.',
  ],

  /**
   * Research areas. Each is a heading with one sentence, and its projects sit underneath it
   * (home "Research & projects" and the Work page).
   * A project joins an area through `area:` in its front matter (must match a `title` here).
   */
  interests: [
    {
      title: 'Computer vision',
      note: 'Privacy and unlearning in 3D Gaussian Splatting.',
    },
    {
      title: 'Self-supervised learning',
      note: 'Agricultural pretraining and feature distillation for crop-disease recognition.',
    },
    {
      title: 'Reliable multi-agent AI',
      note: 'Extending MAST to LangGraph and CrewAI, and testing fault tolerance with small local language models.',
    },
  ],

  /** Skills, grouped. Rendered as a specification sheet. */
  skills: [
    { group: 'Languages', items: ['Python', 'JavaScript', 'Dart', 'SQL'] },
    { group: 'Web', items: ['React', 'Next.js', 'Node.js', 'RESTful APIs', 'Three.js'] },
    { group: 'Mobile', items: ['Flutter'] },
    { group: 'Databases', items: ['PostgreSQL', 'MongoDB'] },
    { group: 'ML & AI', items: ['TensorFlow', 'Keras', 'Matplotlib', 'LangChain', 'RAG'] },
  ],

  /** Files the build looks for in /public. Missing files simply hide the related UI. */
  files: { cv: 'cv.pdf', profile: 'images/profile.jpg' },
};

export type SiteConfig = typeof siteConfig;
