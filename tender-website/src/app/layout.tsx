import type { Metadata } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import PixelBackground from "@/components/pixel/PixelBackground";
import BootScreen from "@/components/pixel/BootScreen";
import PixelCursor from "@/components/pixel/PixelCursor";

const pixel = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pixel",
  display: "swap",
});

const body = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AP Roads & Works - Official Tendering Portal",
  description:
    "e-Procurement and road repair tender bidding portal for contractors and public works authorities.",
  icons: {
    icon: "/brand/tendering.png",
    apple: "/brand/tendering.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${pixel.variable} ${body.variable}`}
      suppressHydrationWarning
    >
      <body className="font-body antialiased">
        <PixelBackground />
        <BootScreen />
        <PixelCursor />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
