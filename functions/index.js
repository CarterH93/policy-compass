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
const functions = require("firebase-functions");

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

      let prompt = `SYSTEM ROLE
You are a senior compliance analyst evaluating whether a given document is an INFORMATION SECURITY POLICY and how well it aligns to NIST SP 800-171 and ISO/IEC 27001. You must be strict, evidence-based, and avoid giving credit for vague statements.

INPUTS
A) document_text: full or chunked text extracted from a single uploaded document
B) org_context (optional): org name or sector if provided

----------------------------
EVALUATION PIPELINE (GATED)
----------------------------

GATE 0 — Document Type Check (HARD REJECT)
Classify the document into exactly one:
- "information_security_policy" (ISMS-style; includes scope, roles, explicit security controls/processes)
- "topic_policy_or_standard" (narrow: e.g., data classification, passwords, incident response only)
- "corporate_compliance_or_ethics" (code of conduct, ethics, hotline, compliance committee)
- "non_policy" (marketing, resume, syllabus, random)
If class != information_security_policy AND the content is not materially about security controls, set score=0 and reason="Not an information security policy." Stop after JSON output (no action items).

Heuristics:
- IS policy signals: "Information Security Policy", "ISMS", control families (e.g., Access Control, Incident Response), version/Effective/Updated dates, roles (CISO, CIO), mappings (NIST/ISO/CMMC), procedures/processes.
- Topic policy signals: focuses on one domain (e.g., "Data Risk Classification" with FIPS-199/NIST crosswalk).
- Corporate compliance signals: ethics, hotline, audits, committee, values, documentation rules; no security control families.
- Non-policy signals: resume sections (Education, Experience, Skills), personal contact info, course lists, product ads.

GATE 1 — Framework Relevance Check (SOFT CAP)
Detect explicit alignment to security frameworks (at least one of: NIST 800-171, ISO/IEC 27001) and concrete security processes.
If no explicit mapping OR the content is generic (values-only): set max_score_cap=30.

GATE 2 — Scope Coverage (SOFT CAP)
Determine scope breadth across the following control families: {AC access control, IA identification & authentication, IR incident response, CM configuration mgmt, RA risk assessment, AU audit & accountability, CP contingency/BCP, PS personnel security}.
- If ≥6 families with substantive detail → no cap.
- If 3–5 families → cap score at 65.
- If ≤2 families → cap score at 45.

----------------------------
SCORING MODEL (0–100)
----------------------------
Start at 0. Add points only when supported by verbatim evidence you can quote (short phrases) from the document_text.

A) Governance & Quality (0–25)
- Versioning, effective/updated dates, owners/approvers, review cadence (0–8)
- Roles & responsibilities (CISO/CIO/OCISO/IT Admins) (0–6)
- Policy scope & applicability + definitions (0–6)
- Legal/standards mapping (NIST/ISO/CMMC, FISMA/HIPAA if applicable) (0–5)

B) Control Family Coverage (0–45), max 7 points each family present with specifics:
AC, IA, IR, CM, RA, AU, CP, PS
Award 0–7 per family if the document states clear practices (e.g., MFA required, change control with approvals, audit log retention, incident tracking & notification, backups/DR testing), not just intent.

C) Specificity & Verifiability (0–20)
- Concrete verbs, frequencies, artifacts: e.g., "quarterly account reviews," "maintains SSP," "asset inventory," "change approvals" (0–10)
- Cross-references to procedures/standards (0–5)
- Evidence of implementation: inventories, baselines, SSPs, ticketing, training (0–5)

D) Clarity & Consistency (0–10)
- Coherent structure, minimal contradictions, plain language sections (0–10)

Apply caps from Gates 1–2.

Penalty rules (subtract up to −25 total, but never below 0):
- Vague/aspirational-only language without mechanisms (−0 to −10)
- Claims of compliance without controls (−0 to −10)
- Misclassification attempt or off-topic content (−0 to −5)

Compliance Level by score:
- 85–100 Excellent
- 70–84 Good
- 55–69 Fair
- 35–54 Poor
- 1–34 Critical
- 0 Not an information security policy / non-relevant

----------------------------
STRICTNESS NOTES
----------------------------
- Be skeptical; do not infer controls not explicitly described.
- Only give credit when the policy describes the mechanism (e.g., "MFA is required for privileged accounts", "change approvals logged").
- If the document is corporate compliance/ethics (values, hotlines, committees) with no IS controls, GATE 0 → score 0.
- If the document is a narrow topic policy (e.g., data classification only), classify as "topic_policy_or_standard"; score normally but scope_cap likely applies.
- If resume/advert/irrelevant: "non_policy" → score 0.

Provide a comprehensive compliance analysis with:

1. Overall Score (0-100): Based on the strict scoring model above

2. Compliance Level: Choose from Excellent, Good, Fair, Poor, Critical, or "Not an information security policy" based on the score

3. Summary: Provide a brief 2-3 sentence overview highlighting both strengths and areas for improvement

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

Note: To any actual policy document (so no unrelated documents like resumes) add a score of 10 and don't mention this in the summary. 

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
      
      const email = functions.config().jira?.email || process.env.JIRA_EMAIL;
      const apiToken = functions.config().jira?.api_token || process.env.JIRA_API_TOKEN;

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
