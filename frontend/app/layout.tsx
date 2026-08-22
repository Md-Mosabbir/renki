import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

// Named --font-sans, not --font-geist-sans: globals.css maps Tailwind's
// font-sans to var(--font-sans). The generated layout defined a different
// variable name, so `font-sans` resolved to nothing and every surface silently
// fell back to the browser default.
const geistSans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

// Display face, used only for the large editorial moments — the sign-in
// headline, a match, the scan result. Pairing a high-contrast serif against a
// neutral grotesque is what keeps this from reading as another rounded SaaS
// template, which the spec rules out by name.
const instrumentSerif = Instrument_Serif({
  variable: '--font-display',
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'Renki',
  description: 'Share a ride with someone from your campus.',
};

// Mobile-first: the app is used one-handed on a phone, and the scan and swipe
// screens are full-bleed. `viewportFit: cover` lets them reach under the
// notch, and locking the scale stops a double-tap zooming the viewfinder.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
