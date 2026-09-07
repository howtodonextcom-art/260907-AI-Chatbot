import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin", "vietnamese"],
  variable: "--font-display",
});

const body = Source_Sans_3({
  subsets: ["latin", "vietnamese"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Layer A — AI Decision Lab",
  description:
    "Domain-agnostic AI Decision Lab: chat is the surface, decision is the product.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
