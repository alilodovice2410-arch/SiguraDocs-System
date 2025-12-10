import { useState, useEffect } from "react";
import {
  Upload,
  Eye,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

function StaffDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await api.get("/dashboard/stats");
      setStats(response.data.data);
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-orange-100 text-orange-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      in_review: "bg-blue-100 text-blue-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back!</h1>
        <p className="text-gray-600">
          Here's what's happening with your documents today.
        </p>
      </div>

      {/* Quick Actions - More Prominent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Upload Document */}
        <div className="bg-white rounded-lg shadow p-6 ring-2 ring-blue-500">
          <div className="flex items-start">
            <div className="p-3 rounded-lg bg-blue-600 text-white mr-4">
              <Upload className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Upload Document
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Submit a new document for approval
              </p>
              <button
                onClick={() => navigate("/documents/upload")}
                className="inline-block px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Upload Now
              </button>
            </div>
          </div>
        </div>

        {/* View Documents */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start">
            <div className="p-3 rounded-lg bg-gray-100 text-gray-600 mr-4">
              <Eye className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                View Documents
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Browse all your documents
              </p>
              <button
                onClick={() => navigate("/documents")}
                className="inline-block px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                View All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Total Documents */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
              <FileText className="w-6 h-6" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">
              Total Documents
            </p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {stats?.totalDocuments || 0}
            </p>
            <p className="text-sm text-gray-500">Your submissions</p>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-orange-50 text-orange-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Pending</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {stats?.pending || 0}
            </p>
            <p className="text-sm text-gray-500">Under review</p>
          </div>
        </div>

        {/* Approved */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-green-50 text-green-600">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Approved</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {stats?.approved || 0}
            </p>
            <p className="text-sm text-gray-500">Successfully approved</p>
          </div>
        </div>

        {/* Rejected */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-red-50 text-red-600">
              <XCircle className="w-6 h-6" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Rejected</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {stats?.rejected || 0}
            </p>
            <p className="text-sm text-gray-500">Needs attention</p>
          </div>
        </div>
      </div>

      {/* Recent Documents */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Documents
          </h2>
          <p className="text-sm text-gray-600">
            Your recently submitted documents
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {!stats?.recentDocuments || stats.recentDocuments.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="font-medium mb-1">No documents yet</p>
              <p className="text-sm mb-4">
                Upload your first document to get started!
              </p>
              <button
                onClick={() => navigate("/documents/upload")}
                className="inline-block px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Upload Document
              </button>
            </div>
          ) : (
            stats.recentDocuments.map((doc) => (
              <div
                key={doc.id}
                className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/documents/${doc.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {doc.title}
                    </p>
                    <p className="text-sm text-gray-600">
                      {doc.type} • {doc.date}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                      doc.status
                    )}`}
                  >
                    {doc.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default StaffDashboard;
