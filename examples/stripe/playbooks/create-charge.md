# Playbook: Create a Charge

1. Collect `amount`, `currency`, and a payment `source` from the caller.
2. POST to `/v1/charges` with the parameters above.
3. On success, return the Charge object's `id`.
4. On `card_declined`, surface the decline reason to the user and prompt
   them to try a different payment method.
