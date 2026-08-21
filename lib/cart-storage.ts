import type { CartItem, Currency } from "@/components/dashboard/results-shared";

// Checkout used to live as a modal rendered in-place by whichever page
// opened it (search or related-sites), so cartItems could just be React
// state passed straight down as a prop. Moving checkout to its own route
// (app/checkout/page.tsx) means it's a separate mounted component tree that
// never receives that prop — the cart has to survive an actual navigation,
// so it's persisted here instead. Mirrors the "recent searches" localStorage
// pattern in app/dashboard/search/page.tsx (lp_recent_searches): SSR-guarded
// reads, silently-swallowed write failures (storage full/disabled just means
// the cart doesn't survive a reload, not a crash), and a lazy useState
// initializer at each call site rather than an effect-on-mount.
const CART_KEY = "lp_cart";

export type StoredCart = { items: CartItem[]; currency: Currency };

const EMPTY_CART: StoredCart = { items: [], currency: "USD" };

export function loadCart(): StoredCart {
  try {
    if (typeof window === "undefined") return EMPTY_CART;
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return EMPTY_CART;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return EMPTY_CART;
    const currency: Currency = parsed.currency === "EUR" || parsed.currency === "GBP" ? parsed.currency : "USD";
    return { items: parsed.items, currency };
  } catch {
    return EMPTY_CART;
  }
}

export function persistCart(cart: StoredCart): void {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    /* noop — storage may be full/disabled, cart still works in-memory for this session */
  }
}
