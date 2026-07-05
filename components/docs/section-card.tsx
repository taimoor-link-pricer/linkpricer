import Link from "next/link";
import { DocIcon } from "@/lib/design-v1/docs-icons";
import type { DocSection } from "@/lib/design-v1/docs-data";
import { docArticlesInSection } from "@/lib/design-v1/docs-data";
import { sectionHref } from "@/lib/design-v1/docs-links";

export function SectionCard({ section }: { section: DocSection }) {
  const count = docArticlesInSection(section.id).length;
  return (
    <Link href={sectionHref(section)} className="seccard">
      <span className="seccard__ic">
        <DocIcon name={section.icon} />
      </span>
      <h3>
        {section.label}
        {section.alt && <span className="alt"> ({section.alt})</span>}
      </h3>
      <p>{section.blurb}</p>
      <span className="seccard__foot">
        <span>{count} article{count === 1 ? "" : "s"}</span>
        <span className="go">Browse →</span>
      </span>
    </Link>
  );
}
