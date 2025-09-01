import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Social Map',
  description: 'Network & geo mapper',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
