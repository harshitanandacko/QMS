import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupBasicAuth, isAuthenticated } from "./basicAuth";
import OracleService from "./oracleService";
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
  await setupBasicAuth(app);

  // Seed database servers on startup
  await seedDatabaseServers();
  
  // Initialize Oracle connections for critical servers
  await initializeOracleConnections();

  // Health check endpoint (no auth required)
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      message: 'QMS Server is running with Basic Authentication',
      timestamp: new Date().toISOString()
    });
  });


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

  // Get current user's team information
  app.get('/api/users/me/team', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.teamId) {
        return res.status(404).json({ message: "User team not found" });
      }
      
      const team = await storage.getTeam(user.teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      res.json(team);
    } catch (error) {
      console.error("Error fetching user team:", error);
      res.status(500).json({ message: "Failed to fetch team information" });
    }
  });

  // Get all users (for manager lookup)
  app.get('/api/users', isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Only return essential fields for security
      const safeUsers = users.map((user: any) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Database server routes
  app.get('/api/database-servers', isAuthenticated, async (req, res) => {
    try {
      const servers = await storage.getDatabaseServers();
      // Add cache-busting headers to ensure fresh data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.json(servers);
    } catch (error) {
      console.error("Error fetching database servers:", error);
      res.status(500).json({ message: "Failed to fetch database servers" });
    }
  });

  app.get('/api/database-servers/:serverId/tables', isAuthenticated, async (req, res) => {
    try {
      const { serverId } = req.params;
      
      // Get server details for Oracle connection
      const server = await storage.getDatabaseServer(serverId);
      if (!server) {
        return res.status(404).json({ message: "Database server not found" });
      }

      // Get Oracle service instance
      const oracleService = OracleService.getInstance();
      
      try {
        // Get Oracle configuration
        const oracleConfig = OracleService.getOracleConfig(server);
        
        // Create connection pool if it doesn't exist
        await oracleService.createConnectionPool(serverId, oracleConfig);
        
        // Fetch real tables from Oracle
        const oracleTables = await oracleService.fetchTables(serverId);
        
        // Transform Oracle tables to our expected format
        const tables = oracleTables.map(table => ({
          id: `${serverId}_${table.schema}_${table.tableName}`,
          serverId: serverId,
          tableName: table.tableName,
          schema: table.schema,
          tableType: table.tableType,
          comments: table.comments
        }));
        
        console.log(`Fetched ${tables.length} real tables from Oracle server ${serverId}`);
        res.json(tables);
        
      } catch (oracleError) {
        console.error(`Oracle connection failed for ${serverId}:`, oracleError);
        
        // Fallback to mock data if Oracle connection fails
        console.log(`Falling back to mock data for ${serverId}`);
        const mockTables = await storage.getTablesForServer(serverId);
        res.json(mockTables);
      }
      
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
      const user = await storage.getUser(userId);
      
      if (!user || !user.teamId) {
        return res.status(400).json({ 
          message: "User must be assigned to a team to submit queries" 
        });
      }

      const queryData = insertQuerySchema.parse({
        ...req.body,
        submittedBy: userId,
        teamId: user.teamId,
      });

      // Get team information to assign correct managers
      const team = await storage.getTeam(user.teamId);
      if (!team) {
        return res.status(400).json({ 
          message: "Team not found" 
        });
      }

      // Set approval requirements based on query type
      const isSelectQuery = queryData.queryType === 'select';
      queryData.requiresApproval = !isSelectQuery;

      // Assign team manager and skip manager from the user's team
      queryData.teamManagerId = team.managerId;
      queryData.skipManagerId = team.skipManagerId;

      const query = await storage.createQuery(queryData);
      
      // For SELECT queries, auto-approve after creation
      if (isSelectQuery) {
        await storage.updateQuery(query.id, { status: 'approved' });
      }
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
      // Note: Tables will be fetched dynamically from Oracle servers
    }

    console.log('Database servers seeded successfully');
  } catch (error) {
    console.error('Error seeding database servers:', error);
  }
}

async function initializeOracleConnections() {
  try {
    const oracleService = OracleService.getInstance();
    
    // Initialize connection for tpasolorad004 (the one with real credentials)
    const testServer = await storage.getDatabaseServer('tpasolorad004');
    if (testServer) {
      try {
        const oracleConfig = OracleService.getOracleConfig(testServer);
        const isConnected = await oracleService.testConnection('tpasolorad004', oracleConfig);
        
        if (isConnected) {
          await oracleService.createConnectionPool('tpasolorad004', oracleConfig);
          console.log('✅ Oracle connection pool created for tpasolorad004');
        } else {
          console.log('⚠️  Oracle connection test failed for tpasolorad004 - using mock data fallback');
        }
      } catch (error) {
        console.error('Failed to initialize Oracle connection for tpasolorad004:', error);
      }
    }
  } catch (error) {
    console.error('Error initializing Oracle connections:', error);
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
