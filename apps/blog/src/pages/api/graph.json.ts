import type { APIRoute } from 'astro';
import { getPipelineResult } from '../../lib/pipelineCache.ts';

export const prerender = true;

export const GET: APIRoute = async () => {
  const result = await getPipelineResult();
  const payload = {
    nodes: result.publicGraph.nodes,
    edges: result.publicGraph.edges,
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
