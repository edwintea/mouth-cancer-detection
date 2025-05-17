import { useState, useRef, useEffect } from "react";
import axios from "axios";

export default function Home() {
  const [result, setResult] = useState("");
  const [history, setHistory] = useState([]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState("user");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedHistory = localStorage.getItem("scanHistory");
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    }
  }, []);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraFacingMode },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreaming(true);
        }
      } catch (err) {
        console.error("Error accessing camera: ", err);
        setResult("Cannot access camera. Please allow camera permission.");
      }
    }
    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, [cameraFacingMode]);

  const captureAndSend = async () => {
    if (!streaming || !videoRef.current || !canvasRef.current) {
      setResult("Camera is not ready.");
      return;
    }

    if (loading) {
      return;
    }

    setLoading(true);
    setResult("Processing...");

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setResult("Canvas context not available.");
      setLoading(false);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setResult("Failed to capture image.");
          setLoading(false);
          return;
        }
        try {
          const formData = new FormData();
          formData.append("image", blob, "capture.jpg");

          const response = await axios.post("/api/inference", formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });

          if (!response.data.result || !Array.isArray(response.data.result)) {
            setResult("Invalid response from FastAPI");
            setLoading(false);
            return;
          }

          setResult(JSON.stringify(response.data.result, null, 2));
          const newHistory = [...history, response.data.result];
          setHistory(newHistory);
          if (typeof window !== "undefined") {
            localStorage.setItem("scanHistory", JSON.stringify(newHistory));
          }
        } catch (error) {
          console.error("Error sending image:", error);
          setResult("Error processing image. Try again!");
        }
        setLoading(false);
      },
      "image/jpeg",
      0.95
    );
  };

  const toggleCamera = () => {
    setCameraFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("scanHistory");
  };

  const buttonGridStyle = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px 16px", // vertical and horizontal gaps between buttons
    maxWidth: 360,
    margin: "0 auto 1rem",
    };


  return (
    <div style={containerStyle}>
      <img src="/static/images/logo_100.png" alt="Logo" style={logoStyle} />

      <div style={{ position: "relative", textAlign: "center", marginBottom: 12 }}>
        <video
          ref={videoRef}
          style={{
            ...videoStyle,
            filter: loading ? "blur(6px)" : "none",
            transition: "filter 0.3s ease",
          }}
          playsInline
          muted
        />
        {loading && (
          <div style={loadingOverlayStyle}>
            <div style={loadingTextStyle}>Processing...</div>
          </div>
        )}
      </div>

    <div style={buttonGridStyle}>
        <button onClick={toggleCamera} style={buttonStyle}>
          Switch Camera
        </button>
        <button onClick={captureAndSend} disabled={loading || !streaming} style={buttonStyle}>
          {loading ? "Analyzing…" : "Scan Mouth"}
        </button>
        <button onClick={() => setResult("")} style={buttonStyle}>
          Clear Result
        </button>
        <button onClick={clearHistory} style={buttonStyle}>
          Clear History
        </button>
      </div>


      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>

      <div style={resultContainerStyle}>
        {result ? (
          typeof result === "string" && result.trim().startsWith("[") ? (
            <div>
              <h2>Scan Result</h2>
              <ul style={resultListStyle}>
                {JSON.parse(result).map((item, index) => (
                  <li key={index} style={resultItemStyle}>
                    {item.label}: {item.score.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>{result}</p>
          )
        ) : (
          <p>No result yet.</p>
        )}
      </div>

      <div style={historyContainerStyle}>
        <h2>Scan History</h2>
        {history.length > 0 ? (
          <ul style={historyListStyle}>
            {history.map((item, index) => (
              <li key={index} style={historyItemStyle}>
                <h3>Scan {index + 1}</h3>
                <ul style={resultListStyle}>
                  {item.map((resultItem, resultIndex) => (
                    <li key={resultIndex} style={resultItemStyle}>
                      {resultItem.label}: {resultItem.score.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p>No scan history available.</p>
        )}
      </div>
    </div>
  );
}

// Styles

const containerStyle = {
  maxWidth: 480,
  margin: "2rem auto",
  padding: "1rem",
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  color: "#222",
  backgroundColor: "#f9fafb",
  borderRadius: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
};

const logoStyle = {
  display: "block",
  margin: "0 auto 1rem",
  width: "100px",
};

const videoStyle = {
  width: "100%",
  borderRadius: 10,
  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
  backgroundColor: "#000",
};

const loadingOverlayStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "rgba(255, 255, 255, 0.5)",
  borderRadius: 10,
  pointerEvents: "none",
};

const loadingTextStyle = {
  fontSize: "1.5rem",
  fontWeight: "700",
  color: "#0070f3",
  userSelect: "none",
};

const buttonStyle = {
  backgroundColor: "#0070f3",
  color: "#fff",
  border: "none",
  padding: "0.75rem 1.25rem",
  fontSize: "1rem",
  borderRadius: 12,
  cursor: "pointer",
  transition: "background-color 0.3s ease, transform 0.15s ease",
  boxShadow: "0 4px 8px rgba(0, 112, 243, 0.3)",
};

const hoverButtonStyle = {
  backgroundColor: "#005bb5",
  transform: "scale(1.05)",
};


const resultContainerStyle = {
  marginTop: 20,
  backgroundColor: "#fff",
  padding: 16,
  borderRadius: 8,
  minHeight: 60,
  boxShadow: "inset 0 0 4px #ddd",
  fontSize: 16,
  wordBreak: "break-word",
  whiteSpace: "pre-wrap",
  fontFamily: "Consolas, monospace",
  overflowX: "auto",
};

const resultListStyle = {
  listStyleType: "none",
  padding: 0,
};

const resultItemStyle = {
  margin: "5px 0",
};

const historyContainerStyle = {
  marginTop: 20,
  backgroundColor: "#fff",
  padding: 16,
  borderRadius: 8,
  boxShadow: "inset 0 0 4px #ddd",
};

const historyListStyle = {
  listStyleType: "none",
  padding: 0,
};

const historyItemStyle = {
  margin: "10px 0",
};

