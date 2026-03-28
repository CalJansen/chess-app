import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppModeProvider } from "@/contexts/AppModeContext";

export const metadata: Metadata = {
  title: "Chess App",
  description: "Interactive chess application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <AppModeProvider>
            {children}
          </AppModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
