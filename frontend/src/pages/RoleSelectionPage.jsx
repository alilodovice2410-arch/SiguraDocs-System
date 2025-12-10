import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import "./css/RoleSelectionPage.css";
import background from "../assets/background.jpg";
import sanMarianoLogo from "../assets/smnhs_logo.png";

function RoleSelectionPage() {
  const [selectedRole, setSelectedRole] = useState(null);
  const [hoveredRole, setHoveredRole] = useState(null);
  const navigate = useNavigate();

  const roles = [
    { id: "admin", title: "Administrator" },
    { id: "principal", title: "Principal" },
    { id: "head-teacher", title: "Head Teachers" },
    { id: "teacher", title: "Teachers" },
  ];

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);

    setTimeout(() => {
      navigate(`/login?role=${roleId}`);
    }, 300);
  };

  return (
    <div className="role-page">
      {/* Classroom Background */}
      <div
        className="role-background"
        style={{ backgroundImage: `url(${background})` }}
      >
        <div className="role-overlay"></div>
      </div>

      {/* Content */}
      <div className="role-container">
        <div className="role-content">
          {/* Header */}
          <div className="role-header">
            <div className="role-icon">
              <img
                src={sanMarianoLogo}
                alt="San Mariano National High School Logo"
                className="school-logo"
                size={48}
                strokeWidth={2}
              />
            </div>
            <h1 className="role-title">SiguraDocs</h1>
            <p className="role-subtitle">San Mariano National High School</p>
          </div>

          {/* Role Buttons */}
          <div className="role-buttons">
            {roles.map((role, index) => (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role.id)}
                onMouseEnter={() => setHoveredRole(role.id)}
                onMouseLeave={() => setHoveredRole(null)}
                className={`role-button ${
                  hoveredRole === role.id || selectedRole === role.id
                    ? "hovered"
                    : ""
                } ${selectedRole === role.id ? "selected" : ""}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {role.title}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="role-footer">
            <p>© 2025 School Portal. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoleSelectionPage;
