# Stripe

Stripe is a payments API for charging cards, managing customers, and handling subscriptions. Authenticate with a secret key (`sk_live_…`) via HTTP Basic auth, username only. Base URL: `https://api.stripe.com/v1`. Responses are JSON; errors follow RFC 7807 style `{ error: { code, message } }`.

Core capabilities: create charges, refund charges, list customers, create subscriptions, cancel subscriptions.

Read .agentdocs/stripe/tasks.yaml for endpoint reference. Playbooks in playbooks/.
