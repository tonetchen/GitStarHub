import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@/components/auth/session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "GitStarHub - Smart GitHub Star Manager",
    template: "%s | GitStarHub",
  },
  description:
    "AI-powered GitHub star management and repository tracking. Organize, search, and manage your starred repositories with intelligent categorization.",
  keywords: [
    "GitHub",
    "Star Manager",
    "Repository Management",
    "AI",
    "Developer Tools",
    "Open Source",
  ],
  authors: [{ name: "GitStarHub Team" }],
  creator: "GitStarHub",
  publisher: "GitStarHub",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://gitstarhub.dev",
    siteName: "GitStarHub",
    title: "GitStarHub - Smart GitHub Star Manager",
    description:
      "AI-powered GitHub star management and repository tracking. Organize, search, and manage your starred repositories with intelligent categorization.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "GitStarHub - Smart GitHub Star Manager",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GitStarHub - Smart GitHub Star Manager",
    description:
      "AI-powered GitHub star management and repository tracking",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            <div className="relative flex min-h-screen flex-col">
              <main className="flex-1">{children}</main>
            </div>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
