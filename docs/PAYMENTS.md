# Payments and money

**No real payment provider is integrated.** Every payment in this build goes through a labelled
simulator, and no real money moves. FAITH is designed not to hold customer funds itself: money
is meant to be held and moved by licensed payment partners, with FAITH recording what is owed.

## Commission

FAITH's fee is **3.5% (350 basis points)** of completed sales: the product subtotal after
discounts and before tax. Payment processing fees and tax obligations are separate.

- `commissionFor(amount, 350)` computes it in integer minor units.
- `allocate()` splits an order total across sellers and lines with the largest-remainder method,
  so the parts always add up to the whole.
- `commissionReversal()` returns the commission for a refund cumulatively, so several partial
  refunds never reverse more commission than was charged.

The rate is a business constant in `packages/config` (`DEFAULT_COMMISSION_BPS`). Changing it
needs finance authority and is audited.

## Flow of one order

1. Checkout creates the order and a payment with an idempotency key.
2. The provider (today, the simulator) confirms through a signed webhook.
3. In one transaction: the order is marked paid, entitlements are granted, the ledger records
   the sale, and an `order.paid` outbox event is written.
4. Ledger entries: `platform:clearing` (asset) is debited with the total; each `store:…:payable`
   (liability) is credited with the seller net; `platform:commission` (revenue) is credited with
   the 3.5%; collaborator shares move from the store payable to `user:…:earnings`.
5. A refund reverses the same entries proportionally, ends access on a full refund, and emits
   `order.refunded`.

## Ledger

Double entry with ASSET, LIABILITY, REVENUE and EXPENSE accounts. Balances are computed from
entries, never stored as a mutable number. The database enforces that transactions balance,
entries are immutable and currencies match (see DATABASE.md).

## Payment purposes

`ORDER`, `SUBSCRIPTION`, `CAMPAIGN_FUNDING`, `ADVERTISING`, `APP_PURCHASE`. Each has a handler
that runs only after the provider confirms.

## Payouts

A seller, creator or developer requests a payout from their available balance. Finance staff
approve it, and mark it paid only after the payment partner has sent the money. FAITH never sends
money itself. Rejecting a payout returns the balance.

## Not decided in code

- The final Pro price: set by staff in Admin → Settings. Until then upgrading is closed.
- The App Marketplace commission: set by finance. Until then paid apps are closed.

## Before real money

- A contract with a licensed payment partner (for Uzbekistan, for example Click or Payme).
- A verified adapter for that partner, including webhook signature checks and refunds.
- Legal review of terms, tax handling and data protection. The texts in the app are drafts.
- Reconciliation against the partner's settlement reports.
