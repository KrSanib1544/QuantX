import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'QuantX AI',
  description: 'Production-grade AI Financial Trading and Analysis System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
