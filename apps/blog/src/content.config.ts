import { defineCollection, z } from 'astro:content';
import { obpubLoader } from '@noteforge/astro';
import obpubConfig from '../obsidian-blog.config.ts';

const noteSchema = z
  .object({
    kind: z.literal('note'),
    title: z.string().optional(),
    frontmatter: z.record(z.unknown()),
    tags: z.array(z.string()),
    backlinks: z.array(z.string()),
    heroImage: z.string().optional(),
    thumbnailImage: z.string().optional(),
    embeddedImages: z.array(z.string()).optional(),
    sourcePath: z.string().optional(),
  })
  .strict();

const aliasRedirectSchema = z
  .object({
    kind: z.literal('alias-redirect'),
    to: z.string(),
  })
  .strict();

const notes = defineCollection({
  loader: obpubLoader(obpubConfig),
  schema: z.discriminatedUnion('kind', [noteSchema, aliasRedirectSchema]),
});

export const collections = { notes };
