import type { ReactNode } from 'react';

export default function Code({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <figure className="code">
      {title && <figcaption>{title}</figcaption>}
      <pre><code>{children}</code></pre>
    </figure>
  );
}
