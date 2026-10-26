// Vite resolves these imports to a fingerprinted asset URL at build time. The
// declarations live here (and are pulled in by emblems.ts with a triple-slash
// reference) so every program that compiles this package - its own tsc and each
// app's - types them the same way without adopting all of vite/client.
declare module "*.webp" {
  const url: string;
  export default url;
}
declare module "*.svg" {
  const url: string;
  export default url;
}
