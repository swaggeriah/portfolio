import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { blocksSchema, pageSchema } from './lib/blocks';

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
      // Optional colours for the title bar's vertical gradient (top and bottom).
      // Any CSS colour works. Put hex colours in quotes: gradientTop: "#e8590c"
      gradientTop: z.string().optional(),
      gradientBottom: z.string().optional(),
      // Page layout (see src/lib/blocks.ts). Both are edited in the /admin editor.
      page: pageSchema,
      blocks: blocksSchema,
    }),
});

// One small file per category: src/content/categories/<category>.md
// Entries pick their categories from these (see the "categories" line in an entry).
const categories = defineCollection({
  loader: glob({ base: './src/content/categories', pattern: '*.md' }),
  schema: z.object({
    title: z.string(),
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
      // File names of categories, e.g. categories: [animation, visual-effects]
      categories: z.array(z.string()).default([]),
      // Older single category (still understood): category: Animation
      category: z.string().optional(),
      keyPoints: z.array(z.string()).default([]),
      thumbnail: image().optional(),
      draft: z.boolean().default(false),
      // Leave empty to use the project's title bar colours.
      gradientTop: z.string().optional(),
      gradientBottom: z.string().optional(),
      page: pageSchema,
      blocks: blocksSchema,
    }),
});

export const collections = { projects, categories, entries };
