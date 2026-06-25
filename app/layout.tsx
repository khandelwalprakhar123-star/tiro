import type { Metadata } from "next";
import {
  Young_Serif,
  Figtree,
  Lora,
  Source_Serif_4,
  Inter,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

// Display serif — warm, characterful, used for the wordmark & headings.
// Young Serif ships a single weight (400); hierarchy comes from size, not weight.
const youngSerif = Young_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

// Body sans — humanist, calm, used for UI text and inputs.
const figtree = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
});

// Document fonts — selectable per-selection from the editor's font menu. Each
// exposes a CSS variable that lib/inline-style.ts references as var(--font-*).
const lora = Lora({ variable: "--font-lora", subsets: ["latin"] });
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tiro — write with everything",
  description:
    "A multimodal document editor where writing, media, and publishing live in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="yolk"
      suppressHydrationWarning
      className={`${youngSerif.variable} ${figtree.variable} ${lora.variable} ${sourceSerif.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/*
          No-flash theme init. Runs synchronously during HTML parsing — before the
          browser paints — so a Sage-theme visitor never sees a flash of Yolk. Reads
          the saved choice from localStorage and sets data-theme on <html>. The
          <ThemeToggle/> writes the same "tiro-theme" key. `suppressHydrationWarning`
          above lets React accept this script's DOM change instead of erroring.
          Pattern: Next.js "Preventing flash before hydration" guide.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("tiro-theme");if(t==="sage"||t==="yolk")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
