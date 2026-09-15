import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Ground from "@/components/macadam/Ground";
import { themeInitScript } from "@/components/macadam/theme";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pothole Reporter",
  description: "Crowdsourced pothole detection and automated tender generation",
  icons: {
    icon: "/brand/pothole-reporter.png",
    apple: "/brand/pothole-reporter.png",
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
      className={`dark ${archivo.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript("dark") }} />
        <Ground />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
