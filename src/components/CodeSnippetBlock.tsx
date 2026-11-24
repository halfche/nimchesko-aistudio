import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeSnippetBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

export function CodeSnippetBlock({ code, language, filename }: CodeSnippetBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback ignored if clipboard permissions restricted
    }
  };

  const label = filename || language || 'code';

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/14 bg-[#2E0E17]/92 dark:bg-[#19080E]/95 backdrop-blur-md text-[#FAF5EC] shadow-xs">
      <div className="flex items-center justify-between gap-4 border-b border-[#FAF5EC]/12 px-4 py-2 text-xs text-[#E4D5C7]">
        <span className="font-mono truncate">{label}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[#F3EAE0] hover:bg-[#FAF5EC]/10 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E4C9B8]"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-[#E8C5B0]" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed font-mono text-[#FAF5EC]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
