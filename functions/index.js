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
        model: "gemini-2.5-flash-lite",
      });

      let prompt = `You are a compliance analyst. Analyze the following policy document against NIST 800-171 and ISO27001 standards.

Return ONLY a valid JSON object with this exact structure:
{
  "overallScore": 75,
  "complianceLevel": "Fair",
  "summary": "Brief 2-3 sentence summary of overall compliance status",
  "actionItems": [
    {
      "id": "AI-001",
      "title": "Implement Multi-Factor Authentication",
      "description": "Deploy MFA for all user accounts accessing sensitive systems",
      "priority": "High",
      "effort": "Medium",
      "timeline": "30 days",
      "controls": ["NIST-3.5.3", "ISO-27001-A.9.2.3"]
    }
  ]
}

Scoring Guidelines:
- 90-100: Excellent compliance
- 80-89: Good compliance with minor gaps
- 70-79: Fair compliance with moderate gaps
- 60-69: Poor compliance with significant gaps
- Below 60: Critical compliance failures

Priority Levels: High, Medium, Low
Effort Levels: Low, Medium, High
Timeline: Specific timeframes (e.g., "30 days", "3 months", "6 months")

Focus on the most critical security controls and provide actionable, specific recommendations.

Policy Document:
${requestData}`;

      // Generate content using Gemini
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Clean up the response text to ensure it's valid JSON
      let cleanText = text;
      
      // Remove markdown code blocks if present
      if (cleanText.includes('```json')) {
        cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      }
      
      // Try to parse and validate JSON
      try {
        const parsedJson = JSON.parse(cleanText);
        
        // Validate required fields
        if (typeof parsedJson.overallScore !== 'number' || !Array.isArray(parsedJson.actionItems)) {
          throw new Error('Invalid JSON structure');
        }
        
        return {
          success: true,
          data: {
            response: parsedJson,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (parseError) {
        console.warn('Failed to parse Gemini response as JSON:', parseError);
        // Return a fallback response
        return {
          success: true,
          data: {
            response: {
              overallScore: 0,
              complianceLevel: "Unknown",
              summary: "Unable to parse analysis results. Please try again.",
              actionItems: []
            },
            timestamp: new Date().toISOString(),
          },
        };
      }
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
