//styles
import styles from "./Home.module.css";

import React, { useState } from "react";
import { useGemini } from "../../hooks/useGemini";
import { useJira } from "../../hooks/useJira";
import * as pdfjsLib from "pdfjs-dist";

// Set up the worker for pdfjs-dist using the local worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileMetadata, setFileMetadata] = useState<any>(null);
  const [browserCompatibility, setBrowserCompatibility] = useState<{
    dragDrop: boolean;
    fileReader: boolean;
    canvas: boolean;
    pdfjs: boolean;
  }>({
    dragDrop: false,
    fileReader: false,
    canvas: false,
    pdfjs: false
  });
  const { callGemini, loading, error, response, resetState } = useGemini();
  const { createJiraTickets, loading: jiraLoading, error: jiraError, response: jiraResponse, resetState: resetJiraState } = useJira();

  // Check browser compatibility on component mount
  React.useEffect(() => {
    const checkBrowserCompatibility = () => {
      const compatibility = {
        dragDrop: 'draggable' in document.createElement('div') && 'ondrop' in window,
        fileReader: typeof FileReader !== 'undefined',
        canvas: !!document.createElement('canvas').getContext,
        pdfjs: typeof pdfjsLib !== 'undefined'
      };
      setBrowserCompatibility(compatibility);
    };

    checkBrowserCompatibility();
  }, []);

  const extractPDFMetadata = async (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const uint8Array = new Uint8Array(buffer);

          const loadingTask = pdfjsLib.getDocument(uint8Array);
          const pdf = await loadingTask.promise;

          const metadata = {
            title: (pdf as any).info?.Title || 'Untitled',
            author: (pdf as any).info?.Author || 'Unknown',
            subject: (pdf as any).info?.Subject || '',
            creator: (pdf as any).info?.Creator || '',
            producer: (pdf as any).info?.Producer || '',
            creationDate: (pdf as any).info?.CreationDate ? new Date((pdf as any).info.CreationDate).toLocaleDateString() : 'Unknown',
            modificationDate: (pdf as any).info?.ModDate ? new Date((pdf as any).info.ModDate).toLocaleDateString() : 'Unknown',
            pageCount: pdf.numPages,
            fileSize: file.size,
            fileSizeFormatted: (file.size / (1024 * 1024)).toFixed(1) + ' MB'
          };

          resolve(metadata);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  const generatePDFThumbnail = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const uint8Array = new Uint8Array(buffer);

          const loadingTask = pdfjsLib.getDocument(uint8Array);
          const pdf = await loadingTask.promise;

          // Get the first page for thumbnail
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 0.5 });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          const renderContext = {
            canvasContext: context!,
            viewport: viewport,
            canvas: canvas
          };

          await page.render(renderContext).promise;
          const thumbnail = canvas.toDataURL('image/png');
          resolve(thumbnail);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

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
          const totalPages = pdf.numPages;

          // Extract text from all pages with progress tracking
          for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(" ");
            fullText += pageText + "\n";
            
            // Update progress
            const progress = Math.round((pageNum / totalPages) * 100);
            setExtractionProgress(progress);
            
            // Calculate estimated time remaining
            const startTime = Date.now();
            const elapsedTime = (Date.now() - startTime) / 1000;
            const pagesPerSecond = pageNum / elapsedTime;
            const remainingPages = totalPages - pageNum;
            const estimatedSeconds = Math.round(remainingPages / pagesPerSecond);
            
            if (estimatedSeconds > 0) {
              setEstimatedTime(`~${estimatedSeconds}s remaining`);
            }
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
    try {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setExtractedText("");
      setExtractionError("");
      return;
    }

      // Enhanced file validation
      if (!browserCompatibility.fileReader) {
        setExtractionError("❌ Your browser doesn't support file reading. Please use a modern browser like Chrome, Firefox, or Safari.");
        return;
      }

      // File type validation with MIME type fallback
      const isValidPDF = file.type === "application/pdf" || 
                        file.name.toLowerCase().endsWith('.pdf') ||
                        file.type === "application/octet-stream";
      
      if (!isValidPDF) {
        setExtractionError("❌ Please select a PDF file. Other file types are not supported.");
        return;
      }

      // File size validation (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setExtractionError(`❌ File too large! Your file is ${fileSizeMB}MB. Maximum size allowed is 10MB.`);
        return;
      }

      // File size too small validation (less than 1KB)
      if (file.size < 1024) {
        setExtractionError("❌ File appears to be empty or corrupted. Please select a valid PDF file.");
        return;
      }

      setSelectedFile(file);
      setExtractionError("");
      setIsExtracting(true);
      setExtractionProgress(0);
      setEstimatedTime("");
      setFilePreview(null);

      try {
        // Extract metadata first (with error handling)
        let metadata = null;
        try {
          metadata = await extractPDFMetadata(file);
          setFileMetadata(metadata);
        } catch (metadataError) {
          console.warn("Metadata extraction failed:", metadataError);
          // Continue without metadata
        }
        
        // Generate thumbnail (with error handling)
        try {
          if (browserCompatibility.canvas) {
            const thumbnail = await generatePDFThumbnail(file);
            setFilePreview(thumbnail);
          }
        } catch (thumbnailError) {
          console.warn("Thumbnail generation failed:", thumbnailError);
          // Continue without thumbnail
        }
        
        // Extract text (critical operation)
        const text = await extractTextFromPDF(file);
        setExtractedText(text);
        setIsExtracting(false);
      } catch (error) {
        console.error("PDF extraction error:", error);
        setExtractionError(
          "❌ Failed to extract text from PDF. The file may be corrupted or password-protected. Please try another file."
        );
        setExtractedText("");
        setIsExtracting(false);
      }
    } catch (error) {
      console.error("File handling error:", error);
      setExtractionError("❌ An unexpected error occurred while processing your file. Please try again.");
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // File type validation
    if (file.type !== "application/pdf") {
        setExtractionError("❌ Please select a PDF file. Other file types are not supported.");
        return;
      }

      // File size validation (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setExtractionError(`❌ File too large! Your file is ${fileSizeMB}MB. Maximum size allowed is 10MB.`);
        return;
      }

      // File size too small validation (less than 1KB)
      if (file.size < 1024) {
        setExtractionError("❌ File appears to be empty or corrupted. Please select a valid PDF file.");
      return;
    }

    setSelectedFile(file);
    setExtractionError("");
    setIsExtracting(true);
      setExtractionProgress(0);
      setEstimatedTime("");
      setFilePreview(null);

      try {
        // Extract metadata first
        const metadata = await extractPDFMetadata(file);
        setFileMetadata(metadata);
        
        // Generate thumbnail
        const thumbnail = await generatePDFThumbnail(file);
        setFilePreview(thumbnail);
        
        // Then extract text
      const text = await extractTextFromPDF(file);
      setExtractedText(text);
      setIsExtracting(false);
    } catch (error) {
      console.error("PDF extraction error:", error);
      setExtractionError(
          "❌ Failed to extract text from PDF. The file may be corrupted or password-protected. Please try another file."
      );
      setExtractedText("");
      setIsExtracting(false);
      }
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
    setFilePreview(null);
    setFileMetadata(null);
    setExtractionProgress(0);
    setEstimatedTime("");
    resetState();
    resetJiraState();

    // Clear the file input
    const fileInput = document.getElementById("pdfFile") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handlePushToJira = async (actionItems: any[]) => {
    const result = await createJiraTickets(actionItems);
    
    if (result.success) {
      console.log("Jira tickets created:", result.data);
    } else {
      console.error("Failed to create Jira tickets:", result.error);
    }
  };

  const handleReplaceFile = () => {
    // Reset all file-related states
    setSelectedFile(null);
    setExtractedText("");
    setExtractionError("");
    setFilePreview(null);
    setFileMetadata(null);
    setExtractionProgress(0);
    setEstimatedTime("");
    resetState();
    
    // Trigger file input click
    document.getElementById('pdfFile')?.click();
  };

  // Check if JavaScript is disabled
  const [jsEnabled, setJsEnabled] = React.useState(false);
  
  React.useEffect(() => {
    setJsEnabled(true);
  }, []);

  if (!jsEnabled) {
  return (
      <div className={styles.container}>
        <h1>Policy Compass</h1>
        <div className={styles.noJsMessage}>
          <h2>JavaScript Required</h2>
          <p>This application requires JavaScript to function properly. Please enable JavaScript in your browser and refresh the page.</p>
          <p>Modern browsers like Chrome, Firefox, Safari, and Edge support all required features.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1>Policy Compass</h1>
      <p>
        Upload or paste your policy document to get AI-powered insights and
        analysis.
      </p>
        
        {/* Browser compatibility warnings */}
        {!browserCompatibility.fileReader && (
          <div className={styles.compatibilityWarning}>
            <strong>⚠️ Browser Compatibility Issue:</strong> Your browser doesn't support file reading. Please use a modern browser.
          </div>
        )}
        
        {!browserCompatibility.dragDrop && (
          <div className={styles.compatibilityWarning}>
            <strong>ℹ️ Limited Functionality:</strong> Drag and drop is not supported in your browser. You can still upload files using the file picker.
          </div>
        )}

      <div className={styles.inputSection}>
        <label htmlFor="pdfFile" className={styles.label}>
          Upload your PDF policy document to analyze:
        </label>
        
        <div 
          className={`${styles.fileUploadArea} ${isDragOver ? styles.dragOver : ''}`}
          onClick={() => document.getElementById('pdfFile')?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
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
            <div className={styles.fileHeader}>
            <p>Selected: {selectedFile.name}</p>
              {filePreview && (
                <div className={styles.filePreview}>
                  <img 
                    src={filePreview} 
                    alt="PDF Preview" 
                    className={styles.thumbnail}
                  />
                  <div className={styles.fileDetails}>
                    <span className={styles.fileType}>PDF Document</span>
                    <span className={styles.fileSize}>
                      {fileMetadata?.fileSizeFormatted || (selectedFile.size / (1024 * 1024)).toFixed(1) + ' MB'}
                    </span>
                    {fileMetadata && (
                      <div className={styles.metadataInfo}>
                        <span className={styles.pageCount}>{fileMetadata.pageCount} pages</span>
                        {fileMetadata.title !== 'Untitled' && (
                          <span className={styles.documentTitle}>{fileMetadata.title}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {isExtracting && (
              <div className={styles.processingContainer}>
              <p className={styles.processing}>Extracting text from PDF...</p>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill}
                    style={{ width: `${extractionProgress}%` }}
                  ></div>
                </div>
                <div className={styles.progressInfo}>
                  <span className={styles.progressPercentage}>{extractionProgress}%</span>
                  {estimatedTime && (
                    <span className={styles.estimatedTime}>{estimatedTime}</span>
                  )}
                </div>
              </div>
            )}
            {extractionError && (
              <p className={styles.error}>{extractionError}</p>
            )}
            {extractedText && !isExtracting && (
              <div className={styles.fileActions}>
              <p className={styles.success}>
                ✓ Text extracted successfully ({extractedText.length}{" "}
                characters)
              </p>
                <button 
                  className={styles.replaceButton}
                  onClick={handleReplaceFile}
                  title="Replace with a different PDF"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                    <path d="M21 3v5h-5"></path>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                    <path d="M3 21v-5h5"></path>
                  </svg>
                  Replace File
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.buttonGroup}>
        <button
          onClick={handleAnalyzeClick}
          disabled={loading || isExtracting}
          className={styles.analyzeBtn}
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
                          <div className={styles.actionItemsHeader}>
                            <h4 className={styles.sectionTitle}>
                              Action Items ({analysisData.actionItems.length})
                            </h4>
                            <button
                              className={styles.jiraButton}
                              onClick={() => handlePushToJira(analysisData.actionItems)}
                              disabled={jiraLoading}
                            >
                              {jiraLoading ? "Creating Tickets..." : "Push to Jira"}
                            </button>
                          </div>
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

                    {/* Jira Integration Status */}
                    {jiraResponse && (
                      <div className={styles.jiraStatus}>
                        {jiraResponse.success ? (
                          <div className={styles.jiraSuccess}>
                            <h5>✅ Jira Tickets Created Successfully!</h5>
                            <p>
                              Created {jiraResponse.data?.totalCreated} tickets. 
                              {(jiraResponse.data?.totalErrors || 0) > 0 && 
                                ` ${jiraResponse.data?.totalErrors} failed.`
                              }
                            </p>
                            {jiraResponse.data?.createdTickets && jiraResponse.data.createdTickets.length > 0 && (
                              <div className={styles.jiraLinks}>
                                <strong>Created Tickets:</strong>
                                <ul>
                                  {jiraResponse.data.createdTickets.map((ticket, index) => (
                                    <li key={index}>
                                      <a 
                                        href={ticket.jiraUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className={styles.jiraLink}
                                      >
                                        {ticket.jiraKey}: {ticket.actionItem.title}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className={styles.jiraError}>
                            <h5>❌ Failed to Create Jira Tickets</h5>
                            <p>{jiraError}</p>
                          </div>
                        )}
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
