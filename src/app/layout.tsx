import type { Metadata } from "next";
import { DM_Sans, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { CommandPalette } from "@/components/command-palette";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:7004"),
  title: "noheir - 个人财务管理",
  description: "隐私优先的个人财务记录与分析",
  openGraph: {
    title: "noheir - 个人财务管理",
    description: "隐私优先的个人财务记录与分析",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* Blocking script: apply dark class and color scheme before first paint to prevent FOUC */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static literal, no user input
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("theme");var d=window.matchMedia("(prefers-color-scheme:dark)").matches;if(s==="dark"||(s!=="light"&&d))document.documentElement.classList.add("dark");var c=localStorage.getItem("colorScheme");if(c==="swapped")document.documentElement.classList.add("color-scheme-swapped")}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${dmSans.variable} antialiased`}>
        <AuthProvider>
          {children}
          <CommandPalette />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
