import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** Interactive visuals a project can use (one per project, shown on its card and its page). */
export const VISUALS = ['leaf', 'ghost', 'graph', 'network', 'tree'] as const;

/** What kind of project it is. */
export const TYPES = ['Research project', 'Team project', 'Course project'] as const;
/** How far along it is. Optional: leave out when unknown. */
export const STAGES = ['In progress', 'Early stage', 'Completed'] as const;
/** Controlled list of topic tags (max 2 per project). Add to it when you need a new one. */
export const TAGS = [
  'Computer vision',
  'Self-supervised learning',
  '3D Gaussian Splatting',
  'Privacy',
  'Multi-agent AI',
  'Agent frameworks',
  'Fault tolerance',
  'Language models',
  'AI agents',
  'Linux',
  'Web',
  'Mobile',
] as const;

// Files whose names start with "_" are ignored (use them as copy-able templates).
const pattern = '**/[^_]*.{md,mdx}';

const projects = defineCollection({
  loader: glob({ pattern, base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      type: z.enum(TYPES),
      stage: z.enum(STAGES).optional(),
      /** Research area it is grouped under on the Work page; must match a title in `interests` (site.config.ts). */
      area: z.string().optional(),
      summary: z.string(),
      tags: z.array(z.enum(TAGS)).max(2).default([]),
      role: z.string().optional(),
      links: z
        .object({
          github: z.string().url().optional(),
          paper: z.string().url().optional(),
          demo: z.string().url().optional(),
          other: z.array(z.object({ label: z.string(), url: z.string().url() })).optional(),
        })
        .optional(),
      /** Optional cover image, e.g. ../../assets/projects/leafscope.jpg */
      cover: image().optional(),
      coverAlt: z.string().optional(),
      featured: z.boolean().default(false),
      /** Lower numbers first. */
      order: z.number().default(100),
      /** Which interactive visual represents this project. Derived from the slug when omitted. */
      visual: z.enum(VISUALS).optional(),
      /** Optional free-form facts for the project sheet, e.g. [{label:'Language', value:'Python'}] */
      facts: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
      draft: z.boolean().default(false),
    }),
});

const notes = defineCollection({
  loader: glob({ pattern, base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const timeline = defineCollection({
  loader: glob({ pattern, base: './src/content/timeline' }),
  schema: z.object({
    title: z.string(),
    org: z.string(),
    kind: z.enum(['education', 'experience', 'research', 'award', 'other']).default('other'),
    /** "2024" or "2024-08" */
    start: z.string(),
    /** Omit for "present". For education write e.g. "2028" and set endNote. */
    end: z.string().optional(),
    /** Small note after the end date, e.g. "expected". */
    endNote: z.string().optional(),
    location: z.string().optional(),
    summary: z.string().optional(),
  }),
});

const publications = defineCollection({
  loader: glob({ pattern, base: './src/content/publications' }),
  schema: z.object({
    title: z.string(),
    authors: z.array(z.string()),
    venue: z.string(),
    year: z.number(),
    status: z.string().optional(),
    links: z
      .object({
        paper: z.string().url().optional(),
        code: z.string().url().optional(),
        doi: z.string().url().optional(),
      })
      .optional(),
  }),
});

export const collections = { projects, notes, timeline, publications };
