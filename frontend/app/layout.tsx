import './globals.css'
import 'leaflet/dist/leaflet.css'
import { Inter } from 'next/font/google'
import AuthWrapper from '../components/AuthWrapper'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'AutoScheduler - Route Optimization Platform',
  description: 'Professional vehicle routing and delivery management system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          src="https://maps.googleapis.com/maps/api/js?key=AIzaSyCHBzKvpPE6lyMrBLf4EZtmWUu1wLaolgM&libraries=places"
          async
          defer
        ></script>
      </head>
      <body className={`${inter.className} min-h-screen bg-zinc-950 text-white`}>
        <AuthWrapper>
          {children}
        </AuthWrapper>
      </body>
    </html>
  )
}