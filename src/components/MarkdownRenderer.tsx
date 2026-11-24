import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeSnippetBlock } from './CodeSnippetBlock';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-prose text-[#2B0F17] dark:text-[#F5ECE0]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            return <>{children}</>;
          },
          code({ className, children, ...props }) {
            const match = /language-([\w-]+)/.exec(className || '');
            const rawText = String(children).replace(/\n$/, '');
            const isBlock = Boolean(match) || rawText.includes('\n');

            if (isBlock) {
              return (
                <CodeSnippetBlock
                  code={rawText}
                  language={match ? match[1] : 'text'}
                />
              );
            }

            return (
              <code
                className="rounded-md bg-[#6B1D2F]/8 dark:bg-[#F3E7D8]/10 border border-[#6B1D2F]/12 dark:border-[#F3E7D8]/14 px-1.5 py-0.5 text-[0.85em] font-mono text-[#5B1627] dark:text-[#E6B8A2]"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
