"use client";

// Font-colour toolbar control. The trigger is a capital "A" banded red/green/
// blue; clicking it opens a panel with two tabs:
//   • Choose — a 10×10 swatch grid (top row = black→white greyscale).
//   • Wheel  — a circular HSV wheel + brightness slider + HEX/RGB inputs and a
//              live preview square. Switching here also slides out an "Add"
//              panel of 16 custom slots: drag the preview square into an empty
//              slot to save it, right-click a filled slot to delete, left-click
//              to apply. Custom slots persist in localStorage.
//
// The control never touches the editor DOM itself — it snapshots the editor
// selection when it opens and restores it right before calling onPick(color),
// so typing in the HEX/RGB inputs (which steals focus) doesn't lose the text the
// user meant to colour. Applying mirrors the font-family controls exactly.

import { useCallback, useEffect, useRef, useState } from "react";

// ── Colour maths ─────────────────────────────────────────────────────────────
type RGB = { r: number; g: number; b: number };
type HSV = { h: number; s: number; v: number }; // h 0–360, s/v 0–1

function hsvToRgb({ h, s, v }: HSV): RGB {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function rgbToHsv({ r, g, b }: RGB): HSV {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

const toHex = ({ r, g, b }: RGB) =>
  "#" +
  [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");

function hexToRgb(hex: string): RGB | null {
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h))
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const hslToHex = (h: number, s: number, l: number) => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return toHex({
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  });
};

// ── The 10×10 "Choose" palette ───────────────────────────────────────────────
// Row 0: 10-step black→white greyscale gradient. Rows 1–9: hue across the
// columns, light→dark down the rows (row 5 ≈ pure colour).
const PALETTE: string[][] = Array.from({ length: 10 }, (_, row) =>
  Array.from({ length: 10 }, (_, col) => {
    if (row === 0) {
      const v = Math.round((col / 9) * 255);
      return toHex({ r: v, g: v, b: v });
    }
    const hue = col * 36; // 0,36,…,324
    const lightness = 0.92 - ((row - 1) / 8) * 0.78; // 0.92 → 0.14
    return hslToHex(hue, 0.85, lightness);
  }),
);

const SLOTS_KEY = "tiro:custom-colors";
const SLOT_COUNT = 16; // 8 wide × 2 tall

// Read persisted custom slots (client only; empty on the server / first paint).
function loadSlots(): (string | null)[] {
  if (typeof window === "undefined") return Array(SLOT_COUNT).fill(null);
  try {
    const arr = JSON.parse(localStorage.getItem(SLOTS_KEY) ?? "[]");
    if (Array.isArray(arr))
      return Array.from({ length: SLOT_COUNT }, (_, i) =>
        typeof arr[i] === "string" ? arr[i] : null,
      );
  } catch {
    /* corrupt storage → start empty */
  }
  return Array(SLOT_COUNT).fill(null);
}

const RGB_RE = /^[0-9]{0,3}$/;

// ── Component ─────────────────────────────────────────────────────────────────
export function FontColorControl({
  currentColor,
  onPick,
  getEditor,
}: {
  currentColor: string; // current selection's colour as #rrggbb, or ""
  onPick: (color: string) => void; // "" clears the inline colour
  getEditor: () => HTMLElement | null;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"choose" | "wheel">("choose");
  const [hsv, setHsv] = useState<HSV>({ h: 0, s: 1, v: 1 });
  const [slots, setSlots] = useState<(string | null)[]>(loadSlots);
  const [menu, setMenu] = useState<{ index: number; x: number; y: number } | null>(
    null,
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLCanvasElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const savedRange = useRef<Range | null>(null);

  const rgb = hsvToRgb(hsv);
  const hex = toHex(rgb);

  const persistSlots = useCallback((next: (string | null)[]) => {
    setSlots(next);
    try {
      localStorage.setItem(SLOTS_KEY, JSON.stringify(next));
    } catch {
      /* storage full / blocked → in-memory only */
    }
  }, []);

  // Close on outside click + Escape; also dismiss the right-click menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      // A click on the Delete menu itself must reach its onClick — don't treat
      // it as an outside click and unmount it first.
      if (menuRef.current?.contains(t)) return;
      setMenu(null);
      if (!rootRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Draw the HSV wheel (at full brightness) once it's mounted. Brightness is
  // applied as a CSS overlay so we don't redraw on every slider move.
  useEffect(() => {
    if (!open || tab !== "wheel") return;
    const canvas = wheelRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    const r = size / 2;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - r;
        const dy = y - r;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const i = (y * size + x) * 4;
        if (dist > r) {
          img.data[i + 3] = 0; // outside the circle → transparent
          continue;
        }
        let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (ang < 0) ang += 360;
        const { r: rr, g: gg, b: bb } = hsvToRgb({
          h: ang,
          s: Math.min(1, dist / r),
          v: 1,
        });
        img.data[i] = rr;
        img.data[i + 1] = gg;
        img.data[i + 2] = bb;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [open, tab]);

  // Snapshot the editor selection so we can restore it before applying (the
  // HEX/RGB inputs steal focus and collapse it otherwise).
  const snapshot = useCallback(() => {
    const editor = getEditor();
    const sel = window.getSelection();
    if (
      editor &&
      sel &&
      sel.rangeCount > 0 &&
      editor.contains(sel.anchorNode)
    ) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    } else {
      savedRange.current = null;
    }
  }, [getEditor]);

  const apply = useCallback(
    (color: string) => {
      const editor = getEditor();
      if (editor && savedRange.current) {
        editor.focus();
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(savedRange.current);
      }
      onPick(color);
    },
    [getEditor, onPick],
  );

  // Pick hue+saturation from a pointer position on the wheel.
  const pickFromWheel = useCallback((e: React.PointerEvent) => {
    const canvas = wheelRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const r = rect.width / 2;
    const dx = e.clientX - rect.left - r;
    const dy = e.clientY - rect.top - r;
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (ang < 0) ang += 360;
    const s = Math.min(1, Math.sqrt(dx * dx + dy * dy) / r);
    setHsv((prev) => ({ h: ang, s, v: prev.v }));
  }, []);

  const wheelPx = 240;
  const markerR = (wheelPx / 2) * hsv.s;
  const markerX = wheelPx / 2 + Math.cos((hsv.h * Math.PI) / 180) * markerR;
  const markerY = wheelPx / 2 + Math.sin((hsv.h * Math.PI) / 180) * markerR;

  const setFromRgb = (next: RGB) => setHsv(rgbToHsv(next));

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger — an "A" banded red/green/blue (sectioned evenly but cut at
          asymmetric heights), with a thin bar of the active colour beneath. */}
      <button
        type="button"
        title="Text colour"
        aria-label="Text colour"
        onMouseDown={(e) => {
          e.preventDefault();
          snapshot();
        }}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-11 min-w-11 items-center justify-center gap-0.5 rounded-lg px-2 transition-colors ${
          open ? "bg-ink text-paper" : "text-ink hover:bg-paper-deep"
        }`}
      >
        <span className="flex flex-col items-center leading-none">
          <span
            className="text-lg font-semibold"
            style={{
              background:
                "linear-gradient(180deg, #e5352b 0%, #e5352b 38%, #2aa532 38%, #2aa532 66%, #2f6fe0 66%, #2f6fe0 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            A
          </span>
          <span
            className="mt-0.5 h-[3px] w-5 rounded-full"
            style={{ background: currentColor || "currentColor" }}
          />
        </span>
        <span className="text-[8px] leading-none opacity-70">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 flex items-start gap-2">
          {/* Main panel: tabs + active tab body. Fixed width so it grows
              vertically (taller wheel), never horizontally. */}
          <div className="w-[16.5rem] rounded-lg border border-line bg-paper p-3 shadow-[0_12px_30px_-12px_rgba(33,28,20,0.55)]">
            <div className="mb-3 flex gap-1 border-b border-line">
              {(["choose", "wheel"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setTab(t)}
                  className={`-mb-px border-b-2 px-3 pb-1.5 text-sm capitalize transition-colors ${
                    tab === t
                      ? "border-ink font-medium text-ink"
                      : "border-transparent text-ink/50 hover:text-ink"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "choose" ? (
              <div>
                <div className="grid grid-cols-10 gap-1">
                  {PALETTE.flat().map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      title={c}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        apply(c);
                        setOpen(false);
                      }}
                      className="h-5 w-5 rounded-sm border border-black/10 transition-transform hover:scale-110"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    apply("");
                    setOpen(false);
                  }}
                  className="mt-3 w-full rounded-md border border-line px-2 py-1 text-xs text-ink/70 transition-colors hover:bg-paper-deep"
                >
                  Default colour
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                {/* Circular HSV wheel */}
                <div
                  className="relative cursor-crosshair touch-none"
                  style={{ width: wheelPx, height: wheelPx }}
                  onPointerDown={(e) => {
                    (e.target as HTMLElement).setPointerCapture(e.pointerId);
                    pickFromWheel(e);
                  }}
                  onPointerMove={(e) => {
                    if (e.buttons === 1) pickFromWheel(e);
                  }}
                >
                  <canvas
                    ref={wheelRef}
                    width={wheelPx}
                    height={wheelPx}
                    className="rounded-full"
                  />
                  {/* brightness darkening overlay */}
                  <div
                    className="pointer-events-none absolute inset-0 rounded-full bg-black"
                    style={{ opacity: 1 - hsv.v }}
                  />
                  {/* selection marker */}
                  <div
                    className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                    style={{ left: markerX, top: markerY }}
                  />
                </div>

                {/* Brightness slider */}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(hsv.v * 100)}
                  onChange={(e) =>
                    setHsv((p) => ({ ...p, v: +e.target.value / 100 }))
                  }
                  className="mt-3 w-full accent-ink"
                  style={{
                    background: `linear-gradient(90deg, #000, ${toHex(
                      hsvToRgb({ ...hsv, v: 1 }),
                    )})`,
                  }}
                  aria-label="Brightness"
                />

                {/* Preview square (draggable into the Add panel) + apply */}
                <div className="mt-3 flex w-full items-center gap-2">
                  <div
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/color", hex)
                    }
                    title="Drag into a slot to save"
                    className="h-9 w-9 shrink-0 cursor-grab rounded-md border border-black/15 active:cursor-grabbing"
                    style={{ background: hex }}
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      apply(hex);
                      setOpen(false);
                    }}
                    className="flex-1 rounded-md bg-ink px-3 py-2 text-sm text-paper transition-opacity hover:opacity-90"
                  >
                    Apply
                  </button>
                </div>

                {/* HEX + R/G/B inputs */}
                <div className="mt-3 grid w-full grid-cols-[1.4fr_1fr_1fr_1fr] gap-2">
                  {(["Hex", "R", "G", "B"] as const).map((label) => (
                    <label
                      key={label}
                      className="flex flex-col gap-1 text-center text-[10px] uppercase tracking-wide text-ink/50"
                    >
                      {label}
                      {label === "Hex" ? (
                        <input
                          value={hex}
                          onChange={(e) => {
                            const next = hexToRgb(e.target.value);
                            if (next) setFromRgb(next);
                          }}
                          className="w-full rounded border border-line bg-paper px-1 py-1 text-center text-xs text-ink outline-none focus:border-ink"
                        />
                      ) : (
                        <input
                          inputMode="numeric"
                          value={rgb[label.toLowerCase() as "r" | "g" | "b"]}
                          onChange={(e) => {
                            if (!RGB_RE.test(e.target.value)) return;
                            const n = Math.min(
                              255,
                              parseInt(e.target.value || "0", 10),
                            );
                            setFromRgb({
                              ...rgb,
                              [label.toLowerCase()]: n,
                            } as RGB);
                          }}
                          className="w-full rounded border border-line bg-paper px-1 py-1 text-center text-xs text-ink outline-none focus:border-ink"
                        />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Add panel — only alongside the Wheel tab. Drop the preview square
              into an empty slot to save; right-click a filled slot to delete;
              left-click to apply. */}
          {tab === "wheel" && (
            <div className="w-max rounded-lg border border-line bg-paper p-3 shadow-[0_12px_30px_-12px_rgba(33,28,20,0.55)]">
              <div className="mb-3 border-b border-line pb-1.5 text-sm font-medium text-ink">
                Add
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {slots.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    title={c ?? "Empty — drag a colour here"}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (c) {
                        apply(c);
                        setOpen(false);
                      }
                    }}
                    onContextMenu={(e) => {
                      if (!c) return;
                      e.preventDefault();
                      const host = rootRef.current!.getBoundingClientRect();
                      setMenu({
                        index: i,
                        x: e.clientX - host.left,
                        y: e.clientY - host.top,
                      });
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const dropped = e.dataTransfer.getData("text/color");
                      if (dropped) {
                        const next = [...slots];
                        next[i] = dropped;
                        persistSlots(next);
                      }
                    }}
                    className={`h-6 w-6 rounded-sm border transition-transform hover:scale-110 ${
                      c ? "border-black/15" : "border-dashed border-line"
                    }`}
                    style={c ? { background: c } : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Right-click "Delete" menu for a filled custom slot */}
          {menu && (
            <button
              ref={menuRef}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const next = [...slots];
                next[menu.index] = null;
                persistSlots(next);
                setMenu(null);
              }}
              className="absolute z-40 rounded-md border border-line bg-paper px-3 py-1.5 text-sm font-medium text-red-600 shadow-[0_8px_20px_-8px_rgba(33,28,20,0.55)] hover:bg-paper-deep"
              style={{ left: menu.x, top: menu.y }}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
