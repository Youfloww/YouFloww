# Focus Pledge credits

- `public/pledge/promise.webp`, `refund.webp`, `charity.webp`: original watercolour illustrations generated for
  YouFloww with Gemini image generation (`ask gimage`, prompted with the house café art as a style reference), then
  cut out and converted. No third-party art.
- Icons: lucide-react (ISC), already a project dependency.
- Payments: Razorpay Checkout (`https://checkout.razorpay.com/v1/checkout.js`), loaded at runtime only when someone
  pays, under Razorpay's merchant terms. It isn't bundled or copied.
- The server payment pattern (order → HMAC signature check → confirm capture with the Razorpay API → webhook
  backstop) follows the owner's own giftasite project (`~/Desktop/giftpage/src/lib/payments.ts`), rewritten here.
  No third-party code.
