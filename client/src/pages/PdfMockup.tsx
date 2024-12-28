import React, { useEffect, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';

// Tell pdfjs where to find the worker (important for react-pdf):
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ExtractedSegment {
  id: number;
  text: string;
  boundingBox?: { x0: number; y0: number; x1: number; y1: number }; // Optional bounding box info
}

const PDFMockup: React.FC = () => {
  const [file, setFile] = useState<File | null>(null); // State to hold the uploaded file
  const [extractedText, setExtractedText] = useState<ExtractedSegment[]>([]); // State for extracted text
  const [loading, setLoading] = useState(false); // Loading state for backend requests
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  // Function to send file to backend and fetch extracted data
  const fetchExtractedData = async (pdfFile: File) => {
    setLoading(true);
  
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
  
      // Send the file to the backend endpoint
      const response = await fetch('http://localhost:3000/upload', {
        method: 'POST',
        body: formData,
      });
  
      console.log(response);
      if (!response.ok) {
        throw new Error('Failed to fetch extracted data');
      }
  
      const result = await response.json();
  
      console.log(result.data);
  
      // Recursive function to extract segments from nested data
      const extractSegments = (data: any, parentKey: string = ''): ExtractedSegment[] => {
        const segments: ExtractedSegment[] = [];
  
        for (const key in data) {
          if (typeof data[key] === 'object' && data[key] !== null) {
            // If the object contains "value" and "boundingBox", treat it as a segment
            if ('value' in data[key] && 'boundingBox' in data[key]) {
              segments.push({
                id: segments.length,
                text: `${parentKey ? `${parentKey}: ` : ''}${data[key].value}`,
                boundingBox: data[key].boundingBox,
              });
            } else {
              // Recursively extract from nested objects
              segments.push(...extractSegments(data[key], key));
            }
          }
        }
  
        return segments;
      };
  
      // Use the recursive function to process the result
      const segments = extractSegments(result.data);
  
      setExtractedText(segments); // Update the extracted text state
    } catch (error) {
      console.error('Error fetching extracted data:', error);
      alert('Failed to fetch extracted data. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      fetchExtractedData(selectedFile); // Trigger backend request
    }
  };

  // Mock highlight actions
  const highlightSegment = (segmentId: number) => {
    console.log(`Hover on text snippet ID #${segmentId}`);
    // You can implement bounding box overlays on the PDF page here
  };

  const unhighlightSegment = (segmentId: number) => {
    console.log(`Stop hover on text snippet ID #${segmentId}`);
  };

  // Update file URL whenever a new file is selected
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);

      // Cleanup the URL when the component unmounts or file changes
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top bar for file upload */}
      <div style={{ padding: '1rem', backgroundColor: '#f7f7f7' }}>
        <input type="file" accept="application/pdf" onChange={handleFileUpload} />
      </div>

      {/* Main content split view */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Left panel: extracted text list */}
        <div
          style={{
            width: '35%',
            borderRight: '1px solid #ccc',
            overflowY: 'auto',
            padding: '1rem',
          }}
        >
          <h2>Extracted Text</h2>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ul style={{ listStyleType: 'none', padding: 0 }}>
              {extractedText.map((segment) => (
                <li
                  key={segment.id}
                  style={{
                    margin: '0.5rem 0',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '4px',
                  }}
                  onMouseEnter={() => highlightSegment(segment.id)}
                  onMouseLeave={() => unhighlightSegment(segment.id)}
                >
                  {segment.text}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right panel: PDF viewer */}
        <div style={{ width: '65%', position: 'relative', padding: '1rem' }}>
          <h2>PDF Viewer</h2>
          {file ? (
            <Document file={fileUrl}>
              <Page pageNumber={1} />
            </Document>
          ) : (
            <p>No PDF loaded</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFMockup;
