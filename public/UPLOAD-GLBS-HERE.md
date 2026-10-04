# Architectural model upload rules

Upload approved files into `public/models/architecture/` in the HALISIA repository.

Every model must:

1. Be a `.glb` file.
2. Have a traceable licence and source URL in `architectural-model-manifest.csv`.
3. Use real authored dimensions in metres.
4. Be 15 MB or smaller where possible; 25 MB is the hard ceiling.
5. Prefer 200,000 triangles or fewer and 12 materials or fewer.
6. Use compressed textures of 2048 px or less for mobile performance.
7. Place its ground floor at Y=0 and use Y-up orientation.
8. Open successfully in https://gltf.report/ before admission.

Never mark a row `admitted` until licence, dimensions, file size and rendering have been checked.

Suggested free tools:

- Blender: modelling, cleanup, decimation and GLB export.
- glTF Report: browser-based validation and inspection.
- gltf-transform: texture and mesh optimization.
- Poly Haven: CC0 textures and HDRIs.
- ambientCG: CC0 materials and textures.
- Sketchfab: only assets whose individual licence allows the intended use.
