"use client";

import { useEffect, useRef, useState, useId } from "react";

interface MermaidDiagramProps {
  code: string;
}

function sanitizeMermaidCode(raw: string): string {
  let code = raw.trim();
  // Strip markdown fences
  code = code.replace(/^```mermaid\s*/i, "").replace(/```\s*$/, "").trim();
  // Remove HTML <br> tags
  code = code.replace(/<br\s*\/?>/gi, "\n");
  // Remove empty lines
  code = code.split("\n").filter((l) => l.trim().length > 0).join("\n");
  return code;
}

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const uniqueId = useId().replace(/:/g, "-");

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          suppressErrorRendering: true,
        });

        const sanitized = sanitizeMermaidCode(code);
        if (!sanitized) {
          if (!cancelled) setError(true);
          return;
        }

        // Pre-validate before rendering to avoid error popups
        try {
          await mermaid.parse(sanitized);
        } catch {
          if (!cancelled) setError(true);
          return;
        }

        const id = `mermaid-${uniqueId}`;
        const { svg } = await mermaid.render(id, sanitized);

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      }
    }

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [code, uniqueId]);

  if (error) return null;

  return (
    <div
      ref={containerRef}
      className="overflow-auto rounded-lg border bg-muted/30 p-4 [&_svg]:mx-auto"
    />
  );
}
