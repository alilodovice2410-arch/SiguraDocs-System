import { useState, useEffect } from "react";
import {
  TrendingUp,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  PieChart,
  Calendar,
  Users,
  Activity,
} from "lucide-react";
import api from "../../services/api";
import "./css/Analytics.css";

function Analytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("6months");

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/analytics?range=${timeRange}`);
      const data = response.data.data;

      // Normalize numeric fields to numbers (defensive)
      if (Array.isArray(data.activityTrend)) {
        data.activityTrend = data.activityTrend.map((t) => ({
          month: t.month,
          approved: Number(t.approved) || 0,
          rejected: Number(t.rejected) || 0,
        }));
      }

      setStats(data);
      console.log("Analytics API response (client):", data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      // fallback unchanged...
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  // Get labels for the selected range
  const getMonthsForRange = () => {
    if (timeRange === "1month") {
      return ["Week 1", "Week 2", "Week 3", "Week 4"];
    } else if (timeRange === "3months") {
      const date = new Date();
      const months = [];
      for (let i = 2; i >= 0; i--) {
        const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
        months.push(d.toLocaleDateString("en-US", { month: "short" }));
      }
      return months;
    } else if (timeRange === "6months") {
      const date = new Date();
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
        months.push(d.toLocaleDateString("en-US", { month: "short" }));
      }
      return months;
    } else if (timeRange === "1year") {
      return [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
    } else {
      const date = new Date();
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
        months.push(d.toLocaleDateString("en-US", { month: "short" }));
      }
      return months;
    }
  };

  const months = getMonthsForRange();
  const trendRaw = stats?.activityTrend || [];
  const trendMap = new Map(trendRaw.map((t) => [t.month, t]));
  const trend = months.map((m) => {
    const item = trendMap.get(m);
    return {
      month: m,
      approved: Number(item?.approved || 0),
      rejected: Number(item?.rejected || 0),
    };
  });

  const maxValue = Math.max(
    1,
    ...trend.map((d) => (d.approved || 0) + (d.rejected || 0))
  );

  // Pixel height for chart area (match CSS below)
  const chartInnerHeight = 260;

  const tickCount = 4;
  const tickStep = Math.ceil(maxValue / tickCount);
  const ticks = [];
  for (let i = tickCount; i >= 0; i--) ticks.push(i * tickStep);

  const totalDocs = stats?.total || 0;
  const approvedCount = stats?.statusDistribution?.approved || 0;
  const rejectedCount = stats?.statusDistribution?.rejected || 0;
  const pendingCount = stats?.statusDistribution?.pending || 0;

  // Compute percentages for the pie (guard divide by zero)
  const approvedPercentage =
    totalDocs > 0
      ? Math.round((approvedCount / totalDocs) * 100)
      : Math.round(
          (approvedCount /
            (approvedCount + rejectedCount + pendingCount || 1)) *
            100
        );
  const rejectedPercentage =
    totalDocs > 0
      ? Math.round((rejectedCount / totalDocs) * 100)
      : Math.round(
          (rejectedCount /
            (approvedCount + rejectedCount + pendingCount || 1)) *
            100
        );
  const pendingPercentage = Math.max(
    0,
    100 - (approvedPercentage + rejectedPercentage)
  ); // ensure sum==100

  // Build conic-gradient style for the pie
  const pieBg = `conic-gradient(
    #4ade80 0% ${approvedPercentage}%,
    #ef4444 ${approvedPercentage}% ${approvedPercentage + rejectedPercentage}%,
    #fb923c ${approvedPercentage + rejectedPercentage}% 100%
  )`;

  return (
    <div className="analytics-container">
      {/* ... header and metrics unchanged ... */}

      <div className="metrics-grid">
        {/* metric cards (unchanged) */}
        <div className="metric-card metric-card-blue">
          <div className="metric-icon-wrapper metric-icon-blue">
            <FileText />
          </div>
          <div className="metric-content">
            <div className="metric-value">{stats?.total || 0}</div>
            <div className="metric-label">Total Documents</div>
            <div className="metric-description">All processed documents</div>
          </div>
        </div>
        <div className="metric-card metric-card-green">
          <div className="metric-icon-wrapper metric-icon-green">
            <CheckCircle />
          </div>
          <div className="metric-content">
            <div className="metric-value">{approvedPercentage}%</div>
            <div className="metric-label">Approval Rate</div>
            <div className="metric-description">Successfully approved</div>
          </div>
        </div>
        <div className="metric-card metric-card-purple">
          <div className="metric-icon-wrapper metric-icon-purple">
            <Clock />
          </div>
          <div className="metric-content">
            <div className="metric-value">{stats?.avgReviewTime || 0} days</div>
            <div className="metric-label">Avg Review Time</div>
            <div className="metric-description">Average processing time</div>
          </div>
        </div>
        <div className="metric-card metric-card-orange">
          <div className="metric-icon-wrapper metric-icon-orange">
            <AlertCircle />
          </div>
          <div className="metric-content">
            <div className="metric-value">{stats?.pending || 0}</div>
            <div className="metric-label">Pending Review</div>
            <div className="metric-description">Awaiting approval</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Activity Trend (bars) */}
        <div className="chart-card chart-card-large">
          <div className="chart-header">
            <div className="chart-header-left">
              <BarChart3 className="chart-header-icon" />
              <div>
                <h3 className="chart-title">Activity Trend</h3>
                <p className="chart-subtitle">Monthly approval activity</p>
              </div>
            </div>
          </div>

          <div className="chart-body">
            <div className="bar-chart">
              <div className="chart-y-axis">
                {ticks.map((t, i) => (
                  <span key={i}>{t}</span>
                ))}
              </div>

              <div className="chart-bars">
                {trend.map((d, idx) => {
                  const approvedPx = Math.round(
                    ((d.approved || 0) / maxValue) * chartInnerHeight
                  );
                  const rejectedPx = Math.round(
                    ((d.rejected || 0) / maxValue) * chartInnerHeight
                  );
                  return (
                    <div key={idx} className="bar-group">
                      <div
                        className="bar-stack"
                        style={{ height: `${chartInnerHeight}px` }}
                      >
                        <div
                          className="bar-segment bar-approved"
                          style={{ height: `${approvedPx}px` }}
                          title={`Approved: ${d.approved}`}
                        />
                        <div
                          className="bar-segment bar-rejected"
                          style={{ height: `${rejectedPx}px` }}
                          title={`Rejected: ${d.rejected}`}
                        />
                      </div>
                      <span className="bar-label">{d.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* debug JSON (optional) */}
            <div style={{ marginTop: 12, color: "rgba(255,255,255,0.85)" }}>
              <strong>Debug — activityTrend (client):</strong>
              <pre
                style={{
                  background: "rgba(0,0,0,0.2)",
                  padding: 10,
                  borderRadius: 6,
                  maxHeight: 140,
                  overflow: "auto",
                }}
              >
                {JSON.stringify(stats?.activityTrend || [], null, 2)}
              </pre>
            </div>

            <div className="chart-legend">
              <div className="legend-item">
                <span className="legend-color legend-approved"></span>
                <span>Approved</span>
              </div>
              <div className="legend-item">
                <span className="legend-color legend-rejected"></span>
                <span>Rejected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Distribution (PIE using conic-gradient for a perfect circle) */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-header-left">
              <PieChart className="chart-header-icon" />
              <div>
                <h3 className="chart-title">Status Distribution</h3>
                <p className="chart-subtitle">
                  Documents in selected time range
                </p>
              </div>
            </div>
          </div>

          <div className="chart-body">
            <div className="pie-chart-container">
              <div
                className="pie-chart-css"
                style={{
                  background: pieBg,
                  // rotate so first slice starts at top like the SVG did
                  transform: "rotate(-90deg)",
                }}
                title={`Approved ${approvedCount}, Rejected ${rejectedCount}, Pending ${pendingCount}`}
              />
            </div>

            <div className="pie-legend">
              <div className="pie-legend-item">
                <span
                  className="pie-legend-color"
                  style={{ background: "#4ade80" }}
                />
                <div className="pie-legend-text">
                  <span className="pie-legend-label">Approved</span>
                  <span className="pie-legend-value">{approvedCount}</span>
                </div>
              </div>
              <div className="pie-legend-item">
                <span
                  className="pie-legend-color"
                  style={{ background: "#ef4444" }}
                />
                <div className="pie-legend-text">
                  <span className="pie-legend-label">Rejected</span>
                  <span className="pie-legend-value">{rejectedCount}</span>
                </div>
              </div>
              <div className="pie-legend-item">
                <span
                  className="pie-legend-color"
                  style={{ background: "#fb923c" }}
                />
                <div className="pie-legend-text">
                  <span className="pie-legend-label">Pending</span>
                  <span className="pie-legend-value">{pendingCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="recent-activity-analytics">
        <div className="section-header-analytics">
          <Activity className="section-icon-analytics" />
          <div>
            <h3 className="section-title-analytics">Recent Activity</h3>
            <p className="section-subtitle-analytics">
              Latest document actions
            </p>
          </div>
        </div>
        <div className="activity-list-analytics">
          {stats?.recentActivity?.map((activity, index) => (
            <div key={index} className="activity-item-analytics">
              <div
                className={`activity-icon-analytics activity-icon-${activity.type}`}
              >
                {activity.type === "approved" && <CheckCircle />}
                {activity.type === "rejected" && <XCircle />}
                {activity.type === "pending" && <Clock />}
              </div>
              <div className="activity-details-analytics">
                <div className="activity-document">{activity.document}</div>
                <div className="activity-meta">
                  <span className="activity-department">
                    {activity.department}
                  </span>
                  <span className="activity-separator">•</span>
                  <span className="activity-date">{activity.date}</span>
                </div>
              </div>
              <span
                className={`activity-badge activity-badge-${activity.type}`}
              >
                {activity.type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Analytics;
