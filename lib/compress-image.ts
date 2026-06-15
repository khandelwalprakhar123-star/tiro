// Client-side image compression.
//
// We do this in the BROWSER before uploading so that (a) we never ship Vercel's
// paid image optimization, and (b) we keep Supabase storage + egress small to
// stay on the free tier. Strategy: decode → scale the longest edge down to a
// sane max → re-encode as lossy WebP at ~80% quality. A multi-MB phone photo
// typically lands at a few hundred KB with no visible loss at document size.

export type CompressedImage = {
  blob: Blob;
  width: number;
  height: number;
};

const MAX_EDGE = 1600; // px — longest side; nobody needs more inside a doc
const QUALITY = 0.8; // WebP quality (0–1). Our agreed lossy floor.

export async function compressImage(file: File): Promise<CompressedImage> {
  // createImageBitmap decodes efficiently off the main flow; "from-image"
  // bakes in EXIF orientation so rotated phone photos come out upright.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", QUALITY),
  );
  if (!blob) throw new Error("Image compression failed (toBlob returned null)");

  return { blob, width, height };
}
