import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Social Map',
  docker compose -f docker-compose.prod.yml up -d
  # Or, to run migrations manually:
  docker compose -f docker-compose.prod.yml exec backend alembic upgrade head  description: 'Network & geo mapper',
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
