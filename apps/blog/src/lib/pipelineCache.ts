import { runCorePipeline, type PipelineResult } from '@noteforge/core/pipeline';
import obpubConfig from '../../noteforge.config.ts';

let cached: Promise<PipelineResult> | undefined;

export function getPipelineResult(): Promise<PipelineResult> {
  if (cached === undefined) {
    cached = runCorePipeline(obpubConfig);
  }
  return cached;
}
