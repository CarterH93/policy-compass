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

      // Define the response schema for structured output
      const responseSchema = {
        type: "object",
        properties: {
          overallScore: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            description: "Overall compliance score from 0-100",
          },
          complianceLevel: {
            type: "string",
            enum: ["Excellent", "Good", "Fair", "Poor", "Critical"],
            description: "Overall compliance level based on the score",
          },
          summary: {
            type: "string",
            description:
              "Brief 2-3 sentence summary of overall compliance status",
          },
          actionItems: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "Unique identifier for the action item",
                },
                title: {
                  type: "string",
                  description: "Title of the action item",
                },
                description: {
                  type: "string",
                  description: "Detailed description of what needs to be done",
                },
                priority: {
                  type: "string",
                  enum: ["High", "Medium", "Low"],
                  description: "Priority level of the action item",
                },
                effort: {
                  type: "string",
                  enum: ["Low", "Medium", "High"],
                  description:
                    "Effort level required to complete the action item",
                },
                timeline: {
                  type: "string",
                  description:
                    "Estimated timeline for completion (e.g., '30 days', '3 months')",
                },
                controls: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "Related NIST 800-171 and ISO27001 controls",
                },
              },
              required: [
                "id",
                "title",
                "description",
                "priority",
                "effort",
                "timeline",
                "controls",
              ],
            },
            description: "List of recommended actions to improve compliance",
          },
        },
        required: ["overallScore", "complianceLevel", "summary", "actionItems"],
      };

      // Get the generative model with structured output
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
      });

      let prompt = `You are a compliance analyst. Analyze the following policy document against NIST 800-171 and ISO27001 standards.

Provide a comprehensive compliance analysis with:

1. Overall Score (0-100):
   - 90-100: Excellent compliance
   - 80-89: Good compliance with minor gaps
   - 70-79: Fair compliance with moderate gaps
   - 60-69: Poor compliance with significant gaps
   - Below 60: Critical compliance failures

2. Compliance Level: Choose from Excellent, Good, Fair, Poor, or Critical based on the score

3. Summary: Provide a brief 2-3 sentence overview of the overall compliance status

4. Action Items: Create specific, actionable recommendations with:
   - Unique ID (format: AI-001, AI-002, etc.)
   - Clear title and detailed description
   - Priority: High, Medium, or Low
   - Effort: Low, Medium, or High
   - Timeline: Specific timeframes (e.g., "30 days", "3 months", "6 months")
   - Controls: List relevant NIST 800-171 and ISO27001 control references
   For the controls, seperate each control number individually. Do not group them together using commas.
   Do not do this: ISO27001 A.9.1.1, A.9.2.1, A.9.2.2, A.9.2.3, A.9.2.4, A.9.3.1, A.9.4.1, A.9.4.4, A.13.2.4

Focus on the most critical security controls and provide actionable, specific recommendations that will have the greatest impact on improving compliance.

Policy Document:
${requestData}`;

      // Generate content using Gemini with structured output
      const result = await model.generateContent(prompt);
      const response = await result.response;

      // With structured output, the response is already properly formatted JSON
      const structuredData = JSON.parse(response.text());

      return {
        success: true,
        data: {
          response: structuredData,
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

      if (error.message && error.message.includes("quota")) {
        throw new HttpsError(
          "resource-exhausted",
          "API quota exceeded. Please try again later."
        );
      }

      if (error.message && error.message.includes("safety")) {
        throw new HttpsError(
          "failed-precondition",
          "Content was flagged by safety filters. Please review your policy document."
        );
      }

      // Handle JSON parsing errors (rare with structured output but still possible)
      if (error instanceof SyntaxError) {
        throw new HttpsError(
          "internal",
          "Failed to process structured response from AI model"
        );
      }

      throw new HttpsError(
        "internal",
        `Failed to process request with Gemini API: ${error.message}`
      );
    }
  }
);
