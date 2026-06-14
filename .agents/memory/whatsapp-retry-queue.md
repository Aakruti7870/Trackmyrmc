---
name: WhatsApp retry queue
description: How transient WhatsApp business-notification failures are retried out-of-band, and the classification + locking rules to keep consistent.
---

# WhatsApp business-notification retry

Order/dispatch/delivery WhatsApp updates are best-effort and fire-and-forget. A
durable retry queue (`whatsapp_retries` table) re-sends only *transient* inline
failures so a brief provider blip no longer silently drops a customer update.

## What counts as transient (retryable)
`sendWhatsAppTemplate` sets `result.retryable`:
- **true**: network/connection throw, Twilio 5xx, or 429 (rate limited).
- **false (permanent, never queued)**: any other 4xx (invalid number, template
  error, auth), missing recipient, missing template, or provider unconfigured.

**Why:** retrying a permanent failure just churns attempts until exhausted and
delays nothing useful. The retryable flag is the single source of truth the
queue keys off — keep new failure branches classifying it explicitly.

## Locking / scheduling rule
`runDueWhatsAppRetries` uses a **two-phase lease**, NOT a single tx like the
recurring-order scheduler: phase 1 claims the oldest due row in a short tx
(`FOR UPDATE SKIP LOCKED` + push `nextAttemptAt` forward by a lease), phase 2
does the provider HTTP send with **no transaction/lock held**, phase 3 records
the outcome.

**Why:** the recurring scheduler does pure DB work inside its tx, so holding the
row lock is fine. A WhatsApp retry makes a network call per row — holding a
pooled connection + row lock across that I/O risks pool exhaustion and long
lock waits. The lease still gives crash-safe at-least-once delivery: a crash
mid-send just lets the lease expire and the row becomes due again.

**How to apply:** any future "claim a row, then do slow/network work, then write
the result" loop should lease + release rather than wrap the I/O in the tx.

## Attempts accounting
`attempts` = sends made so far; the inline send counts as attempt 1, so a freshly
enqueued row starts at `attempts=1`. `MAX_ATTEMPTS` is the TOTAL (inline +
background). Backoff doubles from a base, capped at a ceiling.
