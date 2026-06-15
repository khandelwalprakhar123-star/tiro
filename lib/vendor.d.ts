// Ambient type for ffprobe-static, which ships no bundled declarations.
// It default-exports an object whose `path` is the absolute path to the
// platform's ffprobe binary.
declare module "ffprobe-static" {
  const ffprobe: { path: string };
  export default ffprobe;
}
