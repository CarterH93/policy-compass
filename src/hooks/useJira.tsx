import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuthContext } from "./useAuthContext";

interface JiraTicket {
  jiraKey: string;
  jiraUrl: string;
  actionItem: any;
}

interface JiraResponse {
  success: boolean;
  data?: {
    createdTickets: JiraTicket[];
    errors: any[];
    totalCreated: number;
    totalErrors: number;
  };
  error?: string;
}

export const useJira = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<JiraResponse | null>(null);
  const { user } = useAuthContext();

  const createJiraTickets = async (actionItems: any[]): Promise<JiraResponse> => {
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
      const createJiraTickets = httpsCallable(functions, "CreateJiraTickets");

      const result = await createJiraTickets({
        actionItems,
      });

      const responseData = result.data as JiraResponse;
      setResponse(responseData);
      setLoading(false);

      return responseData;
    } catch (error: any) {
      let errorMessage = "Failed to create Jira tickets";

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
    createJiraTickets,
    loading,
    error,
    response,
    resetState,
  };
};
