import { defineCollection, z } from 'astro:content';
import { obpubLoader } from '@noteforge/astro';
import obpubConfig from '../obsidian-blog.config.ts';

const notes = defineCollection({
  loader: obpubLoader(obpubConfig),
  schema: z
    .object({
      title: z.string().optional(),
      frontmatter: z.record(z.unknown()),
      tags: z.array(z.string()),
      backlinks: z.array(z.string()),
    })
    .strict(),
});

export const collections = { notes };
