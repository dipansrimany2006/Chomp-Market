import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import { ShootingStars } from "@/components/ui/shooting-stars";
import { StarsBackground } from "@/components/ui/stars-background";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chomp Market",
  description: "Chomp Market, A prediction market place made with Love.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background min-h-screen`}
      >
        <Providers>
          <div className="relative min-h-screen">
            <div className="dark:block hidden">
              <ShootingStars />
              <StarsBackground />
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="sticky top-0 z-50 w-full flex justify-center bg-black border-b border-border">
                <div className="w-full px-4 sm:px-6 lg:w-[90%] xl:w-[85%] 2xl:w-[80%]">
                  <Navbar />
                </div>
              </div>
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
