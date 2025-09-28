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

// Import axios for HTTP requests
const axios = require("axios");

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

SCORING METHODOLOGY:
Use a balanced, constructive approach that recognizes existing security measures while identifying improvement opportunities. Start with a baseline score and adjust based on findings.

1. Overall Score (0-100) - Use these very generous ranges:
   - 75-100: Excellent compliance (good security foundation)
   - 60-74: Good compliance (reasonable security measures)
   - 45-59: Fair compliance (basic security in place)
   - 30-44: Poor compliance (needs improvement)
   - Below 30: Critical compliance failures (major security risks)

2. Scoring Guidelines - Be VERY generous:
   - Start with a baseline score of 70-75 for any policy document
   - Add 5-10 points for each security control that is mentioned or partially addressed
   - Add 15-20 points for each security control that is well-documented
   - Only subtract points for completely missing critical controls (max -10 points per control)
   - Give full credit for any mention of security measures, even if brief
   - Consider the document's scope and intended audience - be understanding
   - Be very constructive and encouraging in your assessment
   - Remember: most organizations are doing better than they think

3. Compliance Level: Choose from Excellent, Good, Fair, Poor, or Critical based on the score

4. Summary: Provide a brief 2-3 sentence overview highlighting both strengths and areas for improvement

5. Action Items: Create specific, actionable recommendations with:
   - Unique ID (format: AI-001, AI-002, etc.)
   - Clear title and detailed description
   - Priority: High, Medium, or Low
   - Effort: Low, Medium, or High
   - Timeline: Specific timeframes (e.g., "30 days", "3 months", "6 months")
   - Controls: List relevant NIST 800-171 and ISO27001 control references
   For the controls, seperate each control number individually. Do not group them together using commas.
   Do not do this: ISO27001 A.9.1.1, A.9.2.1, A.9.2.2, A.9.2.3, A.9.2.4, A.9.3.1, A.9.4.1, A.9.4.4, A.13.2.4

Focus on the most critical security controls and provide actionable, specific recommendations that will have the greatest impact on improving compliance. Be encouraging and constructive in your feedback.

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

// Jira Integration Function
exports.CreateJiraTickets = onCall(
  {
    cors: true,
  },
  async (request) => {
    const { actionItems } = request.data;
    const auth = request.auth;

    if (!auth) {
      throw new HttpsError(
        "unauthenticated",
        "User not authenticated, could not create Jira tickets"
      );
    }

    if (!actionItems || !Array.isArray(actionItems)) {
      throw new HttpsError(
        "invalid-argument",
        "actionItems array is required"
      );
    }

    try {
      const jiraUrl = "https://pokalaanurag.atlassian.net";
      const projectKey = "SCRUM";
      const issueType = "Task";
      
      const email = "pokala.anurag@gmail.com";
      const apiToken = "ATATT3xFfGF0JSMMGftVymZMxoxeO_hkH42kzrCL2jkS64w1xk6IW0nqT9JpLnlPrTMXuI0tGlfAw4sZ0pKTPGO0jTCc1JpNBSlWKWNRRbgx7s5IpVbeTnrjkiNnIZOJbJXOYTlqwAQBzA9jb7nN0dWdZQEzXhP2KBf0KRcQNuk2RLI6vr4AiP8=459C083A";

      if (!email || !apiToken) {
        throw new HttpsError(
          "failed-precondition",
          "Jira credentials not configured"
        );
      }

      const createdTickets = [];
      const errors = [];

      // Create tickets for each action item
      for (const item of actionItems) {
        try {
          const ticketData = {
            fields: {
              project: {
                key: projectKey
              },
              issuetype: {
                name: issueType
              },
              summary: item.title || `Compliance Action Item: ${item.id}`,
              description: {
                type: "doc",
                version: 1,
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: item.description || "No description provided"
                      }
                    ]
                  },
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: `Priority: ${item.priority || 'Unknown'}`
                      }
                    ]
                  },
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: `Effort: ${item.effort || 'Unknown'}`
                      }
                    ]
                  },
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: `Timeline: ${item.timeline || 'TBD'}`
                      }
                    ]
                  }
                ]
              },
              priority: {
                name: mapPriorityToJira(item.priority)
              },
              labels: [
                "compliance",
                "policy-compass",
                `priority-${(item.priority || 'unknown').toLowerCase()}`
              ]
            }
          };

          // Add controls as labels if available
          if (item.controls && Array.isArray(item.controls)) {
            item.controls.forEach(control => {
              ticketData.fields.labels.push(`control-${control.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`);
            });
          }

          const response = await axios.post(
            `${jiraUrl}/rest/api/3/issue`,
            ticketData,
            {
              headers: {
                'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
                'Content-Type': 'application/json'
              }
            }
          );

          createdTickets.push({
            jiraKey: response.data.key,
            jiraUrl: `${jiraUrl}/browse/${response.data.key}`,
            actionItem: item
          });

        } catch (error) {
          console.error(`Failed to create ticket for action item ${item.id}:`, error.response?.data || error.message);
          errors.push({
            actionItem: item,
            error: error.response?.data?.errorMessages?.[0] || error.message
          });
        }
      }

      return {
        success: true,
        data: {
          createdTickets,
          errors,
          totalCreated: createdTickets.length,
          totalErrors: errors.length
        }
      };

    } catch (error) {
      console.error("Jira API Error:", error);
      throw new HttpsError(
        "internal",
        `Failed to create Jira tickets: ${error.message}`
      );
    }
  }
);

// Helper function to map priority levels to Jira priorities
function mapPriorityToJira(priority) {
  const priorityMap = {
    'High': 'High',
    'Medium': 'Medium', 
    'Low': 'Low'
  };
  return priorityMap[priority] || 'Medium';
}
