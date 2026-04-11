import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/layouts/header";
import { BottomNav } from "@/components/layouts/bottom-nav";
import { Footer } from "@/components/layouts/footer";
import { NoiseOverlay } from "@/components/layouts/noise-overlay";
import { cn } from "@/lib/utils";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Game Guesser",
    template: "%s | Game Guesser",
  },
  description: "A video game timeline guessing party game — guess when games were released!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased",
        spaceGrotesk.variable,
        inter.variable,
        jetbrainsMono.variable,
      )}
      suppressHydrationWarning
    >
      <body className="bg-surface-900 flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <NoiseOverlay />
            <Header />
            <main className="flex flex-1 flex-col pb-16 md:pb-0">{children}</main>
            <Footer />
            <BottomNav />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
