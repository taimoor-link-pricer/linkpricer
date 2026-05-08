import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
