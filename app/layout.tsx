import { headers } from "next/headers";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecureBin — private sharing, by design",
  description: "Browser-encrypted sharing for sensitive notes and files.",
  applicationName: "SecureBin",
  referrer: "no-referrer",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? undefined;

  return (
    <html lang="en" className="dark" data-theme="dark" suppressHydrationWarning>
      <body nonce={nonce} suppressHydrationWarning>{children}</body>
    </html>
  );
}
