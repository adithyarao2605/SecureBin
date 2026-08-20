import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecureBin — private sharing, by design",
  description: "A browser-first foundation for sharing sensitive notes and files.",
  applicationName: "SecureBin",
  referrer: "no-referrer"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
