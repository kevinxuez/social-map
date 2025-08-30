'use client';
import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="p-3 border-b flex gap-4 bg-white/70 backdrop-blur">
      <Link href="/">Home</Link>
      <Link href="/graph">Graph</Link>
      <Link href="/map">Map</Link>
      <a href="/api/auth/login">Login</a>
      <a href="/api/auth/logout">Logout</a>
    </nav>
  );
}
