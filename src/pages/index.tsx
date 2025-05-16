import { useState, useRef, useEffect } from "react";
import axios from "axios";

export default function Home() {
  const [result, setResult] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  // Start camera on mount
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
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
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  const captureAndSend = async () => {
    if (!streaming || !videoRef.current || !canvasRef.current) {
      setResult("Camera is not ready.");
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

    // Draw current frame from video onto canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob and send via FormData
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
          setResult(JSON.stringify(response.data.result, null, 2));
        } catch (error) {
          console.error("Error sending image:", error);
          setResult("Error processing image. Try again!");
        }
        setLoading(false);
      },
      "image/jpeg",
      0.95 // optional quality param
    );
  };

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "2rem auto",
        padding: "1rem",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        color: "#222",
        backgroundColor: "#f9fafb",
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          marginBottom: "1.5rem",
          color: "#0070f3",
          fontWeight: "700",
          fontSize: "2rem",
        }}
      >
        Bioai
      </h1>

      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <video
          ref={videoRef}
          style={{
            width: "100%",
            borderRadius: 10,
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            backgroundColor: "#000",
          }}
          playsInline
          muted
        />
      </div>

      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <button
          onClick={captureAndSend}
          disabled={loading || !streaming}
          style={{
            backgroundColor: loading || !streaming ? "#a0aec0" : "#0070f3",
            color: "#fff",
            border: "none",
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            borderRadius: 8,
            cursor: loading || !streaming ? "not-allowed" : "pointer",
            boxShadow: loading || !streaming ? "none" : "0 2px 8px rgba(0, 112, 243, 0.4)",
            transition: "background-color 0.3s ease",
          }}
          onMouseEnter={(e) => {
            if (!loading && streaming) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#005bb5";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && streaming) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0070f3";
            }
          }}
        >
          {loading ? "Analyzing…" : "Scan Mouth"}
        </button>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>

      <div
        style={{
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
        }}
      >
        {result || "No result yet."}
      </div>
    </div>
  );
}
