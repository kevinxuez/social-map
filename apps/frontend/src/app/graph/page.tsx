'use client';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Nav from '@/components/Nav';
import { useState } from 'react';
import Controls from './Controls';

const ForceGraph2D = dynamic(
  () => import('react-force-graph').then(m => m.ForceGraph2D),
  { ssr: false }
);

type Node = { id: string; name?: string; group?: string };
type Link = { source: string; target: string; value?: number };

export default function GraphPage() {
  const [params, setParams] = useState({ root: 1, depth: 1 });
  const { data } = useQuery({
    queryKey: ['graph', params],
    queryFn: () => api<{ nodes: Node[]; links: Link[] }>(`/graph?entity_id=${params.root}&depth=${params.depth}`),
  });

  return (
    <main>
      <Nav />
      <Controls onApply={setParams} />
      <div className="h-[calc(100vh-120px)]">
        {data && <ForceGraph2D graphData={data} nodeLabel="name" />}
      </div>
    </main>
  );
}
