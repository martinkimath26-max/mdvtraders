# MDV Traders starter website

This is a front-end demo for MDV Traders.

## Before live trading
1. Register an OAuth 2.0 application with Deriv.
2. Configure an HTTPS callback URL.
3. Implement OAuth 2.0 + PKCE on a backend.
4. Exchange the authorization code server-side.
5. Obtain an authenticated Deriv WebSocket URL through the OTP endpoint.
6. Implement proposals/buy/contract monitoring and your own strategy engine.
7. Test on demo before enabling real trading.

Do not put Deriv client secrets or user access tokens in browser code.
