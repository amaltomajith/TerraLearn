// Lazy-loaded target for <Markdown>. Everything heavy (react-markdown + the
// unified/remark stack) is imported here so it lands in its own async chunk.
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 last:mb-0 list-disc pl-4 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 last:mb-0 list-decimal pl-4 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2 text-primary hover:opacity-80"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-black/5 dark:bg-white/10 px-1 py-0.5 text-[0.85em] font-mono">
      {children}
    </code>
  ),
  h1: ({ children }) => <p className="mb-2 font-semibold">{children}</p>,
  h2: ({ children }) => <p className="mb-2 font-semibold">{children}</p>,
  h3: ({ children }) => <p className="mb-2 font-semibold">{children}</p>,
};

export default function MarkdownInner({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
