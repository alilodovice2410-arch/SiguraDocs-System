import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleSelectionPage from "./pages/RoleSelectionPage";
import Login from "./pages/LoginPage";
import Dashboard from "./pages/DashboardPage";
import MyDocumentsPage from "./components/faculty/MyDocumentsPage";
import DocumentDetailsPage from "./components/faculty/DocumentDetailsPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Role Selection Landing Page*/}
          <Route path="/" element={<RoleSelectionPage />} />

          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Dashboard Route - automatically routes to correct dashboard based on role */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* My Documents Route - For Faculty, Head Teachers, and Staff */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute
                allowedRoles={["Faculty", "Head Teacher", "Staff"]}
              >
                <MyDocumentsPage />
              </ProtectedRoute>
            }
          />

          {/* ✅ FIXED: Changed from /document/:id to /documents/:id (plural) */}
          <Route
            path="/documents/:id"
            element={
              <ProtectedRoute>
                <DocumentDetailsPage />
              </ProtectedRoute>
            }
          />

          {/* Legacy admin route - redirect to dashboard */}
          <Route
            path="/admin/*"
            element={<Navigate to="/dashboard" replace />}
          />

          {/* Catch all - redirect to dashboard if authenticated, login if not */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
