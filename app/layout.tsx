import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecureBin — private sharing, by design",
  description: "Browser-encrypted sharing for sensitive notes and files.",
  applicationName: "SecureBin",
  referrer: "no-referrer",
};

const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('securebin-theme');
    var isDark = stored !== 'light';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {
    document.documentElement.classList.add('dark');
    document.documentElement.dataset.theme = 'dark';
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
