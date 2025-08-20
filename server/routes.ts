import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertQuerySchema, 
  insertApprovalSchema, 
  insertQueryTemplateSchema,
  insertDatabaseServerSchema,
  insertDatabaseTableSchema 
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Seed database servers on startup
  await seedDatabaseServers();

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Database server routes
  app.get('/api/database-servers', isAuthenticated, async (req, res) => {
    try {
      const servers = await storage.getDatabaseServers();
      res.json(servers);
    } catch (error) {
      console.error("Error fetching database servers:", error);
      res.status(500).json({ message: "Failed to fetch database servers" });
    }
  });

  app.get('/api/database-servers/:serverId/tables', isAuthenticated, async (req, res) => {
    try {
      const { serverId } = req.params;
      const tables = await storage.getTablesForServer(serverId);
      res.json(tables);
    } catch (error) {
      console.error("Error fetching tables:", error);
      res.status(500).json({ message: "Failed to fetch tables" });
    }
  });

  // Query routes
  app.get('/api/queries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { status } = req.query;
      const queries = await storage.getQueries(userId, status as string);
      res.json(queries);
    } catch (error) {
      console.error("Error fetching queries:", error);
      res.status(500).json({ message: "Failed to fetch queries" });
    }
  });

  app.get('/api/queries/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const query = await storage.getQuery(id);
      if (!query) {
        return res.status(404).json({ message: "Query not found" });
      }
      res.json(query);
    } catch (error) {
      console.error("Error fetching query:", error);
      res.status(500).json({ message: "Failed to fetch query" });
    }
  });

  app.post('/api/queries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const queryData = insertQuerySchema.parse({
        ...req.body,
        submittedBy: userId,
      });

      // Assign team manager and skip manager based on roles
      const teamManagers = await storage.getUsersByRole('team_manager');
      const skipManagers = await storage.getUsersByRole('skip_manager');
      
      if (teamManagers.length === 0 || skipManagers.length === 0) {
        return res.status(400).json({ 
          message: "No team managers or skip managers available for approval" 
        });
      }

      // For simplicity, assign the first available managers
      queryData.teamManagerId = teamManagers[0].id;
      queryData.skipManagerId = skipManagers[0].id;

      const query = await storage.createQuery(queryData);
      res.status(201).json(query);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating query:", error);
      res.status(500).json({ message: "Failed to create query" });
    }
  });

  app.patch('/api/queries/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const query = await storage.updateQuery(id, updates);
      res.json(query);
    } catch (error) {
      console.error("Error updating query:", error);
      res.status(500).json({ message: "Failed to update query" });
    }
  });

  app.post('/api/queries/:id/submit', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const query = await storage.updateQuery(id, { 
        status: 'submitted',
        submittedAt: new Date()
      });
      
      // Create pending approvals
      await storage.createApproval({
        queryId: id,
        approverType: 'team_manager',
        approverId: query.teamManagerId!,
        status: 'pending',
      });

      res.json(query);
    } catch (error) {
      console.error("Error submitting query:", error);
      res.status(500).json({ message: "Failed to submit query" });
    }
  });

  app.post('/api/queries/:id/dry-run', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const query = await storage.getQuery(id);
      
      if (!query) {
        return res.status(404).json({ message: "Query not found" });
      }

      // Simulate dry run execution
      const dryRunResults = {
        estimatedRows: Math.floor(Math.random() * 10000),
        estimatedExecutionTime: `${(Math.random() * 5 + 0.5).toFixed(2)}s`,
        queryPlan: "Simulated query execution plan",
        warnings: [],
      };

      await storage.updateQuery(id, {
        isDryRun: true,
        estimatedExecutionTime: dryRunResults.estimatedExecutionTime,
      });

      res.json(dryRunResults);
    } catch (error) {
      console.error("Error executing dry run:", error);
      res.status(500).json({ message: "Failed to execute dry run" });
    }
  });

  app.post('/api/queries/:id/execute', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const query = await storage.getQuery(id);
      
      if (!query) {
        return res.status(404).json({ message: "Query not found" });
      }

      if (query.status !== 'approved') {
        return res.status(400).json({ message: "Query must be approved before execution" });
      }

      // Simulate query execution
      const executionResults = {
        success: true,
        rowsAffected: Math.floor(Math.random() * 5000),
        executionTime: `${(Math.random() * 3 + 0.5).toFixed(2)}s`,
        memoryUsed: `${(Math.random() * 50 + 10).toFixed(1)} MB`,
        data: generateMockResultData(query.queryType),
      };

      await storage.updateQuery(id, {
        status: 'executed',
        executedAt: new Date(),
        actualExecutionTime: executionResults.executionTime,
        rowsAffected: executionResults.rowsAffected.toString(),
        executionResults: executionResults,
      });

      res.json(executionResults);
    } catch (error) {
      console.error("Error executing query:", error);
      res.status(500).json({ message: "Failed to execute query" });
    }
  });

  app.post('/api/queries/:id/rollback', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const query = await storage.getQuery(id);
      
      if (!query) {
        return res.status(404).json({ message: "Query not found" });
      }

      if (!query.canRollback) {
        return res.status(400).json({ message: "Query cannot be rolled back" });
      }

      // Simulate rollback
      await storage.updateQuery(id, {
        status: 'rolled_back',
        updatedAt: new Date(),
      });

      res.json({ message: "Query rolled back successfully" });
    } catch (error) {
      console.error("Error rolling back query:", error);
      res.status(500).json({ message: "Failed to rollback query" });
    }
  });

  // Approval routes
  app.get('/api/approvals/pending', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || (user.role !== 'team_manager' && user.role !== 'skip_manager')) {
        return res.json([]);
      }

      const queries = await storage.getQueriesForApproval(userId, user.role as any);
      res.json(queries);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      res.status(500).json({ message: "Failed to fetch pending approvals" });
    }
  });

  app.post('/api/approvals/:id/approve', isAuthenticated, async (req: any, res) => {
    try {
      const { id: approvalId } = req.params;
      const { comments } = req.body;
      const userId = req.user.claims.sub;

      const approval = await storage.updateApproval(approvalId, {
        status: 'approved',
        comments,
      });

      // Update query status based on approval type
      const query = await storage.getQuery(approval.queryId);
      if (!query) {
        return res.status(404).json({ message: "Query not found" });
      }

      let newStatus = query.status;
      if (approval.approverType === 'team_manager') {
        newStatus = 'team_manager_approved';
        // Create skip manager approval
        await storage.createApproval({
          queryId: query.id,
          approverType: 'skip_manager',
          approverId: query.skipManagerId!,
          status: 'pending',
        });
      } else if (approval.approverType === 'skip_manager') {
        newStatus = 'approved';
      }

      await storage.updateQuery(query.id, { status: newStatus as any });

      res.json({ message: "Approval successful" });
    } catch (error) {
      console.error("Error approving query:", error);
      res.status(500).json({ message: "Failed to approve query" });
    }
  });

  app.post('/api/approvals/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const { id: approvalId } = req.params;
      const { comments } = req.body;

      const approval = await storage.updateApproval(approvalId, {
        status: 'rejected',
        comments,
      });

      await storage.updateQuery(approval.queryId, { status: 'rejected' });

      res.json({ message: "Query rejected" });
    } catch (error) {
      console.error("Error rejecting query:", error);
      res.status(500).json({ message: "Failed to reject query" });
    }
  });

  // Query template routes
  app.get('/api/query-templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const templates = await storage.getQueryTemplates(userId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching query templates:", error);
      res.status(500).json({ message: "Failed to fetch query templates" });
    }
  });

  app.post('/api/query-templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const templateData = insertQueryTemplateSchema.parse({
        ...req.body,
        createdBy: userId,
      });

      const template = await storage.createQueryTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating query template:", error);
      res.status(500).json({ message: "Failed to create query template" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function seedDatabaseServers() {
  try {
    const existingServers = await storage.getDatabaseServers();
    if (existingServers.length > 0) return;

    const servers = [
      { id: 'tpaoeldbsd001', name: 'tpaoeldbsd001', host: 'tpaoeldbsd001.company.com', port: '1521', version: '19c', type: 'production', status: 'online' },
      { id: 'tpaoeldbsr001', name: 'tpaoeldbsr001', host: 'tpaoeldbsr001.company.com', port: '1521', version: '19c', type: 'production', status: 'online' },
      { id: 'tpaoeldbsr002', name: 'tpaoeldbsr002', host: 'tpaoeldbsr002.company.com', port: '1521', version: '19c', type: 'production', status: 'online' },
      { id: 'tpaoeldbst001', name: 'tpaoeldbst001', host: 'tpaoeldbst001.company.com', port: '1521', version: '10g', type: 'test', status: 'online' },
      { id: 'tpasolorad005', name: 'tpasolorad005', host: 'tpasolorad005.company.com', port: '1521', version: '19c', type: 'test', status: 'online' },
      { id: 'tpasolorap003', name: 'tpasolorap003', host: 'tpasolorap003.company.com', port: '1521', version: '19c', type: 'test', status: 'online' },
      { id: 'tpasolorar002', name: 'tpasolorar002', host: 'tpasolorar002.company.com', port: '1521', version: '19c', type: 'reporting', status: 'online' },
      { id: 'tpasolorat002', name: 'tpasolorat002', host: 'tpasolorat002.company.com', port: '1521', version: '19c', type: 'reporting', status: 'online' },
      { id: 'tpasolorat003', name: 'tpasolorat003', host: 'tpasolorat003.company.com', port: '1521', version: '19c', type: 'reporting', status: 'online' },
      { id: 'tpasolorar001', name: 'tpasolorar001', host: 'tpasolorar001.company.com', port: '1521', version: '19c', type: 'reporting', status: 'online' },
      { id: 'tpaoelaudd001', name: 'tpaoelaudd001', host: 'tpaoelaudd001.company.com', port: '1521', version: '10g', type: 'audit', status: 'online' },
      { id: 'tpaoelaudt001', name: 'tpaoelaudt001', host: 'tpaoelaudt001.company.com', port: '1521', version: '10g', type: 'audit', status: 'online' },
      { id: 'tpasolorad004', name: 'tpasolorad004', host: 'tpasolorad004.company.com', port: '1521', version: '19c', type: 'reporting', status: 'online' },
      { id: 'tpasolorat001', name: 'tpasolorat001', host: 'tpasolorat001.company.com', port: '1521', version: '19c', type: 'reporting', status: 'online' },
      { id: 'tpaoelnaor001', name: 'tpaoelnaor001', host: 'tpaoelnaor001.company.com', port: '1521', version: '19c', type: 'production', status: 'online' },
      { id: 'tparhedbsd001', name: 'tparhedbsd001', host: 'tparhedbsd001.company.com', port: '1521', version: '19c', type: 'production', status: 'online' },
      { id: 'tpacospgsr001', name: 'tpacospgsr001', host: 'tpacospgsr001.company.com', port: '5432', version: '19c', type: 'production', status: 'online' },
      { id: 'tpacospgsr002', name: 'tpacospgsr002', host: 'tpacospgsr002.company.com', port: '5432', version: '19c', type: 'production', status: 'online' },
      { id: 'tpacostibp002', name: 'tpacostibp002', host: 'tpacostibp002.company.com', port: '1521', version: '19c', type: 'production', status: 'online' },
    ];

    for (const server of servers) {
      await storage.createDatabaseServer(server);
      
      // Add sample tables for each server
      const sampleTables = ['employees', 'departments', 'sales_data', 'customers', 'orders', 'products', 'audit_log', 'user_sessions'];
      for (const tableName of sampleTables) {
        await storage.createDatabaseTable({
          serverId: server.id,
          tableName,
          schema: 'public',
        });
      }
    }

    console.log('Database servers seeded successfully');
  } catch (error) {
    console.error('Error seeding database servers:', error);
  }
}

function generateMockResultData(queryType: string) {
  if (queryType === 'select') {
    return [
      { id: 1001, name: 'John Smith', department: 'Engineering', hire_date: '2022-01-15' },
      { id: 1002, name: 'Sarah Johnson', department: 'Marketing', hire_date: '2021-11-20' },
      { id: 1003, name: 'Michael Chen', department: 'Sales', hire_date: '2023-03-10' },
    ];
  }
  return null;
}
