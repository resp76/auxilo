import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  timezone: text("timezone").notNull().default("America/New_York"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [uniqueIndex("idx_users_email").on(table.email)]);

export const spaces = sqliteTable("spaces", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("violet"),
  position: integer("position").notNull().default(0),
}, (table) => [index("idx_spaces_owner_position").on(table.ownerId, table.position)]);

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  spaceId: text("space_id").references(() => spaces.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  progress: integer("progress").notNull().default(0),
  dueAt: integer("due_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("idx_projects_owner_status").on(table.ownerId, table.status)]);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  spaceId: text("space_id").references(() => spaces.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("open"),
  priority: integer("priority").notNull().default(0),
  dueAt: integer("due_at", { mode: "timestamp" }),
  reminderAt: integer("reminder_at", { mode: "timestamp" }),
  source: text("source").notNull().default("relay"),
  sourceId: text("source_id"),
  sourceUrl: text("source_url"),
  sourceRevision: text("source_revision"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  index("idx_tasks_owner_status_due").on(table.ownerId, table.status, table.dueAt),
  uniqueIndex("idx_tasks_source_identity").on(table.ownerId, table.source, table.sourceId),
]);

export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  externalAccountId: text("external_account_id").notNull(),
  displayLabel: text("display_label"),
  status: text("status").notNull().default("active"),
  cursor: text("cursor"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => [uniqueIndex("idx_integrations_account").on(table.ownerId, table.provider, table.externalAccountId)]);

export const syncEvents = sqliteTable("sync_events", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  integrationId: text("integration_id").notNull().references(() => integrations.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  direction: text("direction").notNull(),
  action: text("action").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("idx_sync_events_owner_time").on(table.ownerId, table.occurredAt)]);
