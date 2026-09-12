# KingCareer 3D assets

These GLB files are original Kenney assets, licensed CC0 1.0.

- [Car Kit](https://kenney.nl/assets/car-kit), downloaded 2026-09-12: sedan-sports, wheel-racing, cone and the required `Textures/colormap.png`.
- [Furniture Kit](https://kenney.nl/assets/furniture-kit), downloaded 2026-09-12: chairDesk, computerKeyboard, computerMouse, pottedPlant, lampRoundFloor, cabinetBedDrawer.

The original notices are in `car/License.txt` and `furniture/License.txt`.
`manifest.json` records the source URLs and SHA-256 hashes of the imported models.
All runtime URLs are local. Source archive downloads are kept in ignored `.local/`.

KingCareer normalizes model scale and clones materials at runtime to add surface reflections. Original GLBs are unmodified. The laboratory equipment, lifting platform, walls, signage and other geometry are authored in this repository. Scene lighting uses Three.js `RoomEnvironment`, not a downloaded HDRI.
