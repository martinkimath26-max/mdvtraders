exports.handler = async function (event) {
  const params = event.queryStringParameters || {};

  if (params.error) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/html" },
      body: `
        <h2>MDV Traders</h2>
        <p>Deriv authorization was not completed.</p>
        <p>${params.error_description || params.error}</p>
      `
    };
  }

  if (!params.code || !params.state) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain" },
      body: "Missing authorization code or state."
    };
  }

  const cookies = event.headers.cookie || event.headers.Cookie || "";

  const getCookie = (name) => {
    const match = cookies.match(
      new RegExp("(?:^|;\\s*)" + name + "=([^;]*)")
    );

    return match ? decodeURIComponent(match[1]) : null;
  };

  const savedState = getCookie("deriv_state");
  const codeVerifier = getCookie("deriv_verifier");

  if (!savedState || !codeVerifier) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain" },
      body: "PKCE session information is missing."
    };
  }

  if (savedState !== params.state) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain" },
      body: "Invalid OAuth state."
    };
  }

  const clientId = "345iAqpGETySihqIPbSK5";

  const redirectUri =
    "https://mdvtraders.netlify.app/.netlify/functions/deriv-callback";

  try {
    const response = await fetch("https://auth.deriv.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code: params.code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      }).toString()
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Token exchange failed",
          details: data
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html",
        "Set-Cookie": [
          "deriv_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
          "deriv_verifier=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
        ].join(", ")
      },
      body: `
        <h2>MDV Traders</h2>
        <p>Deriv authorization completed successfully.</p>
        <p>Your account has been connected.</p>
      `
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Server error while connecting to Deriv."
    };
  }
};
