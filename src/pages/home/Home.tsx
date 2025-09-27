//styles
import styles from "./Home.module.css";

import React from "react";
import { useGemini } from "../../hooks/useGemini";

export default function Home() {
  const { callGemini, loading, error, response, resetState } = useGemini();

  const handleTestClick = async () => {
    const result = await callGemini(
      { prompt: "Hello from Policy Compass!" },
      "test"
    );

    if (result.success) {
      console.log("Gemini response:", result.data);
    } else {
      console.error("Gemini error:", result.error);
    }
  };

  return (
    <div>
      <h1>Home</h1>
      <button onClick={handleTestClick} disabled={loading}>
        {loading ? "Processing..." : "Test Gemini"}
      </button>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {response && (
        <p style={{ color: "green" }}>Response: {JSON.stringify(response)}</p>
      )}
    </div>
  );
}
