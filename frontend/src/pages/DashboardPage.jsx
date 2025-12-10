import { useAuth } from "../context/AuthContext";
import AdminDashboard from "./AdminDashboard";
import PrincipalDashboard from "./PrincipalDashboard";
import DepartmentHeadDashboard from "./DepartmentHeadDashboard";
import FacultyDashboard from "./FacultyDashboard";
import StaffDashboard from "./StaffDashboard";

function Dashboard() {
  const { user } = useAuth();

  // Route to appropriate dashboard based on role
  switch (user?.role_name) {
    case "Admin":
      return <AdminDashboard />;

    case "Principal":
      return <PrincipalDashboard />;

    case "Department Head":
      return <DepartmentHeadDashboard />;

    case "Faculty":
      return <FacultyDashboard />;

    case "Staff":
      return <StaffDashboard />;

    default:
      return (
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium mb-2">Invalid user role</p>
            <p className="text-red-700 text-sm">
              Your account role is not recognized. Please contact the system
              administrator for assistance.
            </p>
          </div>
        </div>
      );
  }
}

export default Dashboard;
