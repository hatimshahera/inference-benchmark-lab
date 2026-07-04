import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "AI Inference Benchmark Lab",
  description:
    "Run an ML image model in the browser and measure cold start, preprocessing, inference latency, confidence, and backend performance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
