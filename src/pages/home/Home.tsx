//styles
import styles from "./Home.module.css";

import React, { useState } from "react";
import { useGemini } from "../../hooks/useGemini";
import * as pdfjsLib from "pdfjs-dist";

// Set up the worker for pdfjs-dist using the local worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState("");
  const {
    callGemini,
    loading,
    error,
    response,
    formattedResponse,
    resetState,
  } = useGemini();

  const extractTextFromPDF = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const uint8Array = new Uint8Array(buffer);

          const loadingTask = pdfjsLib.getDocument(uint8Array);
          const pdf = await loadingTask.promise;

          let fullText = "";

          // Extract text from all pages
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(" ");
            fullText += pageText + "\n";
          }

          resolve(fullText.trim());
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setExtractedText("");
      setExtractionError("");
      return;
    }

    if (file.type !== "application/pdf") {
      setExtractionError("Please select a PDF file.");
      return;
    }

    setSelectedFile(file);
    setExtractionError("");
    setIsExtracting(true);

    try {
      const text = await extractTextFromPDF(file);
      setExtractedText(text);
      setIsExtracting(false);
    } catch (error) {
      console.error("PDF extraction error:", error);
      setExtractionError(
        "Failed to extract text from PDF. Please try another file."
      );
      setExtractedText("");
      setIsExtracting(false);
    }
  };

  const handleAnalyzeClick = async () => {
    if (!extractedText.trim()) {
      alert(
        "Please upload a PDF file and wait for text extraction to complete."
      );
      return;
    }

    const result = await callGemini(extractedText.trim());

    if (result.success) {
      console.log("Gemini response:", result.data);
    } else {
      console.error("Gemini error:", result.error);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setExtractedText("");
    setExtractionError("");
    resetState();

    // Clear the file input
    const fileInput = document.getElementById("pdfFile") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  return (
    <div className={styles.container}>
      <h1>Policy Compass</h1>
      <p>
        Upload or paste your policy document to get AI-powered insights and
        analysis.
      </p>

      <div className={styles.inputSection}>
        <label htmlFor="pdfFile" className={styles.label}>
          Upload your PDF policy document to analyze:
        </label>
        <input
          type="file"
          id="pdfFile"
          accept=".pdf"
          onChange={handleFileChange}
          className={styles.fileInput}
        />

        {selectedFile && (
          <div className={styles.fileInfo}>
            <p>Selected: {selectedFile.name}</p>
            {isExtracting && (
              <p className={styles.processing}>Extracting text from PDF...</p>
            )}
            {extractionError && (
              <p className={styles.error}>{extractionError}</p>
            )}
            {extractedText && !isExtracting && (
              <p className={styles.success}>
                ✓ Text extracted successfully ({extractedText.length}{" "}
                characters)
              </p>
            )}
          </div>
        )}
      </div>

      <div className={styles.buttonGroup}>
        <button
          onClick={handleAnalyzeClick}
          disabled={loading || !extractedText.trim() || isExtracting}
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
