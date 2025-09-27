//styles
import styles from "./Home.module.css";

import React, { useState } from "react";
import { useGemini } from "../../hooks/useGemini";

export default function Home() {
  const [inputText, setInputText] = useState("");
  const {
    callGemini,
    loading,
    error,
    response,
    formattedResponse,
    resetState,
  } = useGemini();

  const handleAnalyzeClick = async () => {
    if (!inputText.trim()) {
      alert("Please enter some text to analyze.");
      return;
    }

    const result = await callGemini(inputText.trim());

    if (result.success) {
      console.log("Gemini response:", result.data);
    } else {
      console.error("Gemini error:", result.error);
    }
  };

  const handleClear = () => {
    setInputText("");
    resetState();
  };

  return (
    <div className={styles.container}>
      <h1>Policy Compass</h1>
      <p>
        Upload or paste your policy document to get AI-powered insights and
        analysis.
      </p>

      <div className={styles.inputSection}>
        <label htmlFor="policyText" className={styles.label}>
          Enter your policy document or text to analyze:
        </label>
        <textarea
          id="policyText"
          className={styles.textarea}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste your policy document or any text you'd like to analyze here..."
          rows={8}
        />
      </div>

      <div className={styles.buttonGroup}>
        <button
          onClick={handleAnalyzeClick}
          disabled={loading || !inputText.trim()}
        >
          {loading ? "Processing..." : "Analyze Document"}
        </button>
        <button
          onClick={handleClear}
          disabled={loading}
          className={styles.secondaryButton}
        >
          Clear
        </button>
      </div>

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
