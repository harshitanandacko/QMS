import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default('user'), // 'user', 'team_manager', 'skip_manager'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Database servers
export const databaseServers = pgTable("database_servers", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  host: varchar("host").notNull(),
  port: varchar("port").notNull(),
  version: varchar("version").notNull(), // '10g' or '19c'
  type: varchar("type").notNull(), // 'production', 'test', 'reporting', 'audit'
  status: varchar("status").notNull().default('online'), // 'online', 'offline', 'maintenance'
  createdAt: timestamp("created_at").defaultNow(),
});

// Database tables for each server
export const databaseTables = pgTable("database_tables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverId: varchar("server_id").notNull().references(() => databaseServers.id),
  tableName: varchar("table_name").notNull(),
  schema: varchar("schema"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Query status enum
export const queryStatusEnum = pgEnum("query_status", [
  'draft',
  'submitted',
  'team_manager_approved',
  'skip_manager_approved',
  'approved',
  'rejected',
  'executed',
  'failed',
  'rolled_back'
]);

// Query types enum
export const queryTypeEnum = pgEnum("query_type", [
  'select',
  'insert',
  'update',
  'delete',
  'ddl'
]);

// Queries
export const queries = pgTable("queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  sqlQuery: text("sql_query").notNull(),
  queryType: queryTypeEnum("query_type").notNull(),
  parameters: jsonb("parameters"), // Array of parameter definitions
  serverId: varchar("server_id").notNull().references(() => databaseServers.id),
  tableId: varchar("table_id").references(() => databaseTables.id),
  status: queryStatusEnum("status").notNull().default('draft'),
  submittedBy: varchar("submitted_by").notNull().references(() => users.id),
  teamManagerId: varchar("team_manager_id").references(() => users.id),
  skipManagerId: varchar("skip_manager_id").references(() => users.id),
  estimatedExecutionTime: varchar("estimated_execution_time"),
  actualExecutionTime: varchar("actual_execution_time"),
  rowsAffected: varchar("rows_affected"),
  isDryRun: boolean("is_dry_run").default(false),
  canRollback: boolean("can_rollback").default(true),
  autoRollbackEnabled: boolean("auto_rollback_enabled").default(false),
  executionResults: jsonb("execution_results"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  submittedAt: timestamp("submitted_at"),
  executedAt: timestamp("executed_at"),
});

// Approvals
export const approvals = pgTable("approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  queryId: varchar("query_id").notNull().references(() => queries.id),
  approverType: varchar("approver_type").notNull(), // 'team_manager' or 'skip_manager'
  approverId: varchar("approver_id").notNull().references(() => users.id),
  status: varchar("status").notNull(), // 'pending', 'approved', 'rejected'
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Query templates
export const queryTemplates = pgTable("query_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  sqlTemplate: text("sql_template").notNull(),
  category: varchar("category"),
  parameters: jsonb("parameters"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  submittedQueries: many(queries, { relationName: "submittedBy" }),
  teamManagerQueries: many(queries, { relationName: "teamManagerQueries" }),
  skipManagerQueries: many(queries, { relationName: "skipManagerQueries" }),
  approvals: many(approvals),
  queryTemplates: many(queryTemplates),
}));

export const databaseServersRelations = relations(databaseServers, ({ many }) => ({
  tables: many(databaseTables),
  queries: many(queries),
}));

export const databaseTablesRelations = relations(databaseTables, ({ one, many }) => ({
  server: one(databaseServers, {
    fields: [databaseTables.serverId],
    references: [databaseServers.id],
  }),
  queries: many(queries),
}));

export const queriesRelations = relations(queries, ({ one, many }) => ({
  submittedByUser: one(users, {
    fields: [queries.submittedBy],
    references: [users.id],
    relationName: "submittedBy",
  }),
  teamManager: one(users, {
    fields: [queries.teamManagerId],
    references: [users.id],
    relationName: "teamManagerQueries",
  }),
  skipManager: one(users, {
    fields: [queries.skipManagerId],
    references: [users.id],
    relationName: "skipManagerQueries",
  }),
  server: one(databaseServers, {
    fields: [queries.serverId],
    references: [databaseServers.id],
  }),
  table: one(databaseTables, {
    fields: [queries.tableId],
    references: [databaseTables.id],
  }),
  approvals: many(approvals),
}));

export const approvalsRelations = relations(approvals, ({ one }) => ({
  query: one(queries, {
    fields: [approvals.queryId],
    references: [queries.id],
  }),
  approver: one(users, {
    fields: [approvals.approverId],
    references: [users.id],
  }),
}));

export const queryTemplatesRelations = relations(queryTemplates, ({ one }) => ({
  createdByUser: one(users, {
    fields: [queryTemplates.createdBy],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
});

export const insertDatabaseServerSchema = createInsertSchema(databaseServers).omit({
  createdAt: true,
});

export const insertDatabaseTableSchema = createInsertSchema(databaseTables).omit({
  id: true,
  createdAt: true,
});

export const insertQuerySchema = createInsertSchema(queries).omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  executedAt: true,
});

export const insertApprovalSchema = createInsertSchema(approvals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQueryTemplateSchema = createInsertSchema(queryTemplates).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type DatabaseServer = typeof databaseServers.$inferSelect;
export type DatabaseTable = typeof databaseTables.$inferSelect;
export type Query = typeof queries.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type QueryTemplate = typeof queryTemplates.$inferSelect;
export type InsertDatabaseServer = z.infer<typeof insertDatabaseServerSchema>;
export type InsertDatabaseTable = z.infer<typeof insertDatabaseTableSchema>;
export type InsertQuery = z.infer<typeof insertQuerySchema>;
export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type InsertQueryTemplate = z.infer<typeof insertQueryTemplateSchema>;
