import axios from "axios";

// FIXED: Always use VITE_API_URL if available, regardless of environment
const getBaseURL = () => {
  // Always prefer the environment variable if it exists
  return import.meta.env.VITE_API_URL || "http://localhost:5000/api";
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
  // INCREASED: 30 seconds for file uploads and slower operations
  timeout: 30000,
});

// Request interceptor - Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // ADDED: Increase timeout for file uploads
    if (config.headers["Content-Type"] === "multipart/form-data") {
      config.timeout = 60000; // 60 seconds for file uploads
    }

    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`);
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
    // Log detailed error info
    if (error.response) {
      console.error("API Error Response:", {
        status: error.response.status,
        statusText: error.response.statusText,
        url: error.config?.url,
        method: error.config?.method,
        data: error.response.data,
      });
    } else if (error.request) {
      console.error("API No Response:", {
        url: error.config?.url,
        message: "No response received from server",
      });
    } else {
      console.error("API Request Error:", error.message);
    }

    // Special handling for blob responses (file downloads)
    if (error.config && error.config.responseType === "blob") {
      if (error.response && error.response.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          error.response.data = errorData;

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
          console.error("Could not parse blob error:", parseError);
          return Promise.reject(error);
        }
      }
    }

    // Handle 401 Unauthorized errors for regular requests
    if (error.response && error.response.status === 401) {
      console.log("Unauthorized access - clearing session");

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
  }
);

export default api;
