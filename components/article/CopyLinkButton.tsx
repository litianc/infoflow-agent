'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

interface CopyLinkButtonProps {
  url: string;
}

export function CopyLinkButton({ url }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button variant="outline" onClick={handleCopy}>
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-2" />
          已复制
        </>
      ) : (
        <>
          <Copy className="h-4 w-4 mr-2" />
          复制链接
        </>
      )}
    </Button>
  );
}
