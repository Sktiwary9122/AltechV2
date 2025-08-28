// src/pages/SerialnumberPage.jsx
import React, { useState } from "react";
import qrScan from "../Assets/qr-scan.svg";
import TextField from "../components/TextField";
import generate from "../Assets/generate.svg";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Loader from "../components/Loader";
import DotLoader from "../components/DotLoader";
import QrScanner from "../components/QrScanner";

// NEW: use our API wrappers instead of raw axios
import {
  generateSerialString,
  getRecordEntryBySerial,
} from "../api/api";

function SerialnumberPage() {
  const [serialNumber, setSerialNumber] = useState("");
  const [isLoading, setIsLoading]       = useState(false);  // generate button
  const [isLoading1, setIsLoading1]     = useState(false);  // submit button
  const [scanning, setScanning]         = useState(false);
  const navigate = useNavigate();

  // Generate a new serial number via /api/generate-string
  async function handleGenerateSerialNumber() {
    try {
      setIsLoading(true);
      const res = await generateSerialString();
      const sn =
        res?.data?.data?.serialNo ??
        res?.data?.serialNo ??
        res?.data?.data?.serial ??
        res?.data?.serial ??
        "";
      if (sn) {
        setSerialNumber(sn);
      } else {
        toast.error("Could not parse serial number from response.");
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error?.response?.data?.message || "Error generating serial number"
      );
    } finally {
      setIsLoading(false);
    }
  }

  // Submit: fetch record-entry by serial and navigate to Record Entry page
  async function submitHandler(sr = serialNumber) {
    const serial = (sr || "").trim();
    if (!serial) {
      toast.warn("Please enter serial number");
      return;
    }
    try {
      setIsLoading1(true);

      const res = await getRecordEntryBySerial(serial);
      const payload = res?.data?.data || res?.data || {};

      // Expecting payload.isExisting boolean + record-entry data when true
      const isExisting = !!payload?.isExisting;

      // Pass data to Record Entry page via state
      if(localStorage.getItem('role') === 'admin'){
        navigate("/record-entries/form", {
        state: {
          serial,
          recordData: payload,
          isExisting,
          mode: isExisting ? "edit" : "create",
        },
        replace: false,
      });
      }
      else{
        navigate("/record-entries/form/deo", {
        state: {
          serial,
          recordData: payload,
          isExisting,
          mode: isExisting ? "edit" : "create",
        },
        replace: false,
      });
      }
      
    } catch (error) {
      console.error(error);
      toast.error(
        error?.response?.data?.message || "Error fetching serial data"
      );
    } finally {
      setIsLoading1(false);
    }
  }

  // Called when QrScanner decodes
  function handleDecodedText(decoded) {
    setScanning(false);
    setSerialNumber(decoded || "");
    if (decoded) submitHandler(decoded);
  }

  if (scanning) {
    return (
      <QrScanner
        onDecoded={handleDecodedText}
        onClose={() => setScanning(false)}
      />
    );
  }

  return (
    <div className="flex flex-col justify-center items-center pt-24">
      <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-8 text-center text-white">
        Enter product serial number
      </h1>

      <div className="flex flex-col md:flex-row justify-center items-center w-full max-w-4xl gap-4 sm:gap-6 md:gap-8 lg:gap-10">
        {/* QR scanner trigger */}
        <div
          className="flex flex-col justify-center items-center w-full md:w-1/2 border-b-2 md:border-b-0 md:border-r-2 pb-5 cursor-pointer"
          onClick={() => setScanning(true)}
        >
          <img
            src={qrScan}
            alt="QR Scan"
            className="max-h-32 sm:max-h-40 md:max-h-48 lg:max-h-56 bg-white rounded-lg"
          />
          <div className="text-lg sm:text-xl md:text-xl lg:text-2xl mt-5 text-white">
            Scan QR Code
          </div>
        </div>

        {/* Manual Input Card */}
        <div className="flex flex-col justify-center items-center w-full md:w-1/2 p-6">
          <div className="flex flex-col justify-center items-center w-full p-6 bg-white backdrop-blur-sm rounded-xl shadow-lg shadow-black/50">
            <div className="flex w-full justify-between">
              <TextField
                label="Serial Number"
                type="text"
                name="serialNumber"
                placeholder="Enter Serial Number"
                required
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
              />
              <button onClick={handleGenerateSerialNumber} className="mb-6 ml-2" title="Generate Serial Number">
                {!isLoading ? (
                  <img
                    src={generate}
                    alt="Generate"
                    className="w-6 h-6 sm:w-8 sm:h-8 md:w-8 md:h-8 lg:w-10 lg:h-10"
                  />
                ) : (
                  <div className="w-5 h-5 sm:w-8 sm:h-8 md:w-6 md:h-6 lg:w-6 lg:h-6 flex items-center justify-center">
                    <Loader className="w-full h-full" />
                  </div>
                )}
              </button>
            </div>

            <button
              className="px-6 py-3 bg-[#474bff] bg-opacity-80 hover:bg-opacity-100 text-white font-medium rounded-md transition w-full flex items-center justify-center"
              onClick={() => submitHandler()}
            >
              {isLoading1 ? <DotLoader /> : <span>Submit</span>}
            </button>
          </div>
          <div className="text-lg sm:text-xl md:text-xl lg:text-2xl mt-5 text-white">
            Or enter manually
          </div>
        </div>
      </div>
    </div>
  );
}

export default SerialnumberPage;
