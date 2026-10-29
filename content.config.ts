import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// One file per project: src/content/projects/<project>.md
const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '*.md' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      date: z.coerce.date(),
      current: z.boolean().default(false),
      thumbnail: image(),
    }),
});

// One file per entry ("post"): src/content/entries/<project>/<entry>.md
// The folder name must match a project file name.
const entries = defineCollection({
  loader: glob({ base: './src/content/entries', pattern: '*/*.md' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string().optional(),
      date: z.coerce.date(),
      category: z.string().default('Other'),
      keyPoints: z.array(z.string()).default([]),
      thumbnail: image().optional(),
      draft: z.boolean().default(false),
    }),
});

export const collections = { projects, entries };