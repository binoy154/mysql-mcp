# MySQL MCP Server

A comprehensive MySQL Model Context Protocol (MCP) server that provides database operations for Cursor IDE.

## Features

- ✅ **Connection Management**: Connect to any MySQL database
- ✅ **Schema Operations**: List databases, tables, describe table structures
- ✅ **Data Operations**: SELECT, INSERT, UPDATE, DELETE operations
- ✅ **Advanced Features**: View indexes, foreign keys, execute custom queries
- ✅ **Safety**: Built-in query limits and error handling

## Prerequisites

Before setting up this MySQL MCP server, ensure you have:

1. **Node.js** (v16 or higher) - Required to run the MCP server
2. **MySQL Database** - Either local or remote MySQL server access
3. **Cursor IDE** - For MCP integration

> **📁 Repository Note:** This repository follows Node.js best practices by excluding `node_modules/` and `dist/` folders. You'll generate these locally after cloning.

## Quick Setup

### 🚀 First Time Setup (After Cloning)

**Important:** This repository does not include `node_modules/` or `dist/` folders to keep it lightweight. You'll need to generate them:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/binoy154/mysql-mcp.git
   cd mysql-mcp
   ```
   
   **⚠️ Important Path Considerations:**
   - **Note the absolute path** where you clone this repository (e.g., `C:/Projects/mysql-mcp` or `E:/mysql-mcp`)
   - You'll need this **exact path** for Cursor MCP configuration later
   - The built files will be at `YOUR_PATH/dist/index.js`

2. **Install dependencies:**
   ```bash
   npm install
   ```
   *This will create the `node_modules/` folder with all required packages.*

3. **Build the project:**
   ```bash
   npm run build
   ```
   *This will create the `dist/` folder with compiled JavaScript files.*

4. **Set up environment variables (optional):**
   ```bash
   cp .env.example .env
   # Edit .env with your MySQL credentials
   ```
   *Note: You can also configure credentials directly in Cursor MCP settings.*

5. **Configure Cursor MCP:**
   
   **🔧 IMPORTANT: Update the file path below with your actual clone location!**
   
   A single MCP server instance can switch between **local**, **staging** and **production** environments at runtime. Supply their credentials through environment variables:

   ```json
   {
     "mcpServers": {
       "mysql": {
         "command": "node",
         "args": ["YOUR_ABSOLUTE_PATH/mysql-mcp/dist/index.js"],
         "env": {
           "MYSQL_LOCAL_HOST": "localhost",
           "MYSQL_LOCAL_PORT": "3306",
           "MYSQL_LOCAL_USER": "root",
           "MYSQL_LOCAL_PASSWORD": "localPassword",
           "MYSQL_LOCAL_DATABASE": "localDatabase",

           "MYSQL_STAGING_HOST": "staging.db.example.com",
           "MYSQL_STAGING_PORT": "3306",
           "MYSQL_STAGING_USER": "staging_user",
           "MYSQL_STAGING_PASSWORD": "staging_pw",
           "MYSQL_STAGING_DATABASE": "staging_db",

           "MYSQL_PREPRODUCTION_HOST": "preprod-db.example.com",
           "MYSQL_PREPRODUCTION_PORT": "3306",
           "MYSQL_PREPRODUCTION_USER": "preprod_user",
           "MYSQL_PREPRODUCTION_PASSWORD": "preprod_pw",
           "MYSQL_PREPRODUCTION_DATABASE": "preprod_db"
         }
       }
     }
   }
   ```
   
   **📝 Path Examples - Replace `YOUR_ABSOLUTE_PATH/mysql-mcp` with:**
   - Windows: `"C:/Projects/mysql-mcp/dist/index.js"`
   - Windows (E drive): `"E:/mysql-mcp/dist/index.js"`
   - Mac/Linux: `"/home/username/mysql-mcp/dist/index.js"`
   
   **⚠️ Critical:** Use forward slashes (`/`) even on Windows, and ensure the path points to where you actually cloned the repository.

   **Why a slave?**  The production credentials should point to a *read-only slave* or replica to guarantee safety (the server enforces read-only at the code level too).

## Available Tools

### Connection Tools
- **`connect_database`**: Connect with custom credentials
- **`list_databases`**: Show all available databases
- **`use_database`**: Switch to a specific database
- **`switch_environment`**: Switch the active DB environment (`local`, `staging`, `production`)

### Schema Tools
- **`list_tables`**: List all tables in current database
- **`describe_table`**: Get detailed table schema
- **`get_table_indexes`**: View table indexes
- **`get_foreign_keys`**: View foreign key relationships

### Data Operations
- **`select_query`**: Execute SELECT queries with automatic LIMIT
- **`insert_data`**: Insert new records
- **`update_data`**: Update existing records
- **`delete_data`**: Delete records
- **`execute_query`**: Execute any SQL query (use carefully)

**Write operations & confirmation logic**

| Tool | Local | Staging | Production |
|------|-------|---------|------------|
| `insert_data`, `update_data`, `delete_data`, `execute_query` | Immediate | Requires `{ "confirm": true }` flag | **Blocked** |

Example (staging):

```json
{
  "name": "update_data",
  "arguments": {
    "table": "users",
    "data": { "status": "active" },
    "where": "id = 42",
    "confirm": true
  }
}
```

## Usage Examples

### Connect to Database
```
Use the connect_database tool with:
- host: localhost
- port: 3306
- user: myuser
- password: mypassword
- database: myapp_db
```

### Query Data
```
Use select_query with query: "SELECT * FROM users WHERE active = 1"
```

### Insert Data
```
Use insert_data with:
- table: "users"
- data: {"name": "John Doe", "email": "john@example.com"}
```

## Security Notes

1. Store database credentials securely using environment variables
2. SELECT queries automatically include LIMIT 100 unless specified
3. The server uses parameterized queries for data operations
4. Ensure your MySQL user has appropriate permissions

## Deployment to Another Computer

### ❌ What Won't Work
Simply copying the project folder to another computer **will not work** without proper setup.

### ✅ Required Steps for New Installation

1. **Install Prerequisites:**
   - Node.js (v16 or higher)
   - Access to a MySQL database

2. **Clone or Copy Project Files:**
   ```bash
   git clone https://github.com/binoy154/mysql-mcp.git
   cd mysql-mcp
   ```
   - Note the absolute path where you cloned/copied the project
   - You'll need this exact path for Cursor MCP configuration

3. **Install Dependencies:**
   ```bash
   npm install
   ```

4. **Build the Project:**
   ```bash
   npm run build
   ```

5. **Update Cursor Configuration:**
   - Update the file path in your Cursor MCP settings to match the new location
   - Example: Change `"E:/mySqlMcp/dist/index.js"` to the correct path on the new computer

6. **Configure Database Credentials:**
   - Update environment variables or Cursor MCP configuration with the correct database connection details for the new environment

### 📁 What's Included vs. What You Need to Build

**✅ Included in this repository:**
- Source code (`src/` folder)
- Configuration files (`package.json`, `tsconfig.json`, `README.md`)
- Documentation files
- `.gitignore` (protects against accidentally committing large folders)

**🔨 What you need to build after cloning:**
- `node_modules/` folder → Run `npm install`
- `dist/` folder → Run `npm run build`

**⚙️ What you need to customize:**
- Database credentials (host, port, username, password)
- File paths in Cursor MCP configuration
- Environment-specific settings

**💡 Why this approach?**
- Keeps repository lightweight (MB instead of GB)
- Avoids platform-specific dependency issues
- Follows Node.js best practices

## Troubleshooting

### Setup Issues
- **"Cannot find module" errors**: Run `npm install` to install dependencies
- **"Cannot find dist/index.js"**: Run `npm run build` to compile TypeScript
- **Missing `node_modules/` folder**: This is normal! Run `npm install` to create it
- **Missing `dist/` folder**: This is normal! Run `npm run build` to create it

### Connection Issues
- Verify MySQL server is running
- Check host, port, username, and password
- Ensure user has necessary database permissions

### Permission Errors
Grant appropriate MySQL privileges:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON your_database.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

### Deployment Issues
- Ensure Node.js is installed on the target computer
- Verify the file path in Cursor MCP configuration is correct
- Check that `npm install` and `npm run build` completed successfully
- Confirm database connectivity from the new computer 