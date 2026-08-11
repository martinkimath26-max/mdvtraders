exports.handler = async function (event) {
  const params = event.queryStringParameters || {};

  if (params.error) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/html" },
      body: `<h2>MDV Traders</h2>
             <p>Deriv authorization was not completed.</p>
             <p>${params.error_description || params.error}</p>`
    };
  }

  if (!params.code || !params.state) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain" },
      body: "Missing authorization code or state."
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: `
      <h2>MDV Traders</h2>
      <p>Deriv authorization was received successfully.</p>
      <p>OAuth callback is working.</p>
    `
  };
};
