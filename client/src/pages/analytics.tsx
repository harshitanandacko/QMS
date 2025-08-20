import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Database, Activity, Clock, CheckCircle, AlertCircle, TrendingUp, Users, FileText } from "lucide-react";
import AppHeader from "@/components/app-header";
import Sidebar from "@/components/sidebar";
import { isUnauthorizedError } from "@/lib/authUtils";

interface AnalyticsData {
  totalQueries: number;
  executedQueries: number;
  pendingApprovals: number;
  rejectedQueries: number;
  avgExecutionTime: number;
  topUsers: { name: string; count: number }[];
  queryTypeDistribution: { name: string; value: number; color: string }[];
  monthlyTrends: { month: string; queries: number; executed: number }[];
  serverUsage: { server: string; queries: number; success: number }[];
}

export default function Analytics() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [dateRange, setDateRange] = useState("30");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: analytics, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ["/api/analytics", dateRange],
    enabled: !!isAuthenticated && !!user && ((user as any).role === 'team_manager' || (user as any).role === 'skip_manager'),
  });

  const { data: queries = [] } = useQuery({
    queryKey: ["/api/queries"],
    enabled: !!isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-enterprise-gray flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-enterprise-blue mx-auto mb-4"></div>
          <p className="text-enterprise-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Check if user has permission to view analytics
  if (!user || ((user as any).role !== 'team_manager' && (user as any).role !== 'skip_manager')) {
    return (
      <div className="min-h-screen bg-enterprise-gray">
        <AppHeader />
        <div className="flex pt-16">
          <Sidebar />
          <main className="flex-1 ml-64 p-8">
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-12 w-12 text-enterprise-warning mb-4" />
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
              <p className="text-enterprise-muted">Only Team Managers and Skip Managers can view analytics.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Generate mock analytics data based on actual queries
  const mockAnalytics: AnalyticsData = {
    totalQueries: (queries as any[]).length || 0,
    executedQueries: (queries as any[]).filter(q => q.status === 'executed').length || 0,
    pendingApprovals: (queries as any[]).filter(q => q.status === 'submitted' || q.status === 'team_manager_approved').length || 0,
    rejectedQueries: (queries as any[]).filter(q => q.status === 'rejected').length || 0,
    avgExecutionTime: 1250, // milliseconds
    topUsers: [
      { name: "John Smith", count: 12 },
      { name: "Sarah Johnson", count: 8 },
      { name: "Mike Wilson", count: 6 },
      { name: "Lisa Davis", count: 5 }
    ],
    queryTypeDistribution: [
      { name: "SELECT", value: 65, color: "#3B82F6" },
      { name: "UPDATE", value: 20, color: "#F59E0B" },
      { name: "INSERT", value: 10, color: "#10B981" },
      { name: "DELETE", value: 5, color: "#EF4444" }
    ],
    monthlyTrends: [
      { month: "Jul", queries: 45, executed: 38 },
      { month: "Aug", queries: 52, executed: 45 },
      { month: "Sep", queries: 38, executed: 32 },
      { month: "Oct", queries: 61, executed: 55 },
      { month: "Nov", queries: 49, executed: 44 },
      { month: "Dec", queries: 58, executed: 52 }
    ],
    serverUsage: [
      { server: "tpaoeldbsd001", queries: 25, success: 23 },
      { server: "tpaoeldbsr001", queries: 18, success: 17 },
      { server: "tpacospgsd001", queries: 15, success: 14 },
      { server: "tpacospgsr001", queries: 12, success: 11 },
      { server: "Others", queries: 30, success: 28 }
    ]
  };

  const currentAnalytics = analytics || mockAnalytics;

  return (
    <div className="min-h-screen bg-enterprise-gray">
      <AppHeader />
      <div className="flex pt-16">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
                <p className="text-enterprise-muted mt-1">Query execution metrics and performance insights</p>
              </div>
              <div className="flex items-center space-x-4">
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 3 months</SelectItem>
                    <SelectItem value="365">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
                  <FileText className="h-4 w-4 text-enterprise-muted" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentAnalytics.totalQueries}</div>
                  <p className="text-xs text-enterprise-muted">
                    +12% from last period
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Executed Successfully</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentAnalytics.executedQueries}</div>
                  <p className="text-xs text-enterprise-muted">
                    {currentAnalytics.totalQueries > 0 
                      ? Math.round((currentAnalytics.executedQueries / currentAnalytics.totalQueries) * 100)
                      : 0}% success rate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                  <Clock className="h-4 w-4 text-enterprise-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentAnalytics.pendingApprovals}</div>
                  <p className="text-xs text-enterprise-muted">
                    Awaiting review
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Execution Time</CardTitle>
                  <Activity className="h-4 w-4 text-enterprise-muted" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(currentAnalytics.avgExecutionTime / 1000).toFixed(2)}s</div>
                  <p className="text-xs text-enterprise-muted">
                    -8% from last period
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Query Type Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Query Type Distribution</CardTitle>
                  <CardDescription>Breakdown by SQL operation type</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={currentAnalytics.queryTypeDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {currentAnalytics.queryTypeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Monthly Trends */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Query Trends</CardTitle>
                  <CardDescription>Query submissions and executions over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={currentAnalytics.monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="queries" stroke="#3B82F6" strokeWidth={2} name="Submitted" />
                      <Line type="monotone" dataKey="executed" stroke="#10B981" strokeWidth={2} name="Executed" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Users */}
              <Card>
                <CardHeader>
                  <CardTitle>Most Active Users</CardTitle>
                  <CardDescription>Users with the highest query submissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {currentAnalytics.topUsers.map((user, index) => (
                      <div key={user.name} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center w-8 h-8 bg-enterprise-blue text-white rounded-full text-sm font-medium">
                            {index + 1}
                          </div>
                          <span className="font-medium">{user.name}</span>
                        </div>
                        <Badge variant="outline">{user.count} queries</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Server Usage */}
              <Card>
                <CardHeader>
                  <CardTitle>Database Server Usage</CardTitle>
                  <CardDescription>Query distribution across Oracle servers</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={currentAnalytics.serverUsage}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="server" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="queries" fill="#3B82F6" name="Total Queries" />
                      <Bar dataKey="success" fill="#10B981" name="Successful" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}