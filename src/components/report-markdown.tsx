import Markdown from "react-markdown";
import { safeReportUrl } from "@/domain/analyses";

export function ReportMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-3 break-words text-sm leading-relaxed [&_h1]:text-xl [&_h2]:text-lg [&_h3]:font-semibold [&_p]:whitespace-pre-wrap [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-basalt-secondary [&_pre]:p-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_a]:text-primary [&_a]:underline">
      <Markdown
        skipHtml
        disallowedElements={["img"]}
        urlTransform={safeReportUrl}
        components={{
          a: ({ href, children }) =>
            href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
