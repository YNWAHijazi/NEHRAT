# Resend setup

The app sends invitations, activation links and password resets through the Resend HTTPS API. This works on all Railway plans; Railway restricts outbound SMTP on Free, Trial and Hobby plans. Generic SMTP remains available only when no Resend key is configured.

## Connect the sender

1. Sign into your Resend account and verify a domain you control, using the DNS records Resend supplies. Ministry branding does not imply ownership of a Ministry email domain.
2. Create a sending-only API key for that domain.
3. In Railway → NEHRAT → production → Variables, store `RESEND_API_KEY`, `MAIL_FROM` (for example `NEHRAT <notifications@your-verified-domain>`), and `APP_BASE_URL=https://nehrat-production.up.railway.app`. Keep the actual key out of Git and chat.
4. Deploy the tested application. The owner console shows whether the sender is configured and the count of accepted/failed sending attempts.
5. Test an invitation, activation and password reset using an authorized real test inbox. Demo accounts deliberately never send external messages. Check both the inbox and Resend's delivery activity, then follow each link through its intended account flow.

`sent` means Resend accepted the request; it does not guarantee inbox delivery. The app uses a 15-second request limit, idempotency keys and sanitized delivery logs. Provider errors, rate limits and timeouts produce `failed`, with no keys or invitation tokens logged. There is no background retry queue or delivery-webhook integration; delivered/bounced status is available in Resend.

## Verified documentation

- [Resend sending API](https://resend.com/docs/api-reference/emails/send-email)
- [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)
- [Railway outbound email restrictions](https://docs.railway.com/networking/outbound-networking)

On September 18, the owner chose to postpone sender setup because no sending domain is available yet. These three production variables were absent. Manual invitation links remain available; automatic invitations, activation emails and password-reset emails are not operational until the sender is connected and real inbox delivery is verified.

## Email verification

The September 26 update adds email verification after password sign-in, signup and account recovery. Once the verified sender works, set `REQUIRE_EMAIL_OTP=true` in Railway and deploy. Leave it unset until delivery is tested: when enabled, an unavailable sender prevents new sign-ins rather than bypassing verification. Demonstration accounts remain exempt and never send mail.

Codes last 10 minutes, allow five attempts and can be used once. Resends wait 60 seconds and are limited to five per account per hour. These limits live in `lib/auth-policy.json`. Phone numbers are captured for contact; SMS verification is not enabled.
