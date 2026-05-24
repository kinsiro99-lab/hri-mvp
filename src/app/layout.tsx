import type { Metadata, Viewport } from "next"
import "@/styles/globals.css"

export const metadata: Metadata = {
  title: "HRI — Human Rhythm Intelligence",
  description: "지금, 당신의 마음을 살펴보세요",
  metadataBase: new URL("https://human-rhythm.com"),
  openGraph: {
    title: "HRI — Human Rhythm Intelligence",
    description: "지금, 당신의 마음을 살펴보세요",
    url: "https://human-rhythm.com",
    siteName: "HRI",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "HRI — Human Rhythm Intelligence",
    description: "지금, 당신의 마음을 살펴보세요",
  },
  icons: {
    icon: "/favicon.ico",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f4f1",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        {/* Preconnect for Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
