import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // ffmpeg-static / ffprobe-static ship native binaries. Opt them out of the
  // Server Components bundle so Next loads them via native Node `require` and
  // the binary paths they export remain valid at runtime (see the video
  // compression server action in lib/video-actions.ts).
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],
};

export default nextConfig;
