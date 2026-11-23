# Credits & asset provenance

## Reference

- **Papertrails** by Shikhar — https://github.com/xikhar/papertrails — MIT License.
  Used as a visual/technical reference for the pop-up book direction. The local
  `REFERENCE/` checkout is not part of the build and is excluded from git. This
  project's source code is an original implementation; no upstream source files
  are imported by `src/`.
- The multi-piece 3D houses and arch bridge are extracted at runtime from Papertrails'
  `tiles.glb` (MIT): the `house__house_*`, `village__cottage_a_*`,
  `village__house_w_*` and `bridge__*` nodes (bridge base excluded). The asset is
  copied to `public/models/tiles.glb` and credited here under the upstream MIT license.
- The house roof/wall/door artwork is sampled from Papertrails'
  `textures/art/atlas.webp` (MIT) via glTF `TEXCOORD_1`
  (`public/textures/art/atlas.webp`).

## Runtime libraries

- **three.js** — MIT License.
- **Vite** — MIT License.
- TypeScript / @types/three — Apache-2.0 / MIT.

## Generated assets

- Concept frames, paper textures and all 23 prop stickers were generated locally
  with **ComfyUI** using the **FLUX.1 [dev]** weights installed on this machine.
- ComfyUI is used as a tool only; it is not redistributed with this project.
- **FLUX.1 [dev] is released under a non-commercial license.** If this project is
  going to be sold or used commercially, either obtain a commercial license from
  Black Forest Labs, or regenerate the assets with a commercially licensed model
  (for example FLUX.1 [schnell], Apache-2.0) and rebuild the atlas with
  `tools/atlas/build_atlas.py`. Treat this as a release blocker until resolved.
- The final stickers were keyed with `tools/atlas/build_atlas.py` (white/grey
  flood fill). Adobe Photoshop was used only for a one-off pipeline test; it is
  not required to rebuild the assets.
- Generated artwork is original output from the local prompts in
  `tools/comfy/prompts.*.json`; no third-party brand assets, characters or
  stock illustrations are included.

## Fonts / UI

- No webfont files are bundled. The hint uses the system serif stack
  (Georgia / Times New Roman).
