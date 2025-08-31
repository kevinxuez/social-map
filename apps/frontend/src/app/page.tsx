"use client";
import Nav from '@/components/Nav';
import { useUser } from '@auth0/nextjs-auth0/client';

export default function Page() {
  const { user } = useUser();
  return (
    <main>
      <Nav />
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Social Map</h1>
        {!user && (
          <div className="space-y-2">
            <p className="opacity-70">Please log in to view and edit the graph.</p>
            <a href="/auth/login" className="px-4 py-2 bg-black text-white rounded">Log in / Sign up</a>
          </div>
        )}
        {user && (
          <div className="space-y-2">
            <p className="opacity-70">Welcome back {user.name || user.email}.</p>
            <a href="/graph" className="underline">Go to Graph</a>
          </div>
        )}
      </div>
    </main>
  );
}