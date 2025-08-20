import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, Database, Users, Shield, Bell, Clock, AlertCircle, CheckCircle, Save, TestTube } from "lucide-react";
import AppHeader from "@/components/app-header";
import Sidebar from "@/components/sidebar";
import { isUnauthorizedError } from "@/lib/authUtils";

interface SystemSettings {
  queryTimeout: number;
  maxConcurrentQueries: number;
  autoApprovalEnabled: boolean;
  emailNotifications: boolean;
  auditLogRetention: number;
  backupRetention: number;
}

interface DatabaseServer {
  id: string;
  name: string;
  host: string;
  port: number;
  version: string;
  status: 'connected' | 'disconnected' | 'error';
  lastChecked: string;
}

export default function Settings() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  // System settings state
  const [settings, setSettings] = useState<SystemSettings>({
    queryTimeout: 300,
    maxConcurrentQueries: 5,
    autoApprovalEnabled: false,
    emailNotifications: true,
    auditLogRetention: 90,
    backupRetention: 30
  });

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

  const { data: databaseServers = [] } = useQuery({
    queryKey: ["/api/database-servers"],
    enabled: !!isAuthenticated,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: !!isAuthenticated && !!user && ((user as any).role === 'skip_manager'),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: SystemSettings) => {
      await apiRequest("PUT", "/api/settings", newSettings);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (serverId: string) => {
      return await apiRequest("POST", `/api/oracle/test-connection/${serverId}`);
    },
    onSuccess: (data, serverId) => {
      toast({
        title: "Connection Successful",
        description: `Successfully connected to ${serverId}`,
      });
      setTestingConnection(null);
      queryClient.invalidateQueries({ queryKey: ["/api/database-servers"] });
    },
    onError: (error, serverId) => {
      toast({
        title: "Connection Failed",
        description: `Failed to connect to ${serverId}`,
        variant: "destructive",
      });
      setTestingConnection(null);
    },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await apiRequest("PUT", `/api/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    },
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

  // Check if user has permission to access settings
  if (!user || ((user as any).role !== 'team_manager' && (user as any).role !== 'skip_manager')) {
    return (
      <div className="min-h-screen bg-enterprise-gray">
        <AppHeader />
        <div className="flex pt-16">
          <Sidebar />
          <main className="flex-1 ml-64 p-8">
            <div className="text-center py-12">
              <Shield className="mx-auto h-12 w-12 text-enterprise-warning mb-4" />
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
              <p className="text-enterprise-muted">Only Team Managers and Skip Managers can access settings.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const handleSettingsChange = (key: keyof SystemSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate(settings);
  };

  const handleTestConnection = (serverId: string) => {
    setTestingConnection(serverId);
    testConnectionMutation.mutate(serverId);
  };

  const handleUpdateUserRole = (userId: string, role: string) => {
    updateUserRoleMutation.mutate({ userId, role });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-700">Connected</Badge>;
      case 'disconnected':
        return <Badge variant="outline" className="text-gray-600">Disconnected</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'skip_manager':
        return <Badge className="bg-purple-100 text-purple-700">Skip Manager</Badge>;
      case 'team_manager':
        return <Badge className="bg-blue-100 text-blue-700">Team Manager</Badge>;
      default:
        return <Badge variant="outline">Database Analyst</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-enterprise-gray">
      <AppHeader />
      <div className="flex pt-16">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
              <p className="text-enterprise-muted mt-1">Configure system behavior and manage resources</p>
            </div>

            <Tabs defaultValue="system" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="system" className="flex items-center space-x-2">
                  <SettingsIcon className="h-4 w-4" />
                  <span>System</span>
                </TabsTrigger>
                <TabsTrigger value="databases" className="flex items-center space-x-2">
                  <Database className="h-4 w-4" />
                  <span>Databases</span>
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>Users</span>
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center space-x-2">
                  <Shield className="h-4 w-4" />
                  <span>Security</span>
                </TabsTrigger>
              </TabsList>

              {/* System Settings */}
              <TabsContent value="system">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Query Execution Settings</CardTitle>
                      <CardDescription>Configure query timeout and execution limits</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="queryTimeout">Query Timeout (seconds)</Label>
                          <Input
                            id="queryTimeout"
                            type="number"
                            value={settings.queryTimeout}
                            onChange={(e) => handleSettingsChange('queryTimeout', parseInt(e.target.value))}
                          />
                          <p className="text-sm text-enterprise-muted">Maximum time allowed for query execution</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="maxConcurrent">Max Concurrent Queries</Label>
                          <Input
                            id="maxConcurrent"
                            type="number"
                            value={settings.maxConcurrentQueries}
                            onChange={(e) => handleSettingsChange('maxConcurrentQueries', parseInt(e.target.value))}
                          />
                          <p className="text-sm text-enterprise-muted">Maximum number of queries running simultaneously</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Approval Settings</CardTitle>
                      <CardDescription>Configure the approval workflow behavior</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Auto-approval for SELECT queries</Label>
                          <p className="text-sm text-enterprise-muted">Automatically approve read-only SELECT queries</p>
                        </div>
                        <Switch
                          checked={settings.autoApprovalEnabled}
                          onCheckedChange={(checked) => handleSettingsChange('autoApprovalEnabled', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Email Notifications</Label>
                          <p className="text-sm text-enterprise-muted">Send email notifications for approvals and executions</p>
                        </div>
                        <Switch
                          checked={settings.emailNotifications}
                          onCheckedChange={(checked) => handleSettingsChange('emailNotifications', checked)}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Data Retention</CardTitle>
                      <CardDescription>Configure how long to keep audit logs and backups</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="auditRetention">Audit Log Retention (days)</Label>
                          <Input
                            id="auditRetention"
                            type="number"
                            value={settings.auditLogRetention}
                            onChange={(e) => handleSettingsChange('auditLogRetention', parseInt(e.target.value))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="backupRetention">Backup Retention (days)</Label>
                          <Input
                            id="backupRetention"
                            type="number"
                            value={settings.backupRetention}
                            onChange={(e) => handleSettingsChange('backupRetention', parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex justify-end">
                    <Button 
                      onClick={handleSaveSettings}
                      disabled={saveSettingsMutation.isPending}
                      className="flex items-center space-x-2"
                    >
                      <Save className="h-4 w-4" />
                      <span>{saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}</span>
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Database Settings */}
              <TabsContent value="databases">
                <Card>
                  <CardHeader>
                    <CardTitle>Database Servers</CardTitle>
                    <CardDescription>Manage Oracle database server connections</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(databaseServers as any[]).map((server) => (
                        <div key={server.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <Database className="h-8 w-8 text-enterprise-blue" />
                            <div>
                              <h3 className="font-medium">{server.name}</h3>
                              <p className="text-sm text-enterprise-muted">{server.host || server.id}</p>
                              <p className="text-sm text-enterprise-muted">Version: {server.version}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            {getStatusBadge(server.status || 'disconnected')}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestConnection(server.id)}
                              disabled={testingConnection === server.id}
                              className="flex items-center space-x-2"
                            >
                              <TestTube className="h-4 w-4" />
                              <span>{testingConnection === server.id ? 'Testing...' : 'Test Connection'}</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* User Management */}
              <TabsContent value="users">
                <Card>
                  <CardHeader>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Manage user roles and permissions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(user as any).role !== 'skip_manager' ? (
                      <div className="text-center py-8">
                        <Shield className="mx-auto h-12 w-12 text-enterprise-warning mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Skip Manager Access Required</h3>
                        <p className="text-enterprise-muted">Only Skip Managers can manage user roles.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(users as any[]).map((userItem) => (
                          <div key={userItem.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center space-x-4">
                              <div className="w-10 h-10 bg-enterprise-blue text-white rounded-full flex items-center justify-center">
                                {userItem.firstName?.charAt(0) || userItem.email?.charAt(0) || 'U'}
                              </div>
                              <div>
                                <h3 className="font-medium">{userItem.firstName} {userItem.lastName}</h3>
                                <p className="text-sm text-enterprise-muted">{userItem.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              {getRoleBadge(userItem.role)}
                              <Select 
                                value={userItem.role} 
                                onValueChange={(role) => handleUpdateUserRole(userItem.id, role)}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">Database Analyst</SelectItem>
                                  <SelectItem value="team_manager">Team Manager</SelectItem>
                                  <SelectItem value="skip_manager">Skip Manager</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Settings */}
              <TabsContent value="security">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Security Policies</CardTitle>
                      <CardDescription>Configure security and audit settings</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h4 className="font-medium">Require Two-Factor Authentication</h4>
                            <p className="text-sm text-enterprise-muted">Enforce 2FA for all users</p>
                          </div>
                          <Switch />
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h4 className="font-medium">Log All Query Executions</h4>
                            <p className="text-sm text-enterprise-muted">Maintain complete audit trail</p>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h4 className="font-medium">Encrypt Data at Rest</h4>
                            <p className="text-sm text-enterprise-muted">Encrypt stored query results and logs</p>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h4 className="font-medium">IP Whitelisting</h4>
                            <p className="text-sm text-enterprise-muted">Restrict access to specific IP ranges</p>
                          </div>
                          <Switch />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Audit Configuration</CardTitle>
                      <CardDescription>Configure what activities to audit</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="auditEvents">Audit Events</Label>
                          <Textarea
                            id="auditEvents"
                            placeholder="Login attempts, query executions, approval actions, role changes, system configuration changes"
                            className="min-h-[100px]"
                            defaultValue="Login attempts, query executions, approval actions, role changes, system configuration changes"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}