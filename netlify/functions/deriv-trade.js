exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({
          error: "Method not allowed"
        })
      };
    }

    const body = JSON.parse(event.body || "{}");

    const {
      market,
      contract,
      amount,
      duration,
      barrier
    } = body;

    // DEMO SAFETY: real trading is disabled in this first version.
    const demoOnly = true;

    if (!market || !contract || !amount || !duration) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Missing trade parameters"
        })
      };
    }

    if (Number(amount) <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Invalid stake amount"
        })
      };
    }

    const barrierNeeded = [
      "DIGITMATCH",
      "DIGITDIFF",
      "DIGITOVER",
      "DIGITUNDER"
    ].includes(contract);

    if (barrierNeeded && !/^[0-9]$/.test(String(barrier || ""))) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "A target digit from 0 to 9 is required"
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        demoOnly,
        status: "Trade parameters accepted",
        message:
          "MDV Traders is ready for secure Deriv demo execution. No real trade was placed.",
        trade: {
          market,
          contract,
          amount: Number(amount),
          duration,
          barrier: barrier || null
        }
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Server error",
        message: error.message
      })
    };
  }
};
