import axios from "axios";

// In production, use relative URL (same domain)
// In development, use localhost backend
const getBaseURL = () => {
  if (import.meta.env.PROD) {
    return "/api"; // Production: same domain
  }
  return import.meta.env.VITE_API_URL || "http://localhost:5000/api";
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - Add token to requests
api.interceptors.request.use(
  (config) => {
    // Get token from sessionStorage instead of localStorage
    const token = sessionStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle authentication errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // Special handling for blob responses (file downloads)
    if (error.config && error.config.responseType === "blob") {
      // If the response is a blob but it's actually an error JSON
      if (error.response && error.response.data instanceof Blob) {
        try {
          // Try to read the blob as JSON
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);

          // Replace the blob error with a proper error object
          error.response.data = errorData;

          // Handle 401 for blob downloads
          if (error.response.status === 401) {
            console.log(
              "Unauthorized access during download - clearing session"
            );

            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");
            sessionStorage.removeItem("lastActivity");
            sessionStorage.removeItem("loginTime");
            localStorage.removeItem("hasActiveSession");

            if (!window.location.pathname.includes("/login")) {
              window.location.href = "/login";
            }
          }

          return Promise.reject(error);
        } catch (parseError) {
          // If we can't parse it as JSON, it might be a real blob error
          console.error("Could not parse blob error:", parseError);
          return Promise.reject(error);
        }
      }
    }

    // Handle 401 Unauthorized errors for regular requests
    if (error.response && error.response.status === 401) {
      console.log("Unauthorized access - clearing session");

      // Clear session data
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("lastActivity");
      sessionStorage.removeItem("loginTime");
      localStorage.removeItem("hasActiveSession");

      // Redirect to login if not already there
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
