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
    // Exchange authorization code for access token
    const tokenResponse = await fetch(
      "https://auth.deriv.com/oauth2/token",
      {
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
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Token exchange failed",
          details: tokenData
        })
      };
    }

    const accessToken = tokenData.access_token;

    // Get the user's Deriv Options accounts
    const accountResponse = await fetch(
      "https://api.derivws.com/trading/v1/options/accounts",
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Deriv-App-ID": clientId
        }
      }
    );

    const accountData = await accountResponse.json();

    if (!accountResponse.ok) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Connected successfully, but account information could not be retrieved.",
          details: accountData
        })
      };
    }

    const accounts = accountData.data || [];

    const accountList = accounts
      .map(account => `
        <div style="margin:15px 0;padding:15px;border:1px solid #ddd;border-radius:8px;">
          <p><strong>Account:</strong> ${account.account_id || "N/A"}</p>
          <p><strong>Balance:</strong> ${account.balance ?? "N/A"} ${account.currency || ""}</p>
          <p><strong>Type:</strong> ${account.account_type || "N/A"}</p>
          <p><strong>Status:</strong> ${account.status || "N/A"}</p>
        </div>
      `)
      .join("");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html"
      },
      multiValueHeaders: {
        "Set-Cookie": [
          "deriv_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
          "deriv_verifier=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
        ]
      },
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>MDV Traders</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family:Arial,sans-serif;padding:30px;">
          <h2>MDV Traders</h2>
          <h3>✅ Deriv Account Connected</h3>

          ${accountList || "<p>No Options account was returned.</p>"}

          <p>Your Deriv authorization is working.</p>
        </body>
        </html>
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
