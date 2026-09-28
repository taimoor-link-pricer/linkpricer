#!/usr/bin/env bash
# End-to-end check of the order API against a running deployment, in TEST MODE
# only — it never places a real order.
#
#   ORDER_API_KEY=lp_order_test_... DOMAIN=example.com scripts/test-order-api.sh [base_url]
#
# base_url defaults to https://www.linkpricer.ai/api/v1. DOMAIN must be a domain
# with at least one general-niche listing. A live key also works: every order
# call is sent with X-Test-Mode: true. Pauses between phases so the 10/minute
# order limit is never what a check is measuring.
set -uo pipefail

BASE="${1:-https://www.linkpricer.ai/api/v1}"
KEY="${ORDER_API_KEY:?set ORDER_API_KEY}"
DOMAIN="${DOMAIN:?set DOMAIN to a listed domain}"
AUTH=(-H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -H "X-Test-Mode: true")
PASS=0; FAIL=0; REF="SMOKE-$(date +%s)"

check() { # name expected_status curl-args...
  local name="$1" want="$2"; shift 2
  local out code body
  out=$(curl -s -w $'\n%{http_code}' "$@"); code=${out##*$'\n'}; body=${out%$'\n'*}
  if [[ "$code" == "$want" ]]; then PASS=$((PASS+1)); printf '  ok   %-52s %s\n' "$name" "$code"
  else FAIL=$((FAIL+1)); printf '  FAIL %-52s got %s want %s  %s\n' "$name" "$code" "$want" "${body:0:160}"; fi
  LAST="$body"
}
field() { node -e "const o=JSON.parse(process.argv[1]); console.log(eval('o.'+process.argv[2]) ?? '')" "$LAST" "$1"; }
DOC='{"mode":"buyer_doc","url":"https://docs.google.com/document/d/test"}'
order() { # ref price [listing] [article-json] [anchor]
  local listing="${3:-$LID}" article="${4:-$DOC}" anchor="${5:-test anchor}"
  echo "{\"client_reference\":\"$1\",\"listing_id\":\"$listing\",\"niche\":\"general\",\"expected_price\":\"$2\",\"currency\":\"USD\",\"target_url\":\"https://example.com/test\",\"anchor\":\"$anchor\",\"article\":$article}"
}

echo "== Auth"
check "no key" 401 "$BASE/listings?domain=$DOMAIN"
check "wrong key" 401 -H "Authorization: Bearer lp_order_test_wrong" "$BASE/listings?domain=$DOMAIN"
check "Basic auth is not a key" 401 -H "Authorization: Basic abc" "$BASE/listings?domain=$DOMAIN"
check "x-api-key header accepted" 200 -H "x-api-key: $KEY" "$BASE/listings?domain=$DOMAIN"
RID=$(curl -s -D - -o /dev/null "${AUTH[@]}" "$BASE/listings?domain=$DOMAIN" | tr -d '\r' | awk -F': ' 'tolower($1)=="x-request-id"{print $2}')
[[ "$RID" =~ ^[0-9a-f-]{36}$ ]] && { PASS=$((PASS+1)); echo "  ok   X-Request-Id: $RID"; } || { FAIL=$((FAIL+1)); echo "  FAIL no X-Request-Id"; }

echo "== Listings"
check "missing domain" 400 "${AUTH[@]}" "$BASE/listings"
check "malformed domain" 400 "${AUTH[@]}" "$BASE/listings?domain=not_a_domain"
check "unknown niche" 400 "${AUTH[@]}" "$BASE/listings?domain=$DOMAIN&niche=casino"
check "unlisted domain -> empty list" 200 "${AUTH[@]}" "$BASE/listings?domain=zz-unlisted-$(date +%s).com"
[[ "$(field 'listings.length')" == "0" ]] && PASS=$((PASS+1)) || { FAIL=$((FAIL+1)); echo "  FAIL unlisted domain not empty"; }
for n in general other igaming crypto cbd adult finance dating; do check "niche=$n" 200 "${AUTH[@]}" "$BASE/listings?domain=$DOMAIN&niche=$n"; done
check "https://www. prefix normalized" 200 "${AUTH[@]}" "$BASE/listings?domain=https://www.$DOMAIN"
check "general listings" 200 "${AUTH[@]}" "$BASE/listings?domain=$DOMAIN&niche=general"
LID=$(field 'listings[0].listing_id'); PRICE=$(field 'listings[0].price')
[[ -n "$LID" ]] || { echo "  FAIL $DOMAIN has no general listing — pick another DOMAIN"; exit 1; }
echo "  using $LID at \$$PRICE"

echo "== Order validation (nothing may be placed)"
check "not JSON" 400 "${AUTH[@]}" -d '{nope' "$BASE/orders"
check "empty body" 400 "${AUTH[@]}" -d '{}' "$BASE/orders"
check "price as a number" 400 "${AUTH[@]}" -d "$(order $REF-v1 "$PRICE" | sed "s/\"expected_price\":\"$PRICE\"/\"expected_price\":$PRICE/")" "$BASE/orders"
check "non-USD currency" 400 "${AUTH[@]}" -d "$(order $REF-v2 "$PRICE" | sed 's/"USD"/"EUR"/')" "$BASE/orders"
check "javascript: target_url" 400 "${AUTH[@]}" -d "$(order $REF-v3 "$PRICE" | sed 's#https://example.com/test#javascript:alert(1)#')" "$BASE/orders"
check "malformed listing_id" 400 "${AUTH[@]}" -d "$(order $REF-v4 "$PRICE" L-88213)" "$BASE/orders"
check "vendor_writes without brief" 400 "${AUTH[@]}" -d "$(order $REF-v5 "$PRICE" "$LID" '{"mode":"vendor_writes"}')" "$BASE/orders"
check "reference with a space" 400 "${AUTH[@]}" -d "$(order "BAD REF" "$PRICE")" "$BASE/orders"
echo "  (pausing 61s for the order rate-limit window)"; sleep 61

echo "== Placing"
check "stale price -> price_changed" 409 "${AUTH[@]}" -d "$(order $REF-a 1.00)" "$BASE/orders"
[[ "$(field 'error.current_price')" == "$PRICE" ]] && PASS=$((PASS+1)) || { FAIL=$((FAIL+1)); echo "  FAIL price_changed lacks current_price"; }
check "unknown listing -> listing_unavailable" 409 "${AUTH[@]}" -d "$(order $REF-b "$PRICE" M-00000000-0000-0000-0000-000000000000)" "$BASE/orders"
check "place (buyer_doc)" 201 "${AUTH[@]}" -d "$(order $REF-a "$PRICE")" "$BASE/orders"
OID=$(field order_id); [[ "$(field test)" == "true" ]] || { FAIL=$((FAIL+1)); echo "  FAIL order not marked test"; }
check "retry, same order -> 200 same id" 200 "${AUTH[@]}" -d "$(order $REF-a "$PRICE")" "$BASE/orders"
[[ "$(field order_id)" == "$OID" ]] && PASS=$((PASS+1)) || { FAIL=$((FAIL+1)); echo "  FAIL retry returned another order"; }
check "retry with stale price -> still 200" 200 "${AUTH[@]}" -d "$(order $REF-a 1.00)" "$BASE/orders"
check "same ref, different order -> duplicate_reference" 409 "${AUTH[@]}" -d "$(order $REF-a "$PRICE" "$LID" "" "another anchor")" "$BASE/orders"
[[ "$(field 'error.code')/$(field 'error.order_id')" == "duplicate_reference/$OID" ]] && PASS=$((PASS+1)) || { FAIL=$((FAIL+1)); echo "  FAIL clash response: $LAST"; }
check "place (vendor_writes)" 201 "${AUTH[@]}" -d "$(order $REF-c "$PRICE" "$LID" '{"mode":"vendor_writes","brief":"test brief"}')" "$BASE/orders"
echo "  (pausing 61s)"; sleep 61
echo -n "  race, same ref x5 at once -> "
for i in 1 2 3 4 5; do curl -s -o /dev/null -w '%{http_code} ' "${AUTH[@]}" -d "$(order $REF-r "$PRICE")" "$BASE/orders" & done; wait; echo

echo "== Status"
check "by order id" 200 "${AUTH[@]}" "$BASE/orders/$OID"
check "by order id, upper case" 200 "${AUTH[@]}" "$BASE/orders/$(echo "$OID" | tr a-f A-F)"
check "by reference" 200 "${AUTH[@]}" "$BASE/orders?client_reference=$REF-a"
[[ "$(field 'orders[0].order_id')" == "$OID" ]] && PASS=$((PASS+1)) || { FAIL=$((FAIL+1)); echo "  FAIL by-reference lookup"; }
check "race ref resolves to exactly one order" 200 "${AUTH[@]}" "$BASE/orders?client_reference=$REF-r"
[[ "$(field 'orders.length')" == "1" ]] && PASS=$((PASS+1)) || { FAIL=$((FAIL+1)); echo "  FAIL race produced $(field 'orders.length') orders"; }
check "never-placed reference -> empty" 200 "${AUTH[@]}" "$BASE/orders?client_reference=$REF-never"
check "missing reference" 400 "${AUTH[@]}" "$BASE/orders"
check "unknown order id" 404 "${AUTH[@]}" "$BASE/orders/00000000-0000-0000-0000-000000000000"
check "garbage order id" 404 "${AUTH[@]}" "$BASE/orders/abc"
check "spec fields on an order" 200 "${AUTH[@]}" "$BASE/orders/$OID"
node -e "const o=JSON.parse(process.argv[1]); const k=['order_id','client_reference','status','published_url','published_at','price','currency','failure_reason','created_at','updated_at']; const miss=k.filter(x=>!(x in o)); if(miss.length||!o.created_at){console.log('  FAIL missing/empty:',miss,o.created_at);process.exit(1)} else console.log('  ok   all spec fields present, created_at', o.created_at)" "$LAST" && PASS=$((PASS+1)) || FAIL=$((FAIL+1))

echo "== Rate limit"
echo "  (pausing 61s)"; sleep 61
codes=""; for i in $(seq 1 10); do codes+=$(curl -s -o /dev/null -w '%{http_code} ' "${AUTH[@]}" -d '{}' "$BASE/orders"); done
check "11th order call in a minute -> 429" 429 "${AUTH[@]}" -d '{}' "$BASE/orders"
RA=$(curl -s -D - -o /dev/null "${AUTH[@]}" -d '{}' "$BASE/orders" | tr -d '\r' | awk -F': ' 'tolower($1)=="retry-after"{print $2}')
[[ -n "$RA" ]] && { PASS=$((PASS+1)); echo "  ok   Retry-After: $RA"; } || { FAIL=$((FAIL+1)); echo "  FAIL no Retry-After"; }

echo; echo "PASSED $PASS  FAILED $FAIL"
[[ $FAIL -eq 0 ]]
