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

  const callGemini = async (
    requestData: any,
    requestType: string
  ): Promise<GeminiResponse> => {
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
        requestType,
      } as GeminiRequest);

      const responseData = result.data;
      setResponse(responseData);
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
