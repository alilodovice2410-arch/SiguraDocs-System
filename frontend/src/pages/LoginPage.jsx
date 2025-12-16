import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import authService from "../services/authService";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Building2,
  UserCircle,
  CreditCard,
  BookOpen,
} from "lucide-react";
import "./css/LoginPage.css";
import sanMarianoLogo from "../assets/smnhs_logo.png";
import ForgotPasswordModal from "./ForgotPasswordModal";

function LoginPage() {
  const [searchParams] = useSearchParams();
  const selectedRole = searchParams.get("role");

  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [loginData, setLoginData] = useState({
    fullName: "",
    password: "",
  });

  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    employeeId: "",
    department: "",
    role: "",
    subject: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const departments = [
    "English",
    "Mathematics",
    "Science",
    "Filipino",
    "Social Studies",
    "MAPEH",
    "TLE",
    "Values Education",
  ];

  const subjectsByDepartment = {
    English: ["English"],
    Mathematics: ["Mathematics"],
    Science: ["Science", "Biology", "Chemistry", "Physics", "General Science"],
    Filipino: ["Filipino"],
    "Social Studies": [
      "Araling Panlipunan",
      "History",
      "Economics",
      "Social Studies",
    ],
    MAPEH: ["Music", "Arts", "Physical Education", "Health", "MAPEH"],
    TLE: [
      "TLE",
      "Home Economics",
      "Industrial Arts",
      "ICT",
      "Entrepreneurship",
    ],
    "Values Education": ["Values Education", "EsP"],
  };

  const getSubjectsForDepartment = (dept) => subjectsByDepartment[dept] || [];

  const canSignUp = () =>
    selectedRole === "teacher" || selectedRole === "head-teacher";

  const getRoleDisplayName = (roleKey) => {
    const roleNames = {
      admin: "Administrator",
      principal: "Principal",
      "head-teacher": "Head Teacher",
      teacher: "Teacher",
    };
    return roleNames[roleKey || selectedRole] || "User";
  };

  // Redirect if already logged in - but ONLY if role matches
  useEffect(() => {
    if (isAuthenticated() && user) {
      if (selectedRole) {
        const userRoleMapping = {
          1: "admin",
          2: "principal",
          3: "head-teacher",
          4: "teacher",
          5: "teacher",
        };
        const userRole = userRoleMapping[user.role_id];

        if (userRole === selectedRole) {
          console.log("✅ Auto-redirect: Role matches");
          navigate("/dashboard", { replace: true });
        } else {
          console.log("❌ Auto-redirect blocked: Role mismatch");
          sessionStorage.clear();
          localStorage.clear();
          setError(
            `❌ Session Error: This account belongs to a ${getRoleDisplayName(
              userRole
            )}, not a ${getRoleDisplayName(
              selectedRole
            )}. Please select the correct role.`
          );
        }
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate, selectedRole]);

  // Redirect to role selection if no role is specified
  useEffect(() => {
    if (!selectedRole) {
      console.log("No role selected - redirecting to role selection");
      navigate("/", { replace: true });
    }
  }, [selectedRole, navigate]);

  useEffect(() => {
    if (signupData.role === "head-teacher") {
      setSignupData((prev) => ({ ...prev, subject: "" }));
    }
  }, [signupData.department]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Make API call directly without storing session yet
      const response = await api.post("/auth/login", {
        username: loginData.fullName,
        password: loginData.password,
      });

      if (!response?.data?.success || !response.data.user) {
        throw new Error("Login failed - no user data received");
      }

      const { token, user: userData } = response.data;

      // CRITICAL: Check role BEFORE storing anything
      const userRoleMapping = {
        1: "admin",
        2: "principal",
        3: "head-teacher",
        4: "teacher",
        5: "teacher",
      };

      const userRole = userRoleMapping[userData.role_id];

      if (selectedRole && userRole !== selectedRole) {
        const userRoleDisplay = getRoleDisplayName(userRole);
        const selectedRoleDisplay = getRoleDisplayName(selectedRole);

        // Clear any session data
        sessionStorage.clear();
        localStorage.clear();

        setError(
          `❌ Access Denied! This account belongs to a ${userRoleDisplay}, not a ${selectedRoleDisplay}. Please go back and select "${userRoleDisplay}" to continue.`
        );

        console.log("❌ Role mismatch:", {
          selectedRole,
          userRole,
          userRoleId: userData.role_id,
        });
        setLoading(false);
        return; // STOP - Don't store session or navigate
      }

      // Role matches - NOW store session data
      console.log("✅ Role verification passed");
      sessionStorage.setItem("token", token);
      sessionStorage.setItem("user", JSON.stringify(userData));
      sessionStorage.setItem("lastActivity", Date.now().toString());
      sessionStorage.setItem("loginTime", Date.now().toString());
      localStorage.setItem("hasActiveSession", "true");

      // Initialize session monitoring
      authService.trackUserActivity();
      authService.startSessionTimeout();
      document.addEventListener(
        "visibilitychange",
        authService.handleVisibilityChange
      );

      // Use window.location for full page reload to ensure AuthContext reinitializes
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Login error:", err);
      sessionStorage.clear();
      localStorage.clear();

      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Login failed. Please try again.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (
      !signupData.fullName ||
      !signupData.email ||
      !signupData.employeeId ||
      !signupData.department ||
      !signupData.role
    ) {
      setError("Please fill in all required fields");
      return;
    }

    if (signupData.role === "head-teacher" && !signupData.subject) {
      setError("Please select the subject you are Head Teacher for");
      return;
    }

    if (signupData.password !== signupData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (signupData.password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);

    try {
      const roleMapping = { teacher: 4, "head-teacher": 3 };

      const registrationData = {
        username: signupData.fullName,
        email: signupData.email,
        password: signupData.password,
        full_name: signupData.fullName,
        employee_id: signupData.employeeId,
        role_id: roleMapping[signupData.role],
        department: signupData.department,
        subject: signupData.role === "head-teacher" ? signupData.subject : null,
      };

      await authService.register(registrationData);

      setIsLogin(true);
      setError("");
      setSuccess(
        signupData.role === "head-teacher"
          ? `Account created successfully! You are now registered as Head Teacher for ${signupData.subject} in ${signupData.department} Department.`
          : "Account created successfully! Please sign in."
      );

      setLoginData({ fullName: registrationData.full_name, password: "" });
      setSignupData({
        fullName: "",
        email: "",
        employeeId: "",
        department: "",
        role: "",
        subject: "",
        password: "",
        confirmPassword: "",
      });
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Registration failed. Please try again.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-background"></div>

      <div className="auth-wrapper">
        <div className="auth-header">
          <div className="auth-logo">
            <img
              src={sanMarianoLogo}
              alt="San Mariano National High School Logo"
              className="school-logo"
            />
          </div>
          <h1 className="auth-title">SiguraDocs</h1>
          <p className="auth-subtitle">Document Management System</p>
          {selectedRole && (
            <p
              className="auth-subtitle"
              style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}
            >
              {getRoleDisplayName()} Portal
            </p>
          )}
        </div>

        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="auth-card-description">
              {isLogin
                ? `Sign in to your ${getRoleDisplayName()} account`
                : `Create a new ${getRoleDisplayName()} account`}
            </p>
          </div>

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          {isLogin ? (
            <div className="auth-form">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div className="input-container">
                  <User className="input-icon" />
                  <input
                    type="text"
                    value={loginData.fullName}
                    onChange={(e) =>
                      setLoginData({ ...loginData, fullName: e.target.value })
                    }
                    className="input-field"
                    placeholder="Enter your full name"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="form-label-row">
                  <label className="form-label">Password</label>
                </div>
                <div className="input-container">
                  <Lock className="input-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginData.password}
                    onChange={(e) =>
                      setLoginData({ ...loginData, password: e.target.value })
                    }
                    className="input-field input-field-password"
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot Password?
                </button>
              </div>

              <button
                onClick={handleLoginSubmit}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </div>
          ) : (
            <div className="auth-form">
              {/* Sign up form fields - keeping existing implementation */}
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div className="input-container">
                  <User className="input-icon" />
                  <input
                    type="text"
                    value={signupData.fullName}
                    onChange={(e) =>
                      setSignupData({ ...signupData, fullName: e.target.value })
                    }
                    className="input-field"
                    placeholder="Enter your full name"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="input-container">
                  <Mail className="input-icon" />
                  <input
                    type="email"
                    value={signupData.email}
                    onChange={(e) =>
                      setSignupData({ ...signupData, email: e.target.value })
                    }
                    className="input-field"
                    placeholder="Enter your email"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Employee ID</label>
                <div className="input-container">
                  <CreditCard className="input-icon" />
                  <input
                    type="text"
                    value={signupData.employeeId}
                    onChange={(e) =>
                      setSignupData({
                        ...signupData,
                        employeeId: e.target.value,
                      })
                    }
                    className="input-field"
                    placeholder="Enter your employee ID"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Role</label>
                <div className="input-container">
                  <UserCircle className="input-icon" />
                  <select
                    value={signupData.role}
                    onChange={(e) =>
                      setSignupData({
                        ...signupData,
                        role: e.target.value,
                        subject: "",
                      })
                    }
                    className="select-field"
                    required
                    disabled={loading}
                  >
                    <option value="">Select your role</option>
                    <option value="teacher">Teacher</option>
                    <option value="head-teacher">Head Teacher</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Department</label>
                <div className="input-container">
                  <Building2 className="input-icon" />
                  <select
                    value={signupData.department}
                    onChange={(e) =>
                      setSignupData({
                        ...signupData,
                        department: e.target.value,
                        subject: "",
                      })
                    }
                    className="select-field"
                    required
                    disabled={loading}
                  >
                    <option value="">Select your department</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {signupData.role === "head-teacher" && signupData.department && (
                <div className="form-group">
                  <label className="form-label">
                    Subject (Head Teacher For)
                  </label>
                  <div className="input-container">
                    <BookOpen className="input-icon" />
                    <select
                      value={signupData.subject}
                      onChange={(e) =>
                        setSignupData({
                          ...signupData,
                          subject: e.target.value,
                        })
                      }
                      className="select-field"
                      required
                      disabled={loading}
                    >
                      <option value="">Select subject you supervise</option>
                      {getSubjectsForDepartment(signupData.department).map(
                        (subject) => (
                          <option key={subject} value={subject}>
                            {subject}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <p className="form-helper-text">
                    Select the subject area you will be supervising as Head
                    Teacher
                  </p>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-container">
                  <Lock className="input-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={signupData.password}
                    onChange={(e) =>
                      setSignupData({ ...signupData, password: e.target.value })
                    }
                    className="input-field input-field-password"
                    placeholder="Create a password (min. 8 characters)"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div className="input-container">
                  <Lock className="input-icon" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={signupData.confirmPassword}
                    onChange={(e) =>
                      setSignupData({
                        ...signupData,
                        confirmPassword: e.target.value,
                      })
                    }
                    className="input-field input-field-password"
                    placeholder="Confirm your password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="password-toggle"
                  >
                    {showConfirmPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleSignupSubmit}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </div>
          )}

          {canSignUp() && (
            <div className="auth-toggle">
              <p className="auth-toggle-text">
                {isLogin
                  ? "Don't have an account? "
                  : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError("");
                    setSuccess("");
                  }}
                  className="auth-toggle-link"
                >
                  {isLogin ? "Sign up now" : "Sign in"}
                </button>
              </p>
            </div>
          )}

          <div
            className="auth-toggle"
            style={{ marginTop: canSignUp() ? "0.5rem" : "1.5rem" }}
          >
            <button
              type="button"
              onClick={() => navigate("/")}
              className="auth-toggle-link"
              style={{ fontSize: "0.875rem" }}
            >
              ← Back to role selection
            </button>
          </div>
        </div>

        <p className="auth-footer">© 2024 SiguraDocs. All rights reserved.</p>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </div>
  );
}

export default LoginPage;
