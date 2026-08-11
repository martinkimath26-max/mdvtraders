exports.handler = async function () {
  const clientId = "345iAqpGETySihqIPbSK5";
  const redirectUri =
    "https://mdvtraders.netlify.app/.netlify/functions/deriv-callback";

  // PKCE verifier
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = Buffer.from(bytes).toString("base64url");

  // PKCE challenge
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier)
  );

  const codeChallenge = Buffer.from(hash).toString("base64url");

  // CSRF protection
  const state = crypto.randomUUID();

  const url = new URL("https://auth.deriv.com/oauth2/auth");

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "trade");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return {
    statusCode: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": [
        `deriv_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax`,
        `deriv_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; SameSite=Lax`
      ].join(", ")
    }
  };
};
