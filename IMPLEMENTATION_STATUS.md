# Currency system and customer-panel upgrade

## Delivered

- USD is the initial default currency; 62 enabled ISO-style currency options are seeded in migration `0019_customer_currencies.sql`.
- Customers can select an enabled currency from Profile. The preference is stored on the user record and is returned by `/me`.
- The wallet stores a persisted selected-currency minor-unit balance (`wallet_balance_minor`, `wallet_currency_code`). Migration `0020_wallet_currency_storage.sql` backfills existing users and keeps the native balance synchronized on credits, debits, currency changes, and exchange-rate/precision changes. The USD micro-unit ledger remains the settlement/audit representation used by the provider and existing payment integrations.
- Currency display uses configured symbol visibility and decimal precision. Wallet balance display uses the persisted native minor-unit balance; catalog, order, ledger, reward and refund amounts are formatted in the selected currency.
- Admin currency controls support add, edit, enable/disable, remove when unused, exchange rates, symbols, decimal precision, symbol visibility, currency-specific markup, and default selection. The API validates rates, precision, markup and default-currency safety; it prevents disabling or deleting the active default currency.
- Currency-specific markup is applied to category/service/search/favorites/detail prices and independently recalculated on the server for both balance-paid orders and Telegram Stars order invoices. The client cannot set the charged amount.
- Currency changes invalidate customer catalog caches so the next screen load uses the newly selected currency's markup.
- The customer panel has a unified responsive visual system applied across customer routes: dashboard, categories, services, order flow, orders/details, wallet, top-up, profile, favorites, invite and language screens. It standardizes typography, card hierarchy, spacing, touch targets, controls, focus states, reduced-motion behavior, loading and empty/error surfaces while retaining existing route/API workflows.
- Existing provider, order-processing, Telegram bot and payment integrations are retained.

## Verification performed

- Applied every SQL migration (`0001`–`0020`) in sequence against an in-memory SQLite database.
- Verified a user balance is backfilled to USD native minor units, converted to NPR on preference change, and recalculated after an exchange-rate change without changing the underlying USD ledger balance.
- Verified the seed creates 62 currencies and USD as the enabled default.
- `git diff --check` passes.
- Currency markup unit tests cover zero markup, upward rounding and invalid/excessive values.

The package install could not complete in this environment, so the TypeScript check, Vitest suite and production Vite build could not be executed here. Run them in a Node 24 environment with dependencies installed using `npm ci`, then `npm run typecheck`, `npm test` and `npm run build` before deployment.
