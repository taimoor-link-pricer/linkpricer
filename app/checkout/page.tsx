"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckoutModal, OrderPlacedModal, type PlacedOrder } from "@/components/dashboard/checkout-flow";
import { loadCart, persistCart } from "@/lib/cart-storage";

// Used to be CheckoutModal rendered in-place by whichever page opened it
// (search or related-sites), with cartItems passed straight down as a prop.
// Now it's its own route, so the cart it needs comes from lib/cart-storage
// instead — see that file for why (search/related-sites write to it on every
// cartItems/currency change; this page just reads it once on mount, same
// lazy-useState-initializer idiom as loadRecentSearches elsewhere).
export default function CheckoutPage() {
  const router = useRouter();
  // Read once on mount — nothing on this page mutates the cart itself (the
  // brief-editing fields inside CheckoutModal are its own local state), so
  // there's no reactivity to wire up here beyond the initial load.
  const [cart] = useState(() => loadCart());
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrders, setPlacedOrders] = useState<PlacedOrder[]>([]);

  // Landed here directly (bookmark, refresh, back-button after the cart was
  // already cleared) with nothing to check out — bounce back to find
  // something instead of rendering a checkout for zero items. Skipped once an
  // order's actually been placed: onPlaced below clears storage for next
  // time but deliberately leaves `cart` state alone so this effect doesn't
  // race the confirmation screen it's about to show.
  useEffect(() => {
    if (!orderPlaced && cart.items.length === 0) router.replace("/dashboard/search");
  }, [cart.items.length, orderPlaced, router]);

  if (orderPlaced) {
    return <OrderPlacedModal orders={placedOrders} currency={cart.currency} onClose={() => {}} />;
  }

  if (cart.items.length === 0) return null;

  return (
    <CheckoutModal
      cartItems={cart.items}
      currency={cart.currency}
      onClose={() => router.back()}
      onPlaced={(orders) => {
        persistCart({ items: [], currency: cart.currency });
        setPlacedOrders(orders);
        setOrderPlaced(true);
      }}
    />
  );
}
