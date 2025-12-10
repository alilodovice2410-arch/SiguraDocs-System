import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import authService from "../services/authService";
import {
  Eye,
  EyeOff,
  GraduationCap,
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
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false); // NEW
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();

  // Login state
  const [loginData, setLoginData] = useState({
    fullName: "",
    password: "",
  });

  // Sign up state - Updated with subject field for head teachers
  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    employeeId: "",
    department: "",
    role: "",
    subject: "", // NEW: Subject field for Head Teachers
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Department options (these are the main subject departments)
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

  // Subjects per department (for Head Teacher assignment)
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

  // Get subjects based on selected department
  const getSubjectsForDepartment = (dept) => {
    return subjectsByDepartment[dept] || [];
  };

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated() && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Reset subject when department changes
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
      const result = await login(loginData.fullName, loginData.password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
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

    // Validation
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

    // Validate subject for Head Teachers
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
      // Map role names to role_ids
      const roleMapping = {
        teacher: 4, // Faculty/Teacher
        "head-teacher": 3, // Head Teacher
      };

      // For Head Teachers, include the subject in department field
      // Format: "Department - Subject" (e.g., "Science - Biology")
      const departmentValue =
        signupData.role === "head-teacher"
          ? `${signupData.department}` // Just the department
          : signupData.department;

      const registrationData = {
        username: signupData.fullName,
        email: signupData.email,
        password: signupData.password,
        full_name: signupData.fullName,
        employee_id: signupData.employeeId,
        role_id: roleMapping[signupData.role],
        department: departmentValue,
        // NEW: Include subject for head teachers
        subject: signupData.role === "head-teacher" ? signupData.subject : null,
      };

      const response = await authService.register(registrationData);

      setIsLogin(true);
      setError("");
      setSuccess(
        signupData.role === "head-teacher"
          ? `Account created successfully! You are now registered as Head Teacher for ${signupData.subject} in ${signupData.department} Department.`
          : "Account created successfully! Please sign in."
      );

      setLoginData({
        fullName: registrationData.full_name,
        password: "",
      });

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
        {/* Header */}
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
        </div>

        {/* Auth Card */}
        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="auth-card-description">
              {isLogin
                ? "Sign in to your account to continue"
                : "Create a new account to get started"}
            </p>
          </div>

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          {isLogin ? (
            // Login Form
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
            // Sign Up Form - Updated with Subject Selection
            <div className="auth-form">
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
                        subject: "", // Reset subject when role changes
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
                        subject: "", // Reset subject when department changes
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

              {/* NEW: Subject Selection for Head Teachers */}
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

          {/* Toggle Link */}
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
        </div>

        {/* Footer */}
        <p className="auth-footer">© 2024 SiguraDocs. All rights reserved.</p>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </div>
  );
}

export default LoginPage;
