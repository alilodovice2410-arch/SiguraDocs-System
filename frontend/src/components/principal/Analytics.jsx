import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
  Building2,
  Activity,
} from "lucide-react";
import api from "../../services/api";
import "./css/Analytics.css"; // Keep your existing CSS file name

const Analytics = () => {
  const [timeRange, setTimeRange] = useState("month");
  const [loading, setLoading] = useState(true);

  // State for all analytics data
  const [summaryStats, setSummaryStats] = useState({
    totalDocuments: 0,
    totalDocumentsChange: 0,
    avgApprovalTime: 0,
    avgApprovalTimeChange: 0,
    approvalRate: 0,
    approvalRateChange: 0,
    pendingDocuments: 0,
    pendingDocumentsChange: 0,
  });

  const [submissionTrends, setSubmissionTrends] = useState([]);
  const [documentTypeData, setDocumentTypeData] = useState([]);
  const [approvalTimeByType, setApprovalTimeByType] = useState([]);
  const [departmentActivity, setDepartmentActivity] = useState([]);
  const [weeklyPattern, setWeeklyPattern] = useState([]);
  const [statusTrends, setStatusTrends] = useState([]);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      console.log("📊 Fetching Principal analytics for range:", timeRange);

      const response = await api.get("/principal/analytics/dashboard", {
        params: { range: timeRange },
      });

      console.log("✅ Principal Analytics response:", response.data);

      if (response.data.success) {
        const data = response.data.data;

        // Update summary stats
        setSummaryStats({
          totalDocuments: data.totalDocuments,
          totalDocumentsChange: 15,
          avgApprovalTime: parseFloat(data.avgApprovalTime),
          avgApprovalTimeChange: -0.5,
          approvalRate: data.approvalRate,
          approvalRateChange: 8,
          pendingDocuments: data.pendingDocuments,
          pendingDocumentsChange: -6,
        });

        // Update chart data
        setSubmissionTrends(data.submissionTrends || []);
        setDocumentTypeData(data.documentTypeData || []);
        setApprovalTimeByType(data.approvalTimeByType || []);
        setDepartmentActivity(data.departmentActivity || []);
        setWeeklyPattern(data.weeklyPattern || []);
        setStatusTrends(data.statusTrends || []);
      }
    } catch (error) {
      console.error("❌ Failed to fetch Principal analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, change, subtitle, color }) => (
    <div className="analytics-stat-card">
      <div className="stat-card-layout">
        <div className="stat-card-info-section">
          <p className="stat-card-title">{title}</p>
          <h3 className="stat-card-value">{value}</h3>
          {subtitle && <p className="stat-card-subtitle">{subtitle}</p>}
        </div>
        <div className={`stat-card-icon-wrapper ${color}`}>
          <Icon className="stat-card-icon" />
        </div>
      </div>
      {change !== undefined && (
        <div className="stat-card-change">
          {change >= 0 ? (
            <TrendingUp className="change-icon positive" />
          ) : (
            <TrendingDown className="change-icon negative" />
          )}
          <span
            className={
              change >= 0 ? "change-text positive" : "change-text negative"
            }
          >
            {Math.abs(change)}
            {change >= 0 ? "% increase" : "% decrease"}
          </span>
          <span className="change-period">vs last {timeRange}</span>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner" />
        <p>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      {/* Header */}
      <div className="analytics-header">
        <div>
          <h1 className="analytics-title">System-Wide Analytics</h1>
          <p className="analytics-subtitle">
            Complete School Performance Overview
          </p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="time-range-select"
        >
          <option value="week">Last Week</option>
          <option value="month">Last Month</option>
          <option value="quarter">Last Quarter</option>
          <option value="year">Last Year</option>
        </select>
      </div>

      {/* Summary Stats */}
      <div className="analytics-stats-grid">
        <StatCard
          icon={FileText}
          title="Total Documents"
          value={summaryStats.totalDocuments}
          change={summaryStats.totalDocumentsChange}
          subtitle="System-wide submissions"
          color="stat-blue"
        />
        <StatCard
          icon={Clock}
          title="Avg. Approval Time"
          value={`${summaryStats.avgApprovalTime} days`}
          change={summaryStats.avgApprovalTimeChange}
          subtitle="Processing efficiency"
          color="stat-purple"
        />
        <StatCard
          icon={CheckCircle}
          title="Approval Rate"
          value={`${summaryStats.approvalRate}%`}
          change={summaryStats.approvalRateChange}
          subtitle="Overall success rate"
          color="stat-green"
        />
        <StatCard
          icon={Activity}
          title="Pending Review"
          value={summaryStats.pendingDocuments}
          change={summaryStats.pendingDocumentsChange}
          subtitle="Awaiting decisions"
          color="stat-orange"
        />
      </div>

      {/* Charts Grid */}
      <div className="analytics-charts-grid">
        {/* Submission Trends */}
        <div className="analytics-chart-card">
          <h3 className="chart-title">
            <TrendingUp className="chart-icon" />
            Submission Trends
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={submissionTrends}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.1)"
              />
              <XAxis
                dataKey="month"
                stroke="rgba(255,255,255,0.7)"
                style={{ fontSize: "12px" }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.7)"
                style={{ fontSize: "12px" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(45, 71, 57, 0.95)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "8px",
                  color: "white",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line
                type="monotone"
                dataKey="submitted"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Submitted"
              />
              <Line
                type="monotone"
                dataKey="approved"
                stroke="#10b981"
                strokeWidth={2}
                name="Approved"
              />
              <Line
                type="monotone"
                dataKey="rejected"
                stroke="#ef4444"
                strokeWidth={2}
                name="Rejected"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Document Type Distribution */}
        <div className="analytics-chart-card">
          <h3 className="chart-title">
            <FileText className="chart-icon" />
            Document Type Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={documentTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {documentTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(45, 71, 57, 0.95)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "8px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Approval Time by Type */}
        <div className="analytics-chart-card">
          <h3 className="chart-title">
            <Clock className="chart-icon" />
            Avg. Approval Time by Type
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={approvalTimeByType} layout="vertical">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.1)"
              />
              <XAxis
                type="number"
                stroke="rgba(255,255,255,0.7)"
                style={{ fontSize: "12px" }}
              />
              <YAxis
                dataKey="type"
                type="category"
                width={120}
                stroke="rgba(255,255,255,0.7)"
                style={{ fontSize: "11px" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(45, 71, 57, 0.95)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "8px",
                }}
              />
              <Bar
                dataKey="avgDays"
                fill="#f59e0b"
                name="Days"
                radius={[0, 8, 8, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Activity Pattern */}
        <div className="analytics-chart-card">
          <h3 className="chart-title">
            <Calendar className="chart-icon" />
            Weekly Activity Pattern
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyPattern}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.1)"
              />
              <XAxis
                dataKey="day"
                stroke="rgba(255,255,255,0.7)"
                style={{ fontSize: "12px" }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.7)"
                style={{ fontSize: "12px" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(45, 71, 57, 0.95)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "8px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar
                dataKey="submissions"
                fill="#3b82f6"
                name="Submissions"
                radius={[8, 8, 0, 0]}
              />
              <Bar
                dataKey="approvals"
                fill="#10b981"
                name="Approvals"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department Performance Table */}
      <div className="analytics-table-card">
        <h3 className="chart-title">
          <Building2 className="chart-icon" />
          Department Performance Summary
        </h3>
        <div className="analytics-table-wrapper">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Submitted</th>
                <th>Approved</th>
                <th>Rejected</th>
                <th>Approval Rate</th>
                <th>Avg. Time</th>
              </tr>
            </thead>
            <tbody>
              {departmentActivity.map((dept, index) => (
                <tr key={index}>
                  <td>
                    <div className="department-cell">
                      <div className="department-avatar">
                        {dept.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span>{dept.name}</span>
                    </div>
                  </td>
                  <td>{dept.submitted}</td>
                  <td>
                    <span className="badge badge-green">{dept.approved}</span>
                  </td>
                  <td>
                    <span className="badge badge-red">{dept.rejected}</span>
                  </td>
                  <td>
                    <div className="progress-cell">
                      <div className="progress-bar-bg">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${(dept.approved / dept.submitted) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="progress-text">
                        {Math.round((dept.approved / dept.submitted) * 100)}%
                      </span>
                    </div>
                  </td>
                  <td>{dept.avgTime} days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Trends */}
      <div className="analytics-chart-card full-width">
        <h3 className="chart-title">
          <Activity className="chart-icon" />
          Status Breakdown Trends
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={statusTrends}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
            />
            <XAxis
              dataKey="week"
              stroke="rgba(255,255,255,0.7)"
              style={{ fontSize: "12px" }}
            />
            <YAxis
              stroke="rgba(255,255,255,0.7)"
              style={{ fontSize: "12px" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(45, 71, 57, 0.95)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar
              dataKey="approved"
              stackId="a"
              fill="#10b981"
              name="Approved"
            />
            <Bar
              dataKey="rejected"
              stackId="a"
              fill="#ef4444"
              name="Rejected"
            />
            <Bar
              dataKey="pending"
              stackId="a"
              fill="#f59e0b"
              name="Pending"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Analytics;
