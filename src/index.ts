import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import mysql from "mysql2/promise";
import { ProductionSecurityFilter } from "./security/productionSecurity.js";

// =============================================================================
// ENVIRONMENT PERMISSION CONFIGURATION
// =============================================================================
// Change these variables to easily control write permissions for each environment
// Set to true to allow write operations, false to make read-only
const ENVIRONMENT_WRITE_PERMISSIONS = {
  local: true,           // Local development - always allow writes
  staging: false,        // Staging - set to false for read-only, true for writes with confirmation
  preproduction: false,  // Pre-production - set to false for read-only, true for writes with confirmation
  production: false,     // Production - should always be false (read-only)
} as const;

// Database connection interface
interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
  multipleStatements?: boolean;
  timezone?: string;
  dateStrings?: boolean;
}

// Environment configuration interfaces and types
enum PermissionLevel {
  FULL_ACCESS = "full",
  READ_ONLY = "read_only",
  STAGING_WITH_CONFIRMATION = "staging_with_confirmation"
}

interface EnvironmentConfig {
  name: string;
  displayName: string;
  connection: DatabaseConfig;
  permissions: PermissionLevel;
  description: string;
  isActive: boolean;
}

interface EnvironmentSettings {
  [key: string]: EnvironmentConfig;
}

// Tool categories for permission filtering
enum ToolCategory {
  READ_ONLY = "read_only",
  WRITE_OPERATION = "write_operation",
  ADMINISTRATIVE = "administrative"
}

interface ToolPermission {
  name: string;
  category: ToolCategory;
  requiresConfirmation?: boolean;
}

class MySQLMCPServer {
  private server: Server;
  private connection: mysql.Connection | null = null;
  private config: DatabaseConfig;
  
  // Environment management properties
  private currentEnvironment: string = "local";
  private environments!: EnvironmentSettings;
  private toolPermissions!: ToolPermission[];
  
  // Production-only security filter
  private securityFilter!: ProductionSecurityFilter;

  constructor() {
    this.server = new Server(
      {
        name: "mysql-mcp-server",
        version: "1.0.0",
      }
    );

    // Initialize environment configurations
    this.initializeEnvironments();
    
    // Initialize tool permissions
    this.initializeToolPermissions();

    // Initialize production-only security filter
    this.securityFilter = new ProductionSecurityFilter(this.currentEnvironment);

    // Default configuration (can be overridden via environment variables or environment switching)
    this.config = this.environments[this.currentEnvironment].connection;

    this.setupToolHandlers();
  }

  private initializeEnvironments(): void {
    this.environments = {
      local: {
        name: "local",
        displayName: "Local Development",
        connection: {
          host: process.env.MYSQL_LOCAL_HOST || process.env.MYSQL_HOST || "localhost",
          port: parseInt(process.env.MYSQL_LOCAL_PORT || process.env.MYSQL_PORT || "3306"),
          user: process.env.MYSQL_LOCAL_USER || process.env.MYSQL_USER || "root",
          password: process.env.MYSQL_LOCAL_PASSWORD || process.env.MYSQL_PASSWORD || "",
          database: process.env.MYSQL_LOCAL_DATABASE || process.env.MYSQL_DATABASE,
          multipleStatements: true,
          timezone: 'local',
          dateStrings: true,
        },
        permissions: ENVIRONMENT_WRITE_PERMISSIONS.local ? PermissionLevel.FULL_ACCESS : PermissionLevel.READ_ONLY,
        description: ENVIRONMENT_WRITE_PERMISSIONS.local ? "Local development database with full access" : "Local development database - READ ONLY access",
        isActive: true
      },
      staging: {
        name: "staging",
        displayName: "Staging Environment",
        connection: {
          host: process.env.MYSQL_STAGING_HOST || "staging-db.example.com",
          port: parseInt(process.env.MYSQL_STAGING_PORT || "3306"),
          user: process.env.MYSQL_STAGING_USER || "staging_user",
          password: process.env.MYSQL_STAGING_PASSWORD || "",
          database: process.env.MYSQL_STAGING_DATABASE,
          multipleStatements: true,
          timezone: 'local',
          dateStrings: true,
        },
        permissions: ENVIRONMENT_WRITE_PERMISSIONS.staging ? PermissionLevel.STAGING_WITH_CONFIRMATION : PermissionLevel.READ_ONLY,
        description: ENVIRONMENT_WRITE_PERMISSIONS.staging ? "Staging database with confirmation for destructive operations" : "Staging database - READ ONLY access",
        isActive: false
      },
      preproduction: {
        name: "preproduction",
        displayName: "Pre-Production Environment",
        connection: {
          host: process.env.MYSQL_PREPRODUCTION_HOST || "preprod-db.example.com",
          port: parseInt(process.env.MYSQL_PREPRODUCTION_PORT || "3306"),
          user: process.env.MYSQL_PREPRODUCTION_USER || "preprod_user",
          password: process.env.MYSQL_PREPRODUCTION_PASSWORD || "",
          database: process.env.MYSQL_PREPRODUCTION_DATABASE,
          multipleStatements: true,
          timezone: 'local',
          dateStrings: true,
        },
        permissions: ENVIRONMENT_WRITE_PERMISSIONS.preproduction ? PermissionLevel.STAGING_WITH_CONFIRMATION : PermissionLevel.READ_ONLY,
        description: ENVIRONMENT_WRITE_PERMISSIONS.preproduction ? "Pre-production database with confirmation for destructive operations" : "Pre-production database - READ ONLY access",
        isActive: false
      },
      production: {
        name: "production",
        displayName: "Production (Read-Only Slave)",
        connection: {
          host: process.env.MYSQL_PRODUCTION_HOST || "slave-db.example.com",
          port: parseInt(process.env.MYSQL_PRODUCTION_PORT || "3306"),
          user: process.env.MYSQL_PRODUCTION_USER || "readonly_user",
          password: process.env.MYSQL_PRODUCTION_PASSWORD || "",
          database: process.env.MYSQL_PRODUCTION_DATABASE,
          multipleStatements: true,
          timezone: 'local',
          dateStrings: true,
        },
        permissions: ENVIRONMENT_WRITE_PERMISSIONS.production ? PermissionLevel.STAGING_WITH_CONFIRMATION : PermissionLevel.READ_ONLY,
        description: ENVIRONMENT_WRITE_PERMISSIONS.production ? "Production database with confirmation for destructive operations" : "Production database - READ ONLY access",
        isActive: false
      }
    };
  }

  private initializeToolPermissions(): void {
    this.toolPermissions = [
      // Read-only operations
      { name: "switch_environment", category: ToolCategory.ADMINISTRATIVE },
      { name: "list_databases", category: ToolCategory.READ_ONLY },
      { name: "use_database", category: ToolCategory.READ_ONLY },
      { name: "list_tables", category: ToolCategory.READ_ONLY },
      { name: "describe_table", category: ToolCategory.READ_ONLY },
      { name: "select_query", category: ToolCategory.READ_ONLY },
      { name: "get_table_indexes", category: ToolCategory.READ_ONLY },
      { name: "get_database_schema", category: ToolCategory.READ_ONLY },
      { name: "analyze_relationships", category: ToolCategory.READ_ONLY },
      { name: "get_table_comments", category: ToolCategory.READ_ONLY },
      
      // Write operations (restricted in production)
      { name: "insert_data", category: ToolCategory.WRITE_OPERATION, requiresConfirmation: true },
      { name: "update_data", category: ToolCategory.WRITE_OPERATION, requiresConfirmation: true },
      { name: "delete_data", category: ToolCategory.WRITE_OPERATION, requiresConfirmation: true },
      { name: "execute_query", category: ToolCategory.WRITE_OPERATION, requiresConfirmation: true },
    ];
  }

  private getCurrentEnvironmentConfig(): EnvironmentConfig {
    return this.environments[this.currentEnvironment];
  }

  private isToolAllowed(toolName: string): boolean {
    const tool = this.toolPermissions.find(t => t.name === toolName);
    if (!tool) return false;

    // Administrative tools are always allowed (e.g., switch_environment)
    if (tool.category === ToolCategory.ADMINISTRATIVE) {
       return true;
    }

    const currentEnvConfig = this.getCurrentEnvironmentConfig();
    
    switch (currentEnvConfig.permissions) {
      case PermissionLevel.READ_ONLY:
        return tool.category === ToolCategory.READ_ONLY;
      case PermissionLevel.STAGING_WITH_CONFIRMATION:
        return true; // All tools allowed, but some may require confirmation later
      case PermissionLevel.FULL_ACCESS:
        return true; // All tools allowed
      default:
        return false;
    }
  }

  private validateEnvironmentConnection(envName: string): void {
    const env = this.environments[envName];
    if (!env) {
      throw new Error(`Environment '${envName}' not found`);
    }
    if (!env.connection.host || !env.connection.user) {
      throw new Error(`Environment '${envName}' is not properly configured`);
    }
  }

  private async ensureConnection(): Promise<mysql.Connection> {
    if (!this.connection) {
      try {
        this.connection = await mysql.createConnection(this.config);
        await this.connection.ping();
      } catch (error) {
        throw new Error(`Failed to connect to MySQL: ${error}`);
      }
    }
    return this.connection;
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools: Tool[] = [
        {
          name: "switch_environment",
          description: "Switch between database environments",
          inputSchema: {
            type: "object",
            properties: {
              environment: { 
                type: "string", 
                description: "The environment to switch to",
                enum: Object.keys(this.environments),
              },
            },
            required: ["environment"],
          },
        },
        {
          name: "list_databases",
          description: "List all available databases",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "use_database",
          description: "Switch to a specific database",
          inputSchema: {
            type: "object",
            properties: {
              database: { type: "string", description: "Database name to use" },
            },
            required: ["database"],
          },
        },
        {
          name: "list_tables",
          description: "List all tables in the current database",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "describe_table",
          description: "Get the schema/structure of a specific table",
          inputSchema: {
            type: "object",
            properties: {
              table: { type: "string", description: "Table name to describe" },
            },
            required: ["table"],
          },
        },
        {
          name: "select_query",
          description: "Execute a SELECT query and return results",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "SELECT SQL query to execute" },
              limit: { type: "number", description: "Limit number of results (default: 100)", default: 100 },
            },
            required: ["query"],
          },
        },
        {
          name: "insert_data",
          description: "Insert data into a table",
          inputSchema: {
            type: "object",
            properties: {
              table: { type: "string", description: "Table name" },
              data: { 
                type: "object", 
                description: "Data to insert as key-value pairs",
                additionalProperties: true
              },
              confirm: { type: "boolean", description: "Set to true to confirm execution in staging" },
            },
            required: ["table", "data"],
          },
        },
        {
          name: "update_data",
          description: "Update data in a table",
          inputSchema: {
            type: "object",
            properties: {
              table: { type: "string", description: "Table name" },
              data: { 
                type: "object", 
                description: "Data to update as key-value pairs",
                additionalProperties: true
              },
              where: { type: "string", description: "WHERE clause condition" },
              confirm: { type: "boolean", description: "Set to true to confirm execution in staging" },
            },
            required: ["table", "data", "where"],
          },
        },
        {
          name: "delete_data",
          description: "Delete data from a table",
          inputSchema: {
            type: "object",
            properties: {
              table: { type: "string", description: "Table name" },
              where: { type: "string", description: "WHERE clause condition" },
              confirm: { type: "boolean", description: "Set to true to confirm execution in staging" },
            },
            required: ["table", "where"],
          },
        },
        {
          name: "execute_query",
          description: "Execute any SQL query (USE WITH CAUTION)",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "SQL query to execute" },
              confirm: { type: "boolean", description: "Set to true to confirm execution in staging" },
            },
            required: ["query"],
          },
        },
        {
          name: "get_table_indexes",
          description: "Get all indexes for a specific table",
          inputSchema: {
            type: "object",
            properties: {
              table: { type: "string", description: "Table name" },
            },
            required: ["table"],
          },
        },
        {
          name: "get_database_schema",
          description: "DISABLED - This tool is disabled for large databases to prevent crashes",
          inputSchema: {
            type: "object",
            properties: {
              include_comments: { type: "boolean", description: "This tool is disabled", default: false },
              include_sample_data: { type: "boolean", description: "This tool is disabled", default: false },
            },
          },
        },
        {
          name: "analyze_relationships",
          description: "DISABLED - This tool is disabled for large databases to prevent crashes",
          inputSchema: {
            type: "object",
            properties: {
              confidence_threshold: { type: "number", description: "This tool is disabled", default: 0.7 },
            },
          },
        },
        {
          name: "get_table_comments",
          description: "Get table comment and all column comments for a specific table",
          inputSchema: {
            type: "object",
            properties: {
              table: { type: "string", description: "Table name to get comments for" },
            },
            required: ["table"],
          },
        },
      ];

      const allowedTools = allTools.filter(tool => this.isToolAllowed(tool.name));
        
      return {
        tools: allowedTools,
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Permission check already done, now handle confirmation logic for staging
        const toolPerm = this.toolPermissions.find(t => t.name === name);
        const currentEnv = this.getCurrentEnvironmentConfig();

        if (
          currentEnv.permissions === PermissionLevel.STAGING_WITH_CONFIRMATION &&
          toolPerm?.requiresConfirmation
        ) {
          if (!(args as any)?.confirm) {
            return {
              confirmation_required: true,
              message: `Tool '${name}' can modify data. Re-run with the argument { "confirm": true } to proceed.`
            };
          }
        }

        if (!this.isToolAllowed(name)) {
          return {
            error: `Tool '${name}' is not allowed in the current environment (${this.getCurrentEnvironmentConfig().displayName}).`
          };
        }
        switch (name) {
          case "switch_environment":
            return await this.switchEnvironment((args as any)?.environment);
            
          case "list_databases":
            return await this.listDatabases();
            
          case "use_database":
            return await this.useDatabase((args as any)?.database);
            
          case "list_tables":
            return await this.listTables();
            
          case "describe_table":
            return await this.describeTable((args as any)?.table);
            
          case "select_query":
            return await this.selectQuery((args as any)?.query, (args as any)?.limit);
            
          case "insert_data":
            return await this.insertData((args as any)?.table, (args as any)?.data);
            
          case "update_data":
            return await this.updateData((args as any)?.table, (args as any)?.data, (args as any)?.where);
            
          case "delete_data":
            return await this.deleteData((args as any)?.table, (args as any)?.where);
            
          case "execute_query":
            return await this.executeQuery((args as any)?.query);
            
          case "get_table_indexes":
            return await this.getTableIndexes((args as any)?.table);
            
          case "get_database_schema":
            return await this.getDisabledToolResponse("get_database_schema");
            
          case "analyze_relationships":
            return await this.getDisabledToolResponse("analyze_relationships");
            
          case "get_table_comments":
            return await this.getTableComments((args as any)?.table);
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }



  private async listDatabases() {
    const connection = await this.ensureConnection();
    const [rows] = await connection.execute("SHOW DATABASES");
    
    return {
      content: [
        {
          type: "text",
          text: `Available databases:\n${(rows as any[]).map(row => `- ${row.Database}`).join('\n')}`,
        },
      ],
    };
  }

  private async useDatabase(database: string) {
    const connection = await this.ensureConnection();
    await connection.execute(`USE \`${database}\``);
    this.config.database = database;
    
    return {
      content: [
        {
          type: "text",
          text: `Now using database: ${database}`,
        },
      ],
    };
  }

  private async listTables() {
    const connection = await this.ensureConnection();
    const [rows] = await connection.execute("SHOW TABLES");
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No tables found in the current database.",
          },
        ],
      };
    }

    const tableNames = (rows as any[]).map(row => Object.values(row)[0]);
    
    // Safety limit for large databases
    if (tableNames.length > 100) {
      const limitedTables = tableNames.slice(0, 100);
      return {
        content: [
          {
            type: "text",
            text: `⚠️ Large database detected (${tableNames.length} tables). Showing first 100 tables:\n\n${limitedTables.map(name => `- ${name}`).join('\n')}\n\n... and ${tableNames.length - 100} more tables.\n\nUse SELECT queries to find specific tables: SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'pattern%'`,
          },
        ],
      };
    }
    
    return {
      content: [
        {
          type: "text",
          text: `Tables in database (${tableNames.length} total):\n${tableNames.map(name => `- ${name}`).join('\n')}`,
        },
      ],
    };
  }

  private async describeTable(table: string) {
    const connection = await this.ensureConnection();
    const [rows] = await connection.execute(`DESCRIBE \`${table}\``);
    
    const schema = (rows as any[]).map(row => ({
      Field: row.Field,
      Type: row.Type,
      Null: row.Null,
      Key: row.Key,
      Default: row.Default,
      Extra: row.Extra,
    }));

    // Apply production-only security filtering to schema
    const filteredSchema = this.securityFilter.filterTableSchema(schema);
    const sensitiveColumns = schema.filter(col => this.securityFilter.isSensitiveColumn(col.Field));
    
    const securityNote = this.currentEnvironment === 'production' && sensitiveColumns.length > 0
      ? `\n\n⚠️ Note: ${sensitiveColumns.length} sensitive column(s) masked for security in production environment.`
      : '';

    return {
      content: [
        {
          type: "text",
          text: `Schema for table '${table}':\n${JSON.stringify(filteredSchema, null, 2)}${securityNote}`,
        },
      ],
    };
  }

  private async selectQuery(query: string, limit: number = 100) {
    const connection = await this.ensureConnection();
    
    // Add LIMIT if not present and it's a single SELECT query
    let finalQuery = query.trim();
    if (finalQuery.toLowerCase().startsWith('select') && !finalQuery.toLowerCase().includes('limit') && !finalQuery.includes(';')) {
      finalQuery += ` LIMIT ${limit}`;
    }
    
    const [rows] = await connection.query(finalQuery);
    
    // Apply production-only security filtering
    const filteredResults = this.securityFilter.filterResults(rows as any[]);
    const sensitiveDataAccessed = this.securityFilter.wouldAccessSensitiveData(finalQuery);
    
    const securityNote = this.currentEnvironment === 'production' && sensitiveDataAccessed
      ? '\n\n⚠️ Note: Sensitive data has been masked for security in production environment.'
      : '';
    
    return {
      content: [
        {
          type: "text",
          text: `Query results:\n${JSON.stringify(filteredResults, null, 2)}${securityNote}`,
        },
      ],
    };
  }

  private async insertData(table: string, data: any) {
    // Explicit production protection
    this.throwIfProduction('INSERT');
    
    const connection = await this.ensureConnection();
    
    const columns = Object.keys(data).map(col => `\`${col}\``).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    
    const query = `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`;
    const [result] = await connection.execute(query, values);
    
    return {
      content: [
        {
          type: "text",
          text: `Successfully inserted data into '${table}'. Insert ID: ${(result as any).insertId}, Affected rows: ${(result as any).affectedRows}`,
        },
      ],
    };
  }

  private async updateData(table: string, data: any, where: string) {
    // Explicit production protection
    this.throwIfProduction('UPDATE');
    
    const connection = await this.ensureConnection();
    
    const setClause = Object.keys(data).map(col => `\`${col}\` = ?`).join(', ');
    const values = Object.values(data);
    
    const query = `UPDATE \`${table}\` SET ${setClause} WHERE ${where}`;
    const [result] = await connection.execute(query, values);
    
    return {
      content: [
        {
          type: "text",
          text: `Successfully updated '${table}'. Affected rows: ${(result as any).affectedRows}`,
        },
      ],
    };
  }

  private async deleteData(table: string, where: string) {
    // Explicit production protection
    this.throwIfProduction('DELETE');
    
    const connection = await this.ensureConnection();
    
    const query = `DELETE FROM \`${table}\` WHERE ${where}`;
    const [result] = await connection.execute(query);
    
    return {
      content: [
        {
          type: "text",
          text: `Successfully deleted from '${table}'. Affected rows: ${(result as any).affectedRows}`,
        },
      ],
    };
  }

  private async executeQuery(query: string) {
    // Explicit production protection for any query execution
    if (this.isProductionEnvironment()) {
      // In production, check if it's a write operation
      if (this.isWriteOperation(query)) {
        throw new Error(`🚫 PRODUCTION PROTECTION: Write operations (${query.trim().split(' ')[0].toUpperCase()}) are strictly prohibited in production environment. Current environment: ${this.getCurrentEnvironmentConfig().displayName}`);
      }
      
      // Even for read operations, warn about execute_query usage in production
      console.warn(`⚠️ WARNING: Using execute_query in production environment. Consider using specific read-only tools instead.`);
    }
    
    const connection = await this.ensureConnection();
    const [result] = await connection.query(query);
    
    return {
      content: [
        {
          type: "text",
          text: `Query executed successfully:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }

  private async getTableIndexes(table: string) {
    const connection = await this.ensureConnection();
    const [rows] = await connection.execute(`SHOW INDEX FROM \`${table}\``);
    
    return {
      content: [
        {
          type: "text",
          text: `Indexes for table '${table}':\n${JSON.stringify(rows, null, 2)}`,
        },
      ],
    };
  }



  private async getDisabledToolResponse(toolName: string) {
    return {
      content: [
        {
          type: "text",
          text: `⚠️ TOOL DISABLED: ${toolName} is disabled for large databases to prevent crashes.\n\nThis database has 1000+ tables. Use individual table tools instead:\n- describe_table: Get schema for one table\n- get_table_indexes: Get indexes for one table\n- get_foreign_keys: Get foreign keys for one table\n- select_query: Query specific data with limits`,
        },
      ],
    };
  }

  private async getTableComments(table: string) {
    const connection = await this.ensureConnection();
    const query = `
      SELECT 
        TABLE_COMMENT as table_comment,
        COLUMN_NAME,
        COLUMN_COMMENT
      FROM 
        INFORMATION_SCHEMA.COLUMNS 
      WHERE 
        TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `;
    
    const [rows] = await connection.execute(query, [table]);
    
    return {
      content: [
        {
          type: "text",
          text: `Comments for table '${table}':\n${JSON.stringify(rows, null, 2)}`,
        },
      ],
    };
  }

  private async switchEnvironment(envName: string): Promise<any> {
    this.validateEnvironmentConnection(envName);

    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }

    // Reset all isActive flags
    for (const key in this.environments) {
        this.environments[key].isActive = false;
    }
    
    this.currentEnvironment = envName;
    this.config = this.environments[envName].connection;
    this.environments[envName].isActive = true;

    // Update security filter for new environment
    this.securityFilter = new ProductionSecurityFilter(this.currentEnvironment);

    // Ping the new connection to ensure it's alive
    await this.ensureConnection();

    const currentEnv = this.getCurrentEnvironmentConfig();
    const securityStatus = this.securityFilter.getSecurityStatus();
    
    return {
      content: [
        {
          type: "text",
          text: `✅ Switched to ${currentEnv.displayName} environment (host: ${currentEnv.connection.host}).\n${securityStatus}`,
        },
      ],
      environment: currentEnv,
    };
  }

  private isProductionEnvironment(): boolean {
    // Consider any environment with READ_ONLY permissions as production-like for protection
    return this.getCurrentEnvironmentConfig().permissions === PermissionLevel.READ_ONLY;
  }

  private throwIfProduction(operation: string): void {
    if (this.isProductionEnvironment()) {
      throw new Error(`🚫 PRODUCTION PROTECTION: ${operation} operations are strictly prohibited in production environment. Current environment: ${this.getCurrentEnvironmentConfig().displayName}`);
    }
  }

  private isWriteOperation(query: string): boolean {
    const trimmedQuery = query.trim().toLowerCase();
    const writeOperations = ['insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate', 'replace'];
    return writeOperations.some(op => trimmedQuery.startsWith(op));
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("MySQL MCP server running on stdio");
  }

  async cleanup() {
    if (this.connection) {
      await this.connection.end();
    }
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.error("Shutting down MySQL MCP server...");
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error("Shutting down MySQL MCP server...");
  process.exit(0);
});

// Start the server
const server = new MySQLMCPServer();
server.run().catch(console.error); 