import { lazy, Suspense } from 'react';

// react-markdown + the unified/remark stack (~20KB gzip) loads lazily so it
// stays out of the `/` and Saath entry chunks. Until it resolves (a few ms) the
// bubble shows plain wrapped text.
const MarkdownInner = lazy(() => import('./MarkdownInner'));

/** Renders assistant markdown. No raw HTML (react-markdown default). */
export function Markdown({ children }: { children: string }) {
  return (
    <Suspense fallback={<p className="whitespace-pre-wrap text-sm leading-relaxed">{children}</p>}>
      <MarkdownInner>{children}</MarkdownInner>
    </Suspense>
  );
}
