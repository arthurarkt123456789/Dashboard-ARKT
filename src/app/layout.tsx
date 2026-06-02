import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ARKT Conseil — Dashboard',
  description: 'Dashboard de pilotage ARKT Conseil',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
