import { useState } from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Eye,
  FolderOpen,
  Activity,
  TrendingUp,
  Users,
  ArrowRight,
} from "lucide-react";
import "./css/DepartmentHeadOverview.css";

function DepartmentHeadOverview({ stats, user, setActiveView }) {
  return (
    <div className="overview-container">
      {/* Hero Stats Grid */}
      <div className="hero-stats-grid">
        <div
          className="hero-stat-card stat-pending clickable"
          onClick={() => setActiveView("approvals")}
        >
          <div className="stat-glass-bg"></div>
          <div className="stat-content-wrapper">
            <div className="stat-icon-wrapper stat-icon-orange">
              <Clock size={28} />
            </div>
            <div className="stat-info">
              <p className="stat-value">{stats?.pendingYourApproval || 0}</p>
              <p className="stat-title">Pending Your Approval</p>
              <p className="stat-subtitle">Requires your review</p>
            </div>
            <div className="stat-trend stat-trend-up">
              <TrendingUp size={16} />
              <span>Urgent</span>
            </div>
          </div>
        </div>

        <div className="hero-stat-card stat-documents">
          <div className="stat-glass-bg"></div>
          <div className="stat-content-wrapper">
            <div className="stat-icon-wrapper stat-icon-blue">
              <FileText size={28} />
            </div>
            <div className="stat-info">
              <p className="stat-value">{stats?.departmentDocuments || 0}</p>
              <p className="stat-title">Department Documents</p>
              <p className="stat-subtitle">Total in department</p>
            </div>
            <div className="stat-trend stat-trend-neutral">
              <Users size={16} />
              <span>All teachers</span>
            </div>
          </div>
        </div>

        <div className="hero-stat-card stat-approved">
          <div className="stat-glass-bg"></div>
          <div className="stat-content-wrapper">
            <div className="stat-icon-wrapper stat-icon-green">
              <CheckCircle size={28} />
            </div>
            <div className="stat-info">
              <p className="stat-value">{stats?.approvedThisMonth || 0}</p>
              <p className="stat-title">Approved This Month</p>
              <p className="stat-subtitle">Documents processed</p>
            </div>
            <div className="stat-trend stat-trend-up">
              <TrendingUp size={16} />
              <span>+12%</span>
            </div>
          </div>
        </div>

        <div className="hero-stat-card stat-rejected">
          <div className="stat-glass-bg"></div>
          <div className="stat-content-wrapper">
            <div className="stat-icon-wrapper stat-icon-red">
              <XCircle size={28} />
            </div>
            <div className="stat-info">
              <p className="stat-value">{stats?.rejected || 0}</p>
              <p className="stat-title">Rejected</p>
              <p className="stat-subtitle">Needs revision</p>
            </div>
            <div className="stat-trend stat-trend-down">
              <span>For review</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className="quick-actions-section">
        <div className="section-header-modern">
          <h2>Quick Actions</h2>
          <p>Fast access to common tasks</p>
        </div>

        <div className="modern-actions-grid">
          <div className="modern-action-card action-primary">
            <div className="action-glass-bg"></div>
            <div className="action-content-wrapper">
              <div className="action-icon-modern">
                <Eye size={32} />
              </div>
              <div className="action-text">
                <h3>Review Documents</h3>
                <p>Sign and approve pending documents</p>
                {stats?.pendingYourApproval > 0 && (
                  <div className="action-badge-modern">
                    {stats.pendingYourApproval} pending
                  </div>
                )}
              </div>
              <button
                className="action-btn-modern btn-primary"
                onClick={() => setActiveView("approvals")}
              >
                <span>Review Now</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>

          <div className="modern-action-card action-secondary">
            <div className="action-glass-bg"></div>
            <div className="action-content-wrapper">
              <div className="action-icon-modern">
                <FolderOpen size={32} />
              </div>
              <div className="action-text">
                <h3>Browse Documents</h3>
                <p>View all department files and records</p>
              </div>
              <button
                className="action-btn-modern btn-secondary"
                onClick={() => setActiveView("documents")}
              >
                <span>View All</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="activity-section">
        <div className="section-header-modern">
          <div className="header-left-content">
            <h2>Recent Activity</h2>
            <p>Latest updates in your department</p>
          </div>
          <div className="activity-filters">
            <button className="filter-btn active">All</button>
            <button className="filter-btn">Approved</button>
            <button className="filter-btn">Pending</button>
          </div>
        </div>

        <div className="activity-card-modern">
          <div className="activity-glass-bg"></div>
          {!stats?.recentActivities || stats.recentActivities.length === 0 ? (
            <div className="empty-state-modern">
              <div className="empty-icon-wrapper">
                <Activity size={48} />
              </div>
              <h3>No Recent Activity</h3>
              <p>
                Activities will appear here as they happen in your department
              </p>
            </div>
          ) : (
            <div className="activity-list-modern">
              {stats.recentActivities.map((activity, index) => {
                const getActivityStyle = (type) => {
                  switch (type) {
                    case "APPROVED":
                      return {
                        icon: CheckCircle,
                        color: "activity-green",
                        bg: "activity-bg-green",
                      };
                    case "UPLOADED":
                      return {
                        icon: FileText,
                        color: "activity-blue",
                        bg: "activity-bg-blue",
                      };
                    default:
                      return {
                        icon: Activity,
                        color: "activity-gray",
                        bg: "activity-bg-gray",
                      };
                  }
                };

                const {
                  icon: Icon,
                  color,
                  bg,
                } = getActivityStyle(activity.type);

                return (
                  <div key={index} className="activity-item-modern">
                    <div className={`activity-icon-modern ${bg}`}>
                      <Icon className={color} size={20} />
                    </div>
                    <div className="activity-details-modern">
                      <h4>{activity.title}</h4>
                      <p className="activity-desc">{activity.description}</p>
                      <span className="activity-time">
                        {activity.timestamp}
                      </span>
                    </div>
                    <button className="activity-action-btn">
                      <ArrowRight size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DepartmentHeadOverview;
