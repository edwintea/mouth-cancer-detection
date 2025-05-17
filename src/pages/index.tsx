import { useState, useRef, useEffect } from "react";
import axios from "axios";
import '../styles/style.css';

export default function Home() {
  const [result, setResult] = useState<string>("");
  const [history, setHistory] = useState<any[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<string>("user");
  const [zoomLevel, setZoomLevel] = useState<number>(1);

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
          setZoomLevel(1);
        }
      } catch (err) {
        console.error("Error accessing camera: ", err);
        setResult("Cannot access camera. Please allow camera permission.");
      }
    }
    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
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
            headers: { "Content-Type": "multipart/form-data" },
          });
          if (!response.data.result || !Array.isArray(response.data.result)) {
            setResult("Invalid response from FastAPI ");
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

  const increaseZoom = () => {
    setZoomLevel((prev) => Math.min(prev + 0.1, 3));
  };

  const decreaseZoom = () => {
    setZoomLevel((prev) => Math.max(prev - 0.1, 1));
  };

  return (
    <div className="container">
      <img src="/static/images/logo_100.png" alt="Logo" className="logo" />

      <div className="videoContainer" style={{ position: "relative", textAlign: "center", marginBottom: 20 }}>
        <video
          ref={videoRef}
          className="video"
          style={{
            filter: loading ? "blur(6px)" : "none",
            transform: `scale(${zoomLevel})`,
            transformOrigin: "center center",
          }}
          playsInline
          muted
        />

        {loading && (
          <div className="loadingOverlay">
            <div className="loadingText">Processing...</div>
          </div>
        )}

        {/* Buttons container positioned at bottom */}
        <div className="buttonGrid" style={{ pointerEvents: loading ? "none" : "auto" }}>

          <button onClick={toggleCamera} className="iconButton" title="Switch Camera" type="button" >
            🔄
          </button>
          <button onClick={increaseZoom} className="iconButton" title="Zoom In" type="button">
            ➕
          </button>
          <button onClick={decreaseZoom} className="iconButton" title="Zoom Out" type="button">
            ➖
          </button>
          <button onClick={() => setResult("")} className="iconButton" title="Clear Result" type="button">
            ❌
          </button>
          <button onClick={clearHistory} className="iconButton" title="Clear History" type="button">
            🗑️
          </button>

          {/* Centered Scan Button - icon only */}
          <button
            onClick={captureAndSend}
            disabled={loading || !streaming}
            className="iconButton scanIconButton"
            title={loading ? "Analyzing…" : "Scan"}
            type="button"
          >
            📷
          </button>
        </div>

      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div className="resultContainer">
        {result ? (
          typeof result === "string" && result.trim().startsWith("[") ? (
            <div>
              <h2>Scan Result</h2>
              <ul className="resultList">
                {JSON.parse(result).map((item: any, index: number) => (
                  <li key={index} className="resultItem">
                    {item.image && (
                      <img src={item.image} alt={item.label} className="resultItemImage" />
                    )}
                    <span>{item.label}: {item.score.toFixed(2)}</span>
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

      <div className="historyContainer">
        <h2>Scan History</h2>
        {history.length > 0 ? (
          <ul className="historyList">
            {history.map((item: any, index: number) => (
              <li key={index} className="historyItem">
                <h3>Scan {index + 1}</h3>
                <ul className="resultList">
                  {Array.isArray(item) ? (
                    item.map((resultItem: any, resultIndex: number) => (
                      <li key={resultIndex} className="resultItem">
                        {resultItem.image && (
                          <img src={resultItem.image} alt={resultItem.label} className="resultItemImage" />
                        )}
                        <span>{resultItem.label}: {resultItem.score.toFixed(2)}</span>
                      </li>
                    ))
                  ) : (
                    <li>Invalid scan data</li>
                  )}
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

