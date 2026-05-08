'use client';

import dynamic from 'next/dynamic';

const EditorContainer = dynamic(
  () => import('@/app/editor/_components/EditorContainer'),
  { ssr: false }
);

export default function EditorPage() {
  return <EditorContainer />;
}
