import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  GoogleMap,
  Marker,
  useJsApiLoader
} from "@react-google-maps/api";

export default function Home() {
  const [result, setResult] = useState<string>("");
  const [history, setHistory] = useState<any[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<string>("user");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const mapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""; // Google Maps API key

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: mapApiKey,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedHistory = localStorage.getItem("scanHistory");
      if (savedHistory) {
        try {
          const parsed = JSON.parse(savedHistory);
          // Sort descending by timestamp (newest first)
          parsed.sort(
            (a: any, b: any) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          setHistory(parsed);
        } catch {
          setHistory([]);
        }
      }
    }
  }, []);

  const updateHistory = (newHistory: any[]) => {
    // Sort descending by timestamp (newest first) before setting and saving
    const sorted = [...newHistory].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    setHistory(sorted);
    localStorage.setItem("scanHistory", JSON.stringify(sorted));
  };

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
    if (loading) return;

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

        const processImageWithoutGeo = async () => {
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

            const inferenceResult = response.data.result;
            setResult(JSON.stringify(inferenceResult, null, 2));

            const newEntry = {
              result: inferenceResult,
              latitude: null,
              longitude: null,
              timestamp: new Date().toISOString(),
            };

            const newHistory = [newEntry, ...history]; // Add new entry to the beginning
            updateHistory(newHistory);
          } catch (error) {
            console.error("Error sending image:", error);
            setResult("Error processing image. Try again!");
          } finally {
            setLoading(false);
          }
        };

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const latitude = position.coords.latitude;
              const longitude = position.coords.longitude;

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

                const inferenceResult = response.data.result;
                setResult(JSON.stringify(inferenceResult, null, 2));

                const newEntry = {
                  result: inferenceResult,
                  latitude,
                  longitude,
                  timestamp: new Date().toISOString(),
                };

                const newHistory = [newEntry, ...history]; // Add new entry to the beginning
                updateHistory(newHistory);
              } catch (error) {
                console.error("Error sending image:", error);
                setResult("Error processing image. Try again!");
              } finally {
                setLoading(false);
              }
            },
            async (error) => {
              console.error("Error getting location:", error);
              setResult("Error getting location. Proceeding without location.");
              await processImageWithoutGeo();
            }
          );
        } else {
          setResult("Geolocation is not supported by this browser. Proceeding without location.");
          await processImageWithoutGeo();
        }
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
    <>
      <style>{`
        .container {
          max-width: 720px;
          margin: 0 auto;
          padding: 16px;
          font-family: 'Inter', sans-serif;
          color: #222;
        }
        .logo {
          display: block;
          margin: 0 auto 24px;
          max-width: 100px;
          user-select: none;
        }
        .videoContainer {
          position: relative;
          text-align: center;
          margin-bottom: 20px;
        }
        video.video {
          width: 100%;
          border-radius: 12px;
          background: black;
          transition: filter 0.3s ease, transform 0.3s ease;
        }
        .loadingOverlay {
          position: absolute;
          top: 0; bottom: 0; left: 0; right: 0;
          background: rgba(0,0,0,0.45);
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1.25rem;
          user-select: none;
        }
        .buttonGrid {
          pointer-events: auto;
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px;
          max-width: 640px;
          margin: 0 auto;
        }
        button.iconButton {
          background: transparent;
          border: none;
          color: #007bff;
          border-radius: 8px;
          padding: 0;
          font-size: 1.25rem;
          cursor: pointer;
          transition: color 0.2s ease;
          user-select: none;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        button.iconButton:disabled {
          color: #999;
          cursor: not-allowed;
        }
        button.iconButton:hover:not(:disabled) {
          color: #0056b3;
        }
        .scanIconButton {
          font-size: 4.5rem;  /* Bigger font size for camera icon */
          width: 96px;        /* Larger width */
          height: 96px;       /* Larger height */
          margin: 0 16px;
          border-radius: 50%;
          box-shadow: 0 0 12px rgba(34,197,94, 0.7);
          background: rgba(22, 163, 74, 0.15);
          color: #16a34a;
          flex-shrink: 0;
          animation: pulseScan 1.5s infinite ease-in-out;
        }
        .scanIconButton:hover:not(:disabled) {
          background: rgba(22, 163, 74, 0.3);
          color: #15803d;
        }
        @keyframes pulseScan {
          0%, 100% {
            box-shadow: 0 0 12px rgba(34,197,94, 0.7);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 20px rgba(34,197,94, 1);
            transform: scale(1.05);
          }
        }
        .resultContainer {
          max-width: 720px;
          margin: 32px auto;
          background: #f9f9f9;
          padding: 16px 24px;
          border-radius: 12px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.05);
          min-height: 80px;
          font-family: monospace;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .resultList, .historyList {
          list-style: none;
          padding-left: 0;
          margin: 8px 0 0 0;
        }
        .resultItem {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 0;
          border-bottom: 1px solid #ddd;
        }
        .resultItemImage {
          width: 40px;
          height: 40px;
          object-fit: cover;
          border-radius: 6px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          user-select: none;
        }
        .historyContainer {
          max-width: 720px;
          margin: 0 auto 64px;
          font-family: monospace;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .historyItem h3 {
          margin-bottom: 8px;
          font-weight: 600;
        }
        .scanOverlay {
          pointer-events: none;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: 12px;
          overflow: hidden;
          z-index: 10;
        }
        .scanLine {
          pointer-events: none;
          position: absolute;
          top: -20%;
          left: 0;
          width: 100%;
          height: 20%;
          background: linear-gradient(
            180deg,
            transparent,
            rgba(22, 163, 74, 0.3),
            rgba(22, 163, 74, 0.6),
            rgba(22, 163, 74, 0.3),
            transparent
          );
          animation: scanMove 2.5s linear infinite;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          z-index: 11;
        }
        @keyframes scanMove {
          0% {
            top: -20%;
          }
          100% {
            top: 100%;
          }
        }
        .loadingOverlay {
          pointer-events: auto;
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.45);
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1.25rem;
          user-select: none;
          z-index: 20;
        }
      `}</style>

      <div className="container" role="main">
        <img src="/static/images/logo_100.png" alt="Logo" className="logo" />

        <div className="videoContainer" aria-label="Camera preview area">
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
          {streaming && !loading && (
            <div className="scanOverlay" aria-hidden="true">
              <div className="scanLine"></div>
            </div>
          )}
          {loading && (
            <div className="loadingOverlay" aria-live="assertive" aria-label="Processing scan result">
              Processing...
            </div>
          )}

          <div className="buttonGrid" style={{ pointerEvents: loading ? "none" : "auto" }}>
            <button onClick={toggleCamera} className="iconButton" title="Switch Camera" type="button" aria-label="Switch camera">
              🔄
            </button>
            <button onClick={increaseZoom} className="iconButton" title="Zoom In" type="button" aria-label="Zoom in">
              ➕
            </button>

            <button onClick={captureAndSend} disabled={loading || !streaming} className="iconButton scanIconButton" title={loading ? "Analyzing…" : "Scan"} type="button" aria-label={loading ? "Analyzing" : "Scan"} style={{ order: 2 }}>
              📷
            </button>

            <button onClick={decreaseZoom} className="iconButton" title="Zoom Out" type="button" aria-label="Zoom out" style={{ order: 3 }}>
              ➖
            </button>
            <button onClick={() => setResult("")} className="iconButton" title="Clear Result" type="button" aria-label="Clear result" style={{ order: 4 }}>
              ❌
            </button>
            <button onClick={clearHistory} className="iconButton" title="Clear History" type="button" aria-label="Clear scan history" style={{ order: 5 }}>
              🗑️
            </button>
          </div>
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />

        <section className="resultContainer" aria-live="polite" aria-atomic="true">
          {result ? (
            typeof result === "string" && result.trim().startsWith("[") ? (
			              <div>
                <h2>Scan Result</h2>
                <ul className="resultList">
                  {JSON.parse(result).map((item: any, index: number) => (
                    <li key={index} className="resultItem">
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.label}
                          className="resultItemImage"
                          loading="lazy"
                        />
                      )}
                      <span>
                        {item.label}: {(item.score * 100).toFixed(2)}%
                      </span>
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
        </section>

        <section className="historyContainer" aria-label="Scan History">
          <h2>Scan History</h2>
          {history.length > 0 ? (
            <ul className="historyList" style={{ paddingLeft: 0 }}>
              {history.map((item: any, index: number) => (
                <li
                  key={index}
                  className="historyItem"
                  style={{ marginBottom: "32px" }}
                >
                  <h3>
                    Scan {index + 1} -{" "}
                    {new Date(item.timestamp).toLocaleString()}
                  </h3>
                  <ul className="resultList">
                    {Array.isArray(item.result) ? (
                      item.result.map((resultItem: any, resultIndex: number) => (
                        <li key={resultIndex} className="resultItem">
                          {resultItem.image && (
                            <img
                              src={resultItem.image}
                              alt={resultItem.label}
                              className="resultItemImage"
                              loading="lazy"
                            />
                          )}
                          <span>
                            {resultItem.label}: {(resultItem.score * 100).toFixed(2)}%
                          </span>
                        </li>
                      ))
                    ) : (
                      <li>Invalid scan data</li>
                    )}
                  </ul>
                  {typeof item.latitude === "number" &&
                    typeof item.longitude === "number" &&
                    mapApiKey &&
                    isLoaded && (
                      <div
                        style={{
                          marginTop: 12,
                          height: 150,
                          borderRadius: 12,
                          overflow: "hidden",
                        }}
                      >
                        <GoogleMap
                          mapContainerStyle={{ width: "100%", height: "100%" }}
                          center={{ lat: item.latitude, lng: item.longitude }}
                          zoom={14}
                          options={{ disableDefaultUI: true }}
                        >
                          <Marker
                            position={{ lat: item.latitude, lng: item.longitude }}
                          />
                        </GoogleMap>
                      </div>
                    )}
                  {loadError && (
                    <div style={{ color: "red", marginTop: 8 }}>
                      Error loading Google Maps
                    </div>
                  )}
                  {!mapApiKey && (
                    <div style={{ color: "red", marginTop: 8 }}>
                      Google Maps API key is missing.
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>No scan history available.</p>
          )}
        </section>
      </div>
    </>
  );
}
