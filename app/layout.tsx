import { headers } from "next/headers";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecureBin — private sharing, by design",
  description: "Browser-encrypted sharing for sensitive notes and files.",
  applicationName: "SecureBin",
  referrer: "no-referrer",
  openGraph: {
    title: "SecureBin — private sharing, by design",
    description: "Browser-encrypted sharing for sensitive notes and files.",
    type: "website",
    siteName: "SecureBin",
  },
  twitter: {
    card: "summary",
    title: "SecureBin — private sharing, by design",
    description: "Browser-encrypted sharing for sensitive notes and files.",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? undefined;
  // Pre-hydration theme script (nonce'd, CSP-safe): applies the stored theme
  // before first paint so there is no wrong-theme flash on any route.
  const themeScript = `try{var t=localStorage.getItem("securebin-theme");if(t==="light"||t==="dark"){document.documentElement.className=t;document.documentElement.dataset.theme=t;}else{document.documentElement.className="dark";document.documentElement.dataset.theme="dark";}}catch(e){}`;

  return (
    <html lang="en" className="dark" data-theme="dark" suppressHydrationWarning>
      <head>
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body nonce={nonce} suppressHydrationWarning>{children}</body>
    </html>
  );
}
