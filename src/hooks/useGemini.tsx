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

export const useGemini = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<any>(null);
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

      // Validate that we received a valid JSON response
      if (
        !responseData?.data?.response ||
        typeof responseData.data.response !== "object"
      ) {
        throw new Error(
          "Invalid response format: Expected structured JSON object"
        );
      }

      setResponse(responseData);

      setLoading(false);

      return { success: true, data: responseData };
    } catch (error: any) {
      let errorMessage = "Failed to call Gemini function";

      if (error.code === "functions/unauthenticated") {
        errorMessage = "User not authenticated";
      } else if (error.code === "functions/failed-precondition") {
        errorMessage = error.message || "API configuration error";
      } else if (error.code === "functions/resource-exhausted") {
        errorMessage = "API quota exceeded. Please try again later.";
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
    setLoading(false);
  };

  return {
    callGemini,
    loading,
    error,
    response,
    resetState,
  };
};
