import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export type Project = CollectionEntry<'projects'>;
export type Entry = CollectionEntry<'entries'> & {
  projectId: string;
  slug: string;
  href: string;
};

// Prefix a site path with the base path (needed when the site is not at the domain root).
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (path: string) => `${base}${path}`;

export const formatDate = (date: Date) =>
  date.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

// Newest project first.
export async function getProjects(): Promise<Project[]> {
  const projects = await getCollection('projects');
  return projects.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

// Newest entry first. Drafts are visible while developing, hidden in the published site.
export async function getEntries(): Promise<Entry[]> {
  const entries = await getCollection('entries', ({ data }) => import.meta.env.DEV || !data.draft);
  const projectIds = new Set((await getCollection('projects')).map((project) => project.id));

  return entries
    .map((entry) => {
      const [projectId, ...rest] = entry.id.split('/');
      if (!projectIds.has(projectId)) {
        throw new Error(
          `Entry "${entry.id}" sits in a folder named "${projectId}", but there is no project file src/content/projects/${projectId}.md`,
        );
      }
      const slug = rest.join('/');
      return { ...entry, projectId, slug, href: url(`/projects/${projectId}/${slug}/`) };
    })
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

// Group entries by a label, keeping groups in alphabetical order.
export function groupBy(entries: Entry[], labels: (entry: Entry) => string[]) {
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) {
    for (const label of labels(entry)) {
      groups.set(label, [...(groups.get(label) ?? []), entry]);
    }
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}