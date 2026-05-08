const TRUST_ITEMS = [
  {
    icon: "verified_user",
    title: "Enterprise Grade",
    description: "Trusted by world-class SEO architecture teams.",
  },
  {
    icon: "database",
    title: "Real-time Data",
    description: "Live indexing and backlink valuation updates.",
    bordered: true,
  },
  {
    icon: "auto_awesome",
    title: "AI Insights",
    description: "Predictive pricing models for backlink inventory.",
  },
];

export function TrustSection() {
  return (
    <div className="mt-16 w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8">
      {TRUST_ITEMS.map((item) => (
        <div
          key={item.title}
          className={`flex flex-col items-center text-center px-4 ${
            item.bordered ? "border-x-0 md:border-x border-outline-variant/10" : ""
          }`}
        >
          <span className="material-symbols-outlined text-primary-container mb-3">
            {item.icon}
          </span>
          <h4 className="font-headline font-bold text-on-surface text-sm">{item.title}</h4>
          <p className="text-xs text-on-surface-variant mt-1">{item.description}</p>
        </div>
      ))}
    </div>
  );
}
