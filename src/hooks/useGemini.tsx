import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuthContext } from "./useAuthContext";

interface GeminiRequest {
  requestData: any;
  requestType: string;
}

interface GeminiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Function to format the response text for better readability
const formatResponse = (responseText: string): string => {
  if (!responseText) return "";

  // Clean up the response text
  let formatted = responseText
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold text
    .replace(/\*(.*?)\*/g, "<em>$1</em>") // Italic text
    .replace(/###\s(.*)/g, "<h3>$1</h3>") // H3 headers
    .replace(/##\s(.*)/g, "<h2>$1</h2>") // H2 headers
    .replace(/---/g, "<hr />") // Horizontal rules
    .replace(/\n\n/g, "</p><p>") // Paragraphs
    .replace(/^(.*)$/gm, (match, p1) => {
      // Handle bullet points
      if (p1.trim().startsWith("*") || p1.trim().startsWith("-")) {
        return `<li>${p1.replace(/^[\s*-]+/, "")}</li>`;
      }
      return match;
    });

  // Wrap consecutive list items in ul tags
  formatted = formatted.replace(/(<li>.*<\/li>)/g, "<ul>$1</ul>");
  formatted = formatted.replace(/<\/ul>\s*<ul>/g, "");

  // Add paragraph tags
  if (!formatted.startsWith("<")) {
    formatted = "<p>" + formatted + "</p>";
  }

  return formatted;
};

export const useGemini = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [formattedResponse, setFormattedResponse] = useState<string>("");
  const { user } = useAuthContext();

  const callGemini = async (requestData: any): Promise<GeminiResponse> => {
    if (!user) {
      const errorMessage = "User not authenticated";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const functions = getFunctions();
      const geminiCall = httpsCallable(functions, "GeminiCall");

      const result = await geminiCall({
        requestData,
      } as GeminiRequest);

      const responseData = result.data as any;
      setResponse(responseData);

      // Format the response text if it exists
      if (responseData?.data?.response) {
        const formatted = formatResponse(responseData.data.response);
        setFormattedResponse(formatted);
      }

      setLoading(false);

      return { success: true, data: responseData };
    } catch (error: any) {
      let errorMessage = "Failed to call Gemini function";

      if (error.code === "functions/unauthenticated") {
        errorMessage = "User not authenticated";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      setLoading(false);

      return { success: false, error: errorMessage };
    }
  };

  const resetState = () => {
    setError(null);
    setResponse(null);
    setFormattedResponse("");
    setLoading(false);
  };

  return {
    callGemini,
    loading,
    error,
    response,
    formattedResponse,
    resetState,
  };
};
