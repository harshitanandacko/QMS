import {
  users,
  teams,
  databaseServers,
  databaseTables,
  queries,
  approvals,
  queryTemplates,
  type User,
  type UpsertUser,
  type Team,
  type DatabaseServer,
  type DatabaseTable,
  type Query,
  type Approval,
  type QueryTemplate,
  type InsertDatabaseServer,
  type InsertDatabaseTable,
  type InsertQuery,
  type InsertApproval,
  type InsertQueryTemplate,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc, ilike } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(userData: UpsertUser & { id?: string }): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Team operations
  getTeam(id: string): Promise<Team | undefined>;
  getTeams(): Promise<Team[]>;
  
  // Database server operations
  getDatabaseServers(): Promise<DatabaseServer[]>;
  getDatabaseServer(id: string): Promise<DatabaseServer | undefined>;
  createDatabaseServer(server: InsertDatabaseServer): Promise<DatabaseServer>;
  
  // Database table operations
  getTablesForServer(serverId: string): Promise<DatabaseTable[]>;
  createDatabaseTable(table: InsertDatabaseTable): Promise<DatabaseTable>;
  
  // Query operations
  getQueries(userId?: string, status?: string): Promise<Query[]>;
  getQuery(id: string): Promise<Query | undefined>;
  createQuery(query: InsertQuery & { status?: any }): Promise<Query>;
  updateQuery(id: string, updates: Partial<Query>): Promise<Query>;
  getQueriesByUser(userId: string): Promise<Query[]>;
  getQueriesForApproval(approverId: string, approverType: 'team_manager' | 'skip_manager'): Promise<Query[]>;
  
  // Approval operations
  getApprovalsByQuery(queryId: string): Promise<Approval[]>;
  createApproval(approval: InsertApproval): Promise<Approval>;
  updateApproval(id: string, updates: Partial<Approval>): Promise<Approval>;
  
  // Query template operations
  getQueryTemplates(userId?: string): Promise<QueryTemplate[]>;
  createQueryTemplate(template: InsertQueryTemplate): Promise<QueryTemplate>;
  
  // Role management
  getUsersByRole(role: string): Promise<User[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: UpsertUser & { id?: string }): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.firstName));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Team operations
  async getTeam(id: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async getTeams(): Promise<Team[]> {
    return await db.select().from(teams).orderBy(asc(teams.name));
  }

  // Database server operations
  async getDatabaseServers(): Promise<DatabaseServer[]> {
    return await db.select().from(databaseServers).orderBy(asc(databaseServers.name));
  }

  async getDatabaseServer(id: string): Promise<DatabaseServer | undefined> {
    const [server] = await db.select().from(databaseServers).where(eq(databaseServers.id, id));
    return server;
  }

  async createDatabaseServer(server: InsertDatabaseServer): Promise<DatabaseServer> {
    const [newServer] = await db.insert(databaseServers).values(server).returning();
    return newServer;
  }

  // Database table operations
  async getTablesForServer(serverId: string): Promise<DatabaseTable[]> {
    return await db
      .select()
      .from(databaseTables)
      .where(eq(databaseTables.serverId, serverId))
      .orderBy(asc(databaseTables.tableName));
  }

  async createDatabaseTable(table: InsertDatabaseTable): Promise<DatabaseTable> {
    const [newTable] = await db.insert(databaseTables).values(table).returning();
    return newTable;
  }

  // Query operations
  async getQueries(userId?: string, status?: string): Promise<Query[]> {
    let query = db.select().from(queries);
    
    const conditions = [];
    if (userId) conditions.push(eq(queries.submittedBy, userId));
    if (status) conditions.push(eq(queries.status, status as any));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(queries.createdAt));
  }

  async getQuery(id: string): Promise<Query | undefined> {
    const [query] = await db.select().from(queries).where(eq(queries.id, id));
    return query;
  }

  async createQuery(query: InsertQuery): Promise<Query> {
    const [newQuery] = await db.insert(queries).values(query).returning();
    return newQuery;
  }

  async updateQuery(id: string, updates: Partial<Query>): Promise<Query> {
    const [updatedQuery] = await db
      .update(queries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(queries.id, id))
      .returning();
    return updatedQuery;
  }

  async getQueriesByUser(userId: string): Promise<Query[]> {
    return await db
      .select()
      .from(queries)
      .where(eq(queries.submittedBy, userId))
      .orderBy(desc(queries.createdAt));
  }

  async getQueriesForApproval(approverId: string, approverType: 'team_manager' | 'skip_manager'): Promise<Query[]> {
    const conditions = [];
    
    if (approverType === 'team_manager') {
      conditions.push(
        and(
          eq(queries.teamManagerId, approverId),
          eq(queries.status, 'submitted')
        )
      );
    } else if (approverType === 'skip_manager') {
      conditions.push(
        and(
          eq(queries.skipManagerId, approverId),
          eq(queries.status, 'team_manager_approved')
        )
      );
    }
    
    return await db
      .select()
      .from(queries)
      .where(or(...conditions))
      .orderBy(desc(queries.submittedAt));
  }

  // Approval operations
  async getApprovalsByQuery(queryId: string): Promise<Approval[]> {
    return await db
      .select()
      .from(approvals)
      .where(eq(approvals.queryId, queryId))
      .orderBy(asc(approvals.createdAt));
  }

  async createApproval(approval: InsertApproval): Promise<Approval> {
    const [newApproval] = await db.insert(approvals).values(approval).returning();
    return newApproval;
  }

  async updateApproval(id: string, updates: Partial<Approval>): Promise<Approval> {
    const [updatedApproval] = await db
      .update(approvals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(approvals.id, id))
      .returning();
    return updatedApproval;
  }

  // Query template operations
  async getQueryTemplates(userId?: string): Promise<QueryTemplate[]> {
    let query = db.select().from(queryTemplates);
    
    if (userId) {
      query = query.where(
        or(
          eq(queryTemplates.createdBy, userId),
          eq(queryTemplates.isPublic, true)
        )
      ) as any;
    } else {
      query = query.where(eq(queryTemplates.isPublic, true)) as any;
    }
    
    return await query.orderBy(asc(queryTemplates.name));
  }

  async createQueryTemplate(template: InsertQueryTemplate): Promise<QueryTemplate> {
    const [newTemplate] = await db.insert(queryTemplates).values(template).returning();
    return newTemplate;
  }

  // Role management
  async getUsersByRole(role: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.role, role))
      .orderBy(asc(users.firstName), asc(users.lastName));
  }
}

export const storage = new DatabaseStorage();
