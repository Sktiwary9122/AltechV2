import React from "react";
import { useNavigate } from "react-router-dom";
import error from '../assets/error.jpg'
export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0a0f1f]">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-violet-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />

      {/* Center content */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4">
        <div className="grid w-full max-w-4xl grid-cols-1 gap-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md shadow-[0_10px_50px_-10px_rgba(0,0,0,0.6)] md:grid-cols-2 md:p-8">
          {/* Illustration / Picture slot */}
          <div className="order-2 md:order-1">
            <div className="relative flex h-56 w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-violet-600/20 via-violet-400/10 to-transparent md:h-full">
              <img src={error} alt="404" className="h-full w-full object-cover" />

              <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
            </div>
          </div>

          {/* Text & actions */}
          <div className="order-1 flex flex-col justify-center md:order-2">
            <div className="mb-3 inline-flex items-center gap-2">
              <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold tracking-wide text-white/90 ring-1 ring-inset ring-white/15">
                404
              </span>
              <span className="text-xs text-white/60">Page not found</span>
            </div>

            <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl">
              We can’t seem to find the page you’re looking for.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              The link may be broken, or the page may have been moved. Check the
              URL for typos, or head back to the dashboard.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => navigate("/")}
                className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-violet-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:from-violet-600 hover:to-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                Go to Dashboard
              </button>

              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 shadow-sm transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              >
                Go Back
              </button>
            </div>

            {/* Optional tips */}
            <div className="mt-4 text-xs text-white/50">
              Tip: If you followed a link, try refreshing or returning to the
              previous page.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
