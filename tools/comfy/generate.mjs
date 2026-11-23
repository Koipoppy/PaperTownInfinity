// Minimal ComfyUI API driver for the local Flux.1-dev fp8 setup.
// Usage: node tools/comfy/generate.mjs <prompts.json> <outDir>
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const COMFY = process.env.COMFY_URL ?? 'http://127.0.0.1:8188';
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('usage: node generate.mjs <prompts.json> <outDir>');
  process.exit(1);
}
const [promptsPath, outDirArg] = args;
const outDir = resolve(outDirArg);
await mkdir(outDir, { recursive: true });

const spec = JSON.parse(await (await import('node:fs/promises')).readFile(resolve(promptsPath), 'utf8'));
const defaults = {
  width: 1216,
  height: 832,
  steps: 28,
  cfg: 1.0,
  guidance: 3.5,
  sampler: 'euler',
  scheduler: 'simple',
  negative: 'text, watermark, signature, logo, letters, frame, border, photorealistic human, plastic, glossy, CGI, oversaturated, cluttered, deformed',
  ...spec.defaults,
};

function workflowFor(p) {
  const w = p.width ?? defaults.width;
  const h = p.height ?? defaults.height;
  return {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: 'flux1-dev-fp8.safetensors', weight_dtype: 'default' } },
    '2': {
      class_type: 'DualCLIPLoader',
      inputs: { clip_name1: 't5xxl_fp16.safetensors', clip_name2: 'clip_l.safetensors', type: 'flux' },
    },
    '3': { class_type: 'VAELoader', inputs: { vae_name: 'ae.safetensors' } },
    '4': { class_type: 'CLIPTextEncode', inputs: { text: p.prompt, clip: ['2', 0] } },
    '5': { class_type: 'CLIPTextEncode', inputs: { text: p.negative ?? defaults.negative, clip: ['2', 0] } },
    '6': { class_type: 'EmptyLatentImage', inputs: { width: w, height: h, batch_size: 1 } },
    '7': { class_type: 'FluxGuidance', inputs: { conditioning: ['4', 0], guidance: p.guidance ?? defaults.guidance } },
    '8': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0],
        positive: ['7', 0],
        negative: ['5', 0],
        latent_image: ['6', 0],
        seed: p.seed ?? 1,
        steps: p.steps ?? defaults.steps,
        cfg: p.cfg ?? defaults.cfg,
        sampler_name: p.sampler ?? defaults.sampler,
        scheduler: p.scheduler ?? defaults.scheduler,
        denoise: 1.0,
      },
    },
    '9': { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] } },
    '10': { class_type: 'SaveImage', inputs: { images: ['9', 0], filename_prefix: `popup_atlas/${p.id}` } },
  };
}

async function submit(p) {
  const res = await fetch(`${COMFY}/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: workflowFor(p), client_id: 'popup-atlas-tools' }),
  });
  if (!res.ok) throw new Error(`POST /prompt ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.node_errors && Object.keys(json.node_errors).length) {
    throw new Error(`node errors: ${JSON.stringify(json.node_errors)}`);
  }
  return json.prompt_id;
}

async function waitFor(promptId, id, timeoutMs = 20 * 60 * 1000) {
  const start = Date.now();
  let lastLog = 0;
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${COMFY}/history/${promptId}`);
    if (res.ok) {
      const json = await res.json();
      const entry = json[promptId];
      if (entry?.outputs) {
        const images = entry.outputs['10']?.images ?? [];
        if (images.length) return images[0];
      }
      if (entry?.status?.status_str === 'error') {
        throw new Error(`generation failed: ${JSON.stringify(entry.status)}`);
      }
    }
    if (Date.now() - lastLog > 15000) {
      lastLog = Date.now();
      console.log(`[${id}] waiting... ${Math.round((Date.now() - start) / 1000)}s`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`[${id}] timed out`);
}

async function download(image, id) {
  const url = `${COMFY}/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(
    image.subfolder ?? '',
  )}&type=${image.type ?? 'output'}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const outPath = join(outDir, `${id}.png`);
  await writeFile(outPath, buf);
  console.log(`[${id}] saved ${outPath} (${(buf.length / 1024).toFixed(0)} KB)`);
}

const items = spec.prompts;
console.log(`generating ${items.length} image(s) -> ${outDir}`);
for (const p of items) {
  const id = p.id ?? basename(promptsPath, '.json');
  const t0 = Date.now();
  const promptId = await submit({ ...p, id });
  console.log(`[${id}] queued ${promptId}`);
  const image = await waitFor(promptId, id);
  await download(image, id);
  console.log(`[${id}] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
console.log('all done');
