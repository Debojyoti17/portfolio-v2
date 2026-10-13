import { getCollection, type CollectionEntry } from 'astro:content';
import { features } from '@site';
import { VISUALS } from '../content.config';
import { hashString } from './hash';

export type Project = CollectionEntry<'projects'>;
export type Note = CollectionEntry<'notes'>;
export type TimelineEntry = CollectionEntry<'timeline'>;
export type Publication = CollectionEntry<'publications'>;
export type Visual = (typeof VISUALS)[number];

export async function getProjects(): Promise<Project[]> {
  const all = await getCollection('projects', (p) => !p.data.draft);
  return all.sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title));
}

export async function getFeaturedProjects(): Promise<Project[]> {
  const all = await getProjects();
  const featured = all.filter((p) => p.data.featured);
  return featured.length ? featured : all.slice(0, 4);
}

/** The interactive visual that represents a project (same on its card and its page). */
export function projectVisual(p: Project): Visual {
  return p.data.visual ?? VISUALS[hashString(p.id) % VISUALS.length];
}

/** "Research project · In progress" */
export function projectLine(p: Project): string {
  return [p.data.type, p.data.stage].filter(Boolean).join(' · ');
}

export async function getNotes(): Promise<Note[]> {
  if (!features.notes) return [];
  const all = await getCollection('notes', (n) => !n.data.draft);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getTimeline(opts: { force?: boolean } = {}): Promise<TimelineEntry[]> {
  if (!features.timeline && !opts.force) return [];
  const all = await getCollection('timeline');
  return all.sort((a, b) => b.data.start.localeCompare(a.data.start));
}

export async function getEducation(): Promise<TimelineEntry[]> {
  const all = await getTimeline({ force: true });
  return all.filter((e) => e.data.kind === 'education');
}

export async function getPublications(): Promise<Publication[]> {
  if (!features.publications) return [];
  const all = await getCollection('publications');
  return all.sort((a, b) => b.data.year - a.data.year);
}

export function formatPeriod(e: TimelineEntry['data']): string {
  const end = e.end ?? 'Present';
  return `${e.start} – ${end}${e.endNote ? ` (${e.endNote})` : ''}`;
}

/** Unique values with counts, in order of first appearance. */
export function countBy<T>(items: T[], pick: (t: T) => string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) for (const v of pick(it)) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()];
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
