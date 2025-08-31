'use client';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';

export default function Nav() {
  const { user, isLoading } = useUser();
  return (
    <nav className="p-3 border-b flex gap-4 bg-white/70 backdrop-blur items-center">
      <Link href="/">Home</Link>
      <Link href="/graph">Graph</Link>
      <Link href="/map">Map</Link>
      <div className="ml-auto flex items-center gap-3 text-sm">
        {isLoading && <span>…</span>}
        {!isLoading && !user && <a href="/auth/login">Login</a>}
        {!isLoading && user && (
          <>
            <span className="opacity-70">{user.name || user.email}</span>
            <a href="/auth/logout">Logout</a>
          </>
        )}
      </div>
    </nav>
  );
}
