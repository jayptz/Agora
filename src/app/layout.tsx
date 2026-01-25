import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agora - Reddit Post Simulator",
  description: "Simulate how your Reddit post will perform before posting",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
