import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Shield, Users, Clock, CheckCircle, AlertTriangle } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-enterprise-gray">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-enterprise-blue rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Oracle Query Management</h1>
            </div>
            <Button 
              onClick={() => window.location.href = '/api/login'}
              className="bg-enterprise-blue hover:bg-enterprise-blue-dark text-white"
            >
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            Enterprise Oracle Database Query Management
          </h1>
          <p className="text-xl text-enterprise-muted mb-8 max-w-3xl mx-auto">
            Secure, controlled, and auditable Oracle database query execution with enterprise-grade 
            two-level approval workflow for Oracle 10g and 19c environments.
          </p>
          <Button 
            size="lg"
            onClick={() => window.location.href = '/api/login'}
            className="bg-enterprise-blue hover:bg-enterprise-blue-dark text-white px-8 py-3"
          >
            Get Started
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-enterprise-gray">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Enterprise-Grade Database Management
            </h2>
            <p className="text-lg text-enterprise-muted max-w-2xl mx-auto">
              Built for enterprise environments requiring strict controls, audit trails, 
              and approval workflows for database operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Two-Level Approval */}
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-enterprise-blue" />
                </div>
                <CardTitle>Two-Level Approval</CardTitle>
                <CardDescription>
                  Team Manager and Skip Manager approval required before query execution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-enterprise-muted">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>Team Manager review</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>Skip Manager approval</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>Automated execution</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Security & Audit */}
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-enterprise-success" />
                </div>
                <CardTitle>Security & Audit</CardTitle>
                <CardDescription>
                  Complete audit trail with user authentication and query tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-enterprise-muted">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>User authentication</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>Query audit trail</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>Role-based access</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Oracle Support */}
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <Database className="w-6 h-6 text-enterprise-warning" />
                </div>
                <CardTitle>Oracle 10g & 19c</CardTitle>
                <CardDescription>
                  Support for multiple Oracle database versions and server environments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-enterprise-muted">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>Oracle 10g support</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>Oracle 19c support</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>Multiple environments</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Dry Run & Rollback */}
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle>Dry Run & Rollback</CardTitle>
                <CardDescription>
                  Test queries safely with dry run capability and rollback mechanisms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-enterprise-muted">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>Query validation</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>Dry run execution</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>Automatic rollback</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Parameterized Queries */}
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6 text-enterprise-error" />
                </div>
                <CardTitle>Parameterized Queries</CardTitle>
                <CardDescription>
                  Support for parameterized queries with type validation and safety checks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-enterprise-muted">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>Parameter detection</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>Type validation</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>SQL injection prevention</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Query Templates */}
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <Database className="w-6 h-6 text-indigo-600" />
                </div>
                <CardTitle>Query Templates</CardTitle>
                <CardDescription>
                  Pre-built query templates for common operations and reporting needs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-enterprise-muted">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>Standard templates</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>Custom templates</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-enterprise-success" />
                    <span>Template sharing</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Secure Your Database Operations?
          </h2>
          <p className="text-lg text-enterprise-muted mb-8 max-w-2xl mx-auto">
            Join your enterprise team in managing Oracle database queries with confidence, 
            security, and full audit compliance.
          </p>
          <Button 
            size="lg"
            onClick={() => window.location.href = '/api/login'}
            className="bg-enterprise-blue hover:bg-enterprise-blue-dark text-white px-8 py-3"
          >
            Access Your Dashboard
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-enterprise-blue rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold">Oracle Query Management</span>
            </div>
            <p className="text-gray-400 text-sm">
              Enterprise-grade database query management with audit compliance
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
