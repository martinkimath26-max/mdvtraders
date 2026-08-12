const WebSocket = require("ws");

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: {
          "Content-Type": "application/json"
        },
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

    /*
     * DEMO SAFETY
     *
     * This version is deliberately locked to the
     * demo account and only requests a proposal.
     *
     * It DOES NOT send the "buy" command.
     */

    const DEMO_ACCOUNT = "DOT93679289";
    const CLIENT_ID = "345iAqpGETySihqIPbSK5";

    if (!market || !contract || !amount || !duration) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Missing trade parameters."
        })
      };
    }

    const stake = Number(amount);

    if (!Number.isFinite(stake) || stake <= 0) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Invalid stake amount."
        })
      };
    }

    const barrierNeeded = [
      "DIGITMATCH",
      "DIGITDIFF",
      "DIGITOVER",
      "DIGITUNDER"
    ].includes(contract);

    if (
      barrierNeeded &&
      !/^[0-9]$/.test(String(barrier || ""))
    ) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error:
            "A target digit from 0 to 9 is required."
        })
      };
    }

    /*
     * ------------------------------------------------
     * 1. READ MDV SESSION COOKIE
     * ------------------------------------------------
     */

    const cookies =
      event.headers.cookie ||
      event.headers.Cookie ||
      "";

    const getCookie = (name) => {
      const match = cookies.match(
        new RegExp(
          "(?:^|;\\s*)" +
          name +
          "=([^;]*)"
        )
      );

      return match
        ? decodeURIComponent(match[1])
        : null;
    };

    const sessionToken =
      getCookie("mdv_session");

    if (!sessionToken) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error:
            "MDV session not found. Please connect your Deriv account first."
        })
      };
    }

    /*
     * ------------------------------------------------
     * 2. LOAD SESSION FROM SUPABASE
     * ------------------------------------------------
     */

    const supabaseUrl =
      process.env.SUPABASE_URL;

    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !supabaseServiceKey
    ) {
      throw new Error(
        "Supabase environment variables are missing."
      );
    }

    const sessionResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/deriv_sessions?session_token=eq.${encodeURIComponent(
          sessionToken
        )}&select=session_token,access_token,expires_at&limit=1`,
        {
          method: "GET",

          headers: {
            "apikey": supabaseServiceKey,
            "Authorization":
              `Bearer ${supabaseServiceKey}`
          }
        }
      );

    if (!sessionResponse.ok) {
      throw new Error(
        "Unable to read MDV trading session."
      );
    }

    const sessions =
      await sessionResponse.json();

    if (
      !Array.isArray(sessions) ||
      sessions.length === 0
    ) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error:
            "MDV trading session is invalid or expired. Please reconnect Deriv."
        })
      };
    }

    const session = sessions[0];

    const accessToken =
      session.access_token;

    if (!accessToken) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error:
            "Deriv access token is missing from the secure session."
        })
      };
    }

    /*
     * ------------------------------------------------
     * 3. CHECK TOKEN EXPIRY
     * ------------------------------------------------
     */

    if (session.expires_at) {

      const expiry =
        new Date(session.expires_at).getTime();

      if (
        Number.isFinite(expiry) &&
        Date.now() >= expiry
      ) {
        return {
          statusCode: 401,
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            error:
              "Deriv authorization has expired. Please reconnect your account."
          })
        };
      }
    }

    /*
     * ------------------------------------------------
     * 4. GET DEMO ACCOUNT OTP
     * ------------------------------------------------
     */

    const otpResponse =
      await fetch(
        `https://api.derivws.com/trading/v1/options/accounts/${DEMO_ACCOUNT}/otp`,
        {
          method: "POST",

          headers: {
            "Authorization":
              `Bearer ${accessToken}`,

            "Deriv-App-ID":
              CLIENT_ID
          }
        }
      );

    const otpData =
      await otpResponse.json();

    if (
      !otpResponse.ok ||
      !otpData.data ||
      !otpData.data.url
    ) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error:
            "Unable to create Deriv demo WebSocket session.",

          details: otpData
        })
      };
    }

    const wsUrl =
      otpData.data.url;

    /*
     * ------------------------------------------------
     * 5. CONNECT TO AUTHENTICATED DEMO WEBSOCKET
     * ------------------------------------------------
     */

    const proposal =
      await getProposal(
        wsUrl,
        {
          market,
          contract,
          stake,
          duration,
          barrier
        }
      );

    /*
     * ------------------------------------------------
     * 6. RETURN PROPOSAL
     *
     * IMPORTANT:
     * NO BUY COMMAND IS SENT.
     * ------------------------------------------------
     */

    return {
      statusCode: 200,

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        success: true,

        demoOnly: true,

        bought: false,

        account: DEMO_ACCOUNT,

        message:
          "Deriv demo proposal received successfully. No contract was purchased.",

        proposal
      })
    };

  } catch (error) {

    console.error(
      "MDV Deriv trade error:",
      error
    );

    return {
      statusCode: 500,

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        error:
          "MDV trading backend error.",

        message:
          error.message
      })
    };
  }
};


/*
 * ====================================================
 * GET DERIV PROPOSAL
 * ====================================================
 */

function getProposal(
  wsUrl,
  trade
) {

  return new Promise(
    (resolve, reject) => {

      let finished = false;

      const ws =
        new WebSocket(wsUrl);

      const timeout =
        setTimeout(() => {

          if (finished) return;

          finished = true;

          try {
            ws.close();
          } catch (_) {}

          reject(
            new Error(
              "Deriv WebSocket proposal request timed out."
            )
          );

        }, 15000);


      ws.on("open", () => {

        /*
         * Build the proposal request.
         */

        const request = {

          proposal: 1,

          amount: trade.stake,

          basis: "stake",

          contract_type:
            trade.contract,

          currency: "USD",

          duration:
            Number(trade.duration),

          duration_unit:
            trade.duration === "60"
              ? "s"
              : "t",

          underlying_symbol:
            trade.market,

          req_id: 1

        };


        /*
         * Digit contracts require a barrier.
         */

        if (
          [
            "DIGITMATCH",
            "DIGITDIFF",
            "DIGITOVER",
            "DIGITUNDER"
          ].includes(
            trade.contract
          )
        ) {

          request.barrier =
            String(trade.barrier);

        }


        ws.send(
          JSON.stringify(request)
        );

      });


      ws.on("message", (message) => {

        try {

          const data =
            JSON.parse(
              message.toString()
            );


          if (
            data.error
          ) {

            if (finished) return;

            finished = true;

            clearTimeout(timeout);

            try {
              ws.close();
            } catch (_) {}

            reject(
              new Error(
                data.error.message ||
                "Deriv rejected the proposal request."
              )
            );

            return;
          }


          if (
            data.msg_type ===
            "proposal"
          ) {

            if (finished) return;

            finished = true;

            clearTimeout(timeout);

            const proposal =
              data.proposal || {};


            try {
              ws.close();
            } catch (_) {}


            resolve({

              id:
                proposal.id ||
                null,

              ask_price:
                proposal.ask_price ??
                null,

              payout:
                proposal.payout ??
                null,

              spot:
                proposal.spot ??
                null,

              display_value:
                proposal.display_value ??
                null,

              longcode:
                proposal.longcode ??
                null

            });

          }

        } catch (error) {

          if (finished) return;

          finished = true;

          clearTimeout(timeout);

          try {
            ws.close();
          } catch (_) {}

          reject(error);

        }

      });


      ws.on("error", (error) => {

        if (finished) return;

        finished = true;

        clearTimeout(timeout);

        reject(
          new Error(
            error.message ||
            "Deriv WebSocket connection failed."
          )
        );

      });


      ws.on("close", () => {

        if (finished) return;

        /*
         * Do nothing here.
         *
         * A normal close can happen after the
         * proposal response has been received.
         */

      });

    }
  );
          }
