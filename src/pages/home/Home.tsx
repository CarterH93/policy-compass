//styles
import styles from "./Home.module.css";

import React from "react";
import { useGemini } from "../../hooks/useGemini";

export default function Home() {
  const {
    callGemini,
    loading,
    error,
    response,
    formattedResponse,
    resetState,
  } = useGemini();

  const handleTestClick = async () => {
    const result = await callGemini(
      "This is a test document. There are many issues."
    );

    if (result.success) {
      console.log("Gemini response:", result.data);
    } else {
      console.error("Gemini error:", result.error);
    }
  };

  return (
    <div className={styles.container}>
      <h1>Policy Compass</h1>
      <p>
        Upload or paste your policy document to get AI-powered insights and
        analysis.
      </p>

      <button onClick={handleTestClick} disabled={loading}>
        {loading ? "Processing..." : "Test Gemini Analysis"}
      </button>

      {error && (
        <div className={styles.errorMessage}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {response && (
        <div className={styles.responseContainer}>
          <h3>Analysis Results:</h3>
          {formattedResponse ? (
            <div
              className={styles.formattedResponse}
              dangerouslySetInnerHTML={{ __html: formattedResponse }}
            />
          ) : (
            <pre className={styles.rawResponse}>
              {JSON.stringify(response, null, 2)}
            </pre>
          )}
          <p className={styles.timestamp}>
            Generated: {new Date(response.data?.timestamp).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
