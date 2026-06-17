"use client";

// Client-side audio preparation — runs ENTIRELY in the uploader's browser, the
// way WhatsApp computes a voice-note waveform on the sender's device. No server
// compute, no ffmpeg.
//
// It does two things in one decode:
//   1. Computes the waveform "peaks" — ~56 bar heights describing the real
//      amplitude envelope, stored later as data-peaks on the figure so every
//      viewer renders the bars instantly (a few hundred bytes, no DB change).
//   2. Enforces a ~60s cap. If the clip is already ≤60s we upload the ORIGINAL
//      file untouched (lossless, smallest). If it's longer we keep only the first
//      60s and re-encode that slice to WAV (dependency-free) for upload.
//
// We decode at a reduced 22.05 kHz sample rate: peaks don't need hi-fi, and it
// bounds memory if someone drops in a long file (the 50 MB bucket cap is the
// other guard).

export const AUDIO_CAP_SECONDS = 60;
export const WAVE_BARS = 56;
const DECODE_RATE = 22050;

export type PreparedAudio = {
  blob: Blob; // what to upload: the original File (≤cap) or a trimmed WAV (>cap)
  ext: string; // file extension for the storage path
  contentType: string;
  peaks: number[]; // WAVE_BARS ints in 0..100 — bar heights
  duration: number; // seconds, after any trim
  trimmed: boolean; // true if we cut it down to the cap
};

// Pick a sensible file extension for the storage path.
function extFor(file: File): string {
  const fromName = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase()
    : "";
  if (fromName && fromName.length <= 5) return fromName;
  const sub = (file.type.split("/")[1] || "bin").toLowerCase();
  // Normalise a couple of common ones.
  if (sub === "mpeg") return "mp3";
  if (sub === "x-m4a" || sub === "mp4") return "m4a";
  return sub;
}

// decodeAudioData detaches the ArrayBuffer it's given, so callers that still
// need the bytes must pass a copy. We don't reuse them here, so it's fine.
async function decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const Ctx: typeof OfflineAudioContext =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  // 1 channel / length / rate are just placeholders for a decode-only context;
  // decodeAudioData resamples the result to DECODE_RATE.
  const ctx = new Ctx(1, 1, DECODE_RATE);
  return await ctx.decodeAudioData(arrayBuffer);
}

// Reduce the (possibly multi-channel) buffer to WAVE_BARS bar heights. We average
// channels to a mono envelope, take each block's peak amplitude, then normalise so
// the loudest bar is 100. `frames` lets us measure only the kept (trimmed) span.
function computePeaks(buffer: AudioBuffer, frames: number): number[] {
  const chans = buffer.numberOfChannels;
  const data: Float32Array[] = [];
  for (let c = 0; c < chans; c++) data.push(buffer.getChannelData(c));

  const n = Math.min(frames, buffer.length);
  const block = Math.max(1, Math.floor(n / WAVE_BARS));
  const peaks: number[] = [];
  let max = 0;
  for (let b = 0; b < WAVE_BARS; b++) {
    const start = b * block;
    const end = Math.min(start + block, n);
    let peak = 0;
    for (let i = start; i < end; i++) {
      let sum = 0;
      for (let c = 0; c < chans; c++) sum += data[c][i];
      const amp = Math.abs(sum / chans);
      if (amp > peak) peak = amp;
    }
    peaks.push(peak);
    if (peak > max) max = peak;
  }
  // Normalise to 0..100; guard a fully-silent clip (max 0).
  const scale = max > 0 ? 100 / max : 0;
  return peaks.map((p) => Math.round(p * scale));
}

// Minimal 16-bit PCM WAV encoder for the first `frames` of a buffer. No deps.
function encodeWav(buffer: AudioBuffer, frames: number): Blob {
  const chans = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const n = Math.min(frames, buffer.length);
  const bytesPerSample = 2;
  const blockAlign = chans * bytesPerSample;
  const dataSize = n * blockAlign;

  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  // RIFF/WAVE header.
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, chans, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave channels, clamp float [-1,1] → int16.
  const channels: Float32Array[] = [];
  for (let c = 0; c < chans; c++) channels.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < chans; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([out], { type: "audio/wav" });
}

export async function prepareAudio(file: File): Promise<PreparedAudio> {
  const buffer = await decode(await file.arrayBuffer());
  const duration = buffer.duration;

  if (duration <= AUDIO_CAP_SECONDS + 0.25) {
    // Short enough — keep the original file as-is (best quality + smallest).
    return {
      blob: file,
      ext: extFor(file),
      contentType: file.type || "application/octet-stream",
      peaks: computePeaks(buffer, buffer.length),
      duration,
      trimmed: false,
    };
  }

  // Too long — keep only the first AUDIO_CAP_SECONDS, re-encoded to WAV.
  const capFrames = Math.floor(AUDIO_CAP_SECONDS * buffer.sampleRate);
  return {
    blob: encodeWav(buffer, capFrames),
    ext: "wav",
    contentType: "audio/wav",
    peaks: computePeaks(buffer, capFrames),
    duration: AUDIO_CAP_SECONDS,
    trimmed: true,
  };
}
