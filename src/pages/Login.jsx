// src/pages/Login.jsx
import React, { useState } from "react";
import "../css/login.css";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Spinner from "../components/Spinner";
import { auth } from "../api/api"; // <-- use api.js (new endpoints)
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useAuth } from "../auth/AuthContext";
function Login({ onLogin }) {
  const [userId, setUserID] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);

      // NEW API SHAPE: { success, message, data: { token, user } }
      const res = await auth({ userId, password });
      console.log(res.data);
      if (res?.success) {
        const token = res?.data?.jwtToken;
        const userId = res?.data?.userId || {};
        const role = (res?.data?.role || "").toLowerCase();
        const name = res?.data?.name || "";

        // store token so axios interceptor sends Authorization: Bearer <token>
        localStorage.setItem("authToken", token || "");
        // keep role for your RBAC guards/nav
        if (role) localStorage.setItem("role", role);
        // optional helpers (useful elsewhere)
        if (userId) localStorage.setItem("userId", userId);
        if (name) localStorage.setItem("name", name);

        login(role);
        toast.success(res?.message || "Login successful");

        // lift user up if parent wants it
        onLogin?.(user);

        // route to your app's dashboard root (guards will handle role)
        navigate("/", { replace: true });
      } else {
        toast.error(res?.message || "Login failed");
      }
    } catch (err) {
      console.error("Login failed", err);
      const msg =
        err?.response?.data?.message || err?.message || "Login failed";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex justify-center items-center login">
      <div className={`login-box${isLoading ? " loading" : ""}`}>
        {isLoading && (
          <div className="overlay">
            <Spinner />
          </div>
        )}

        <h2>Login</h2>

        <form onSubmit={handleSubmit} className="form">
          <div className="user-box" style={{ position: "relative" }}>
            <input
              type="text"
              className="input"
              value={userId}
              onChange={(e) => setUserID(e.target.value)}
              required
              autoComplete="username"
            />
            <label>User Id:</label>
          </div>

          <div className="user-box" style={{ position: "relative" }}>
            <input
              type={showPw ? "text" : "password"}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <label>Password:</label>

            {/* eye toggle — styling left intact */}
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
              style={{
                position: "absolute",
                right: 10,
                top: "-20%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                padding: 0,
                lineHeight: 0,
              }}
            >
              {showPw ? <FaEye color="#fff" /> : <FaEyeSlash color="#fff" />}
            </button>
          </div>

          <button type="submit">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
