import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import camera from '../assets/camera.svg';
const QrScanner = ({ onDecoded, onClose }) => {
  const [cameraFacingMode, setCameraFacingMode] = useState("environment");
  const html5QrRef = useRef(null);

  useEffect(() => {
    let initTimer;

    // Safely stop + clear the scanner
    const safeTeardown = () => {
      if (html5QrRef.current) {
        try {
          html5QrRef.current.stop();
        } catch (_){/* ignore if not running */}
        try {
          html5QrRef.current.clear();
        } catch (_){/* ignore if not initialized */}
        html5QrRef.current = null;
      }
    };

    // Initialize the scanner
    const initScanner = () => {
      safeTeardown();

      initTimer = setTimeout(() => {
        const qr = new Html5Qrcode("reader");
        html5QrRef.current = qr;

        qr.start(
          { facingMode: cameraFacingMode },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          decodedText => {
            // When we get a code, tear down and call back
            safeTeardown();
            onDecoded(decodedText);
          },
          /* optional error callback */ errorMsg => {
            // you can console.warn(errorMsg) if desired
          }
        ).catch(err => {
          console.error("Unable to start scanner:", err);
        });
      }, 200);
    };

    initScanner();
    return () => {
      clearTimeout(initTimer);
      safeTeardown();
    };
  }, [cameraFacingMode, onDecoded]);

  return (
    <div className="flex justify-center items-center min-h-screen bg-black/50">
      <div className="flex flex-col items-center space-y-4 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-0 right-2 text-white text-3xl font-bold z-50"
          aria-label="Close scanner"
        >
          &times;
        </button>

        <style>{`
          #reader video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
          }
        `}</style>
        <div
          id="reader"
          style={{
            width: 320,
            height: 320,
            border: "2px solid #ccc",
            borderRadius: 8,
            overflow: "hidden",
            position: "relative",
          }}
        >
        <div className="w-full h-2 bg-white absolute top-1/2 z-50" />
        </div>
        <button
          onClick={() =>
            setCameraFacingMode(prev =>
              prev === "environment" ? "user" : "environment"
            )
          }
          className=" text-white rounded absolute top-8 right-0 "
        >
          <img src={camera} alt="camera" className="w-8 h-8"/>
        </button>
      </div>
    </div>
  );
};

export default QrScanner;
