import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AIEOS Console',
  description: 'Guided wizard for running AIEOS governance processes',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
