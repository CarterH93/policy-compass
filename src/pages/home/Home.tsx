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
  const { callGemini, loading, error, response, resetState } = useGemini();

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
        
        <div className={styles.fileUploadArea} onClick={() => document.getElementById('pdfFile')?.click()}>
          <svg className={styles.uploadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7,10 12,15 17,10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <div className={styles.uploadText}>
            {selectedFile ? selectedFile.name : "Click to upload or drag and drop"}
          </div>
          <div className={styles.uploadSubtext}>
            PDF files only, up to 10MB
          </div>
        </div>
        
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
          className={styles.primaryBtn}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4"></path>
            <path d="M9 11V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
            <path d="M9 7h6"></path>
          </svg>
          {loading ? "Processing..." : "Analyze Document"}
        </button>
        <button
          onClick={handleClear}
          disabled={loading}
          className={styles.secondaryBtn}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18"></path>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
          </svg>
          Clear
        </button>
        <button
          onClick={() => window.print()}
          disabled={loading}
          className={styles.secondaryBtn}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"></path>
            <path d="M18 9h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2"></path>
            <path d="M6 14h12"></path>
            <path d="M6 18h12"></path>
          </svg>
          Export Report
        </button>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {response && (
        <div className={styles.responseContainer}>
          <h3>Compliance Analysis Results</h3>

          {(() => {
            try {
              const analysisData = response.data?.response;

              if (
                analysisData &&
                typeof analysisData === "object" &&
                analysisData.overallScore !== undefined
              ) {
                return (
                  <div className={styles.analysisDashboard}>
                    {/* Score Section */}
                    <div className={styles.scoreSection}>
                      <div className={styles.scoreDisplay}>
                        <div className={styles.scoreProgressBar}>
                          <div 
                            className={styles.scoreProgressFill}
                            style={{ width: `${analysisData.overallScore}%` }}
                          ></div>
                        </div>
                        <div className={styles.scoreNumber}>
                          {analysisData.overallScore}/100
                        </div>
                        <div
                          className={`${styles.complianceLevel} ${
                            styles[
                              analysisData.complianceLevel?.toLowerCase()
                            ] || styles.unknown
                          }`}
                        >
                          {analysisData.complianceLevel} Compliance
                        </div>
                        <p className={styles.summary}>{analysisData.summary}</p>
                      </div>
                    </div>

                    {/* Action Items Section */}
                    {analysisData.actionItems &&
                      analysisData.actionItems.length > 0 && (
                        <div className={styles.actionItemsSection}>
                          <h4 className={styles.sectionTitle}>
                            Action Items ({analysisData.actionItems.length})
                          </h4>
                          <div className={styles.actionItemsList}>
                            {analysisData.actionItems.map(
                              (item: any, index: number) => (
                                <div
                                  key={item.id || index}
                                  className={styles.actionItem}
                                >
                                  <div className={styles.actionItemHeader}>
                                    <div className={styles.actionItemTitle}>
                                      <span className={styles.itemId}>
                                        {item.id ||
                                          `AI-${(index + 1)
                                            .toString()
                                            .padStart(3, "0")}`}
                                      </span>
                                      <h5>
                                        {item.title ||
                                          `Action Item ${index + 1}`}
                                      </h5>
                                    </div>
                                    <div className={styles.actionItemBadges}>
                                      <span
                                        className={`${styles.priorityBadge} ${
                                          styles[
                                            item.priority?.toLowerCase()
                                          ] || styles.unknown
                                        }`}
                                      >
                                        {item.priority || "Unknown"}
                                      </span>
                                      <span
                                        className={`${styles.effortBadge} ${
                                          styles[item.effort?.toLowerCase()] ||
                                          styles.unknown
                                        }`}
                                      >
                                        {item.effort || "Unknown"} Effort
                                      </span>
                                    </div>
                                  </div>

                                  <p className={styles.actionItemDescription}>
                                    {item.description ||
                                      "No description provided"}
                                  </p>

                                  <div className={styles.actionItemFooter}>
                                    <div className={styles.timeline}>
                                      <strong>Timeline:</strong>{" "}
                                      {item.timeline || "TBD"}
                                    </div>

                                    {item.controls &&
                                      item.controls.length > 0 && (
                                        <div className={styles.controls}>
                                          <strong>Controls:</strong>
                                          <div className={styles.controlTags}>
                                            {item.controls.map(
                                              (
                                                control: string,
                                                cIndex: number
                                              ) => (
                                                <span
                                                  key={cIndex}
                                                  className={styles.controlTag}
                                                >
                                                  {control}
                                                </span>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                );
              } else {
                // Fallback to raw JSON display for invalid or unexpected format
                return (
                  <div className={styles.fallbackResponse}>
                    <h4>Analysis Response:</h4>
                    <pre className={styles.rawResponse}>
                      {JSON.stringify(analysisData, null, 2)}
                    </pre>
                  </div>
                );
              }
            } catch (error) {
              // Fallback to raw JSON display if parsing fails
              return (
                <pre className={styles.rawResponse}>
                  {JSON.stringify(response, null, 2)}
                </pre>
              );
            }
          })()}

          <p className={styles.timestamp}>
            Generated: {new Date(response.data?.timestamp).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
