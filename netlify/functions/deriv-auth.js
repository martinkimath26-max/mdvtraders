const crypto = require("crypto");

exports.handler = async function () {
  const clientId = "345iAqpGETySihqIPbSK5";
  const redirectUri =
    "https://mdvtraders.netlify.app/.netlify/functions/deriv-callback";

  const bytes = crypto.randomBytes(32);
  const codeVerifier = bytes.toString("base64url");

  const hash = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest();

  const codeChallenge = hash.toString("base64url");

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
      ]
    }
  };
};
