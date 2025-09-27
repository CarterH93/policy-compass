/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Dependencies for callable functions.
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const { setGlobalOptions } = require("firebase-functions");

// Import Gemini AI SDK
const { GoogleGenerativeAI } = require("@google/generative-ai");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 5 });

exports.GeminiCall = onCall(
  {
    cors: true,
    secrets: ["GEMINI_API_KEY"],
  },
  async (request) => {
    const requestData = request.data.requestData;
    // Authentication / user information is automatically added to the request.
    const auth = request.auth;

    if (!auth) {
      throw new HttpsError(
        "unauthenticated",
        "user not authenticated, could not access Gemini API"
      );
    }

    // Validate required parameters
    if (!requestData) {
      throw new HttpsError("invalid-argument", "requestData are required");
    }

    try {
      // Initialize Gemini AI with API key from environment variable
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

      // Get the generative model
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
      });

      let prompt = `Analyze the following policy document and provide insights: ${requestData}`;

      // Generate content using Gemini
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return {
        success: true,
        data: {
          response: text,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("Gemini API Error:", error);

      // Handle specific errors
      if (error.message && error.message.includes("API key")) {
        throw new HttpsError(
          "failed-precondition",
          "Gemini API key not configured properly"
        );
      }

      throw new HttpsError(
        "internal",
        `Failed to process request with Gemini API: ${error.message}`
      );
    }
  }
);
