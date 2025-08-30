import Nav from '@/components/Nav';

export default function Page() {
  return (
    <main>
      <Nav />
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Social Map</h1>
        <p className="opacity-70">Graph + Map viewer</p>
      </div>
    </main>
  );
}