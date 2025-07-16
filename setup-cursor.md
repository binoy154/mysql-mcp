# Cursor MCP Setup Instructions

## Your MySQL MCP Server is Ready! 🎉

The server has been built and tested successfully with your database credentials:
- **Host**: localhost
- **Port**: 3306  
- **User**: root
- **Database**: bistrainer

## Next Steps to Configure Cursor:

### 1. Find Your Cursor MCP Settings File

The location depends on your operating system:

**Windows:**
- `%APPDATA%\Cursor\User\globalStorage\rooveterinaryinc.cursor-mcp\settings.json`
- Or: `C:\Users\[YourUsername]\AppData\Roaming\Cursor\User\globalStorage\rooveterinaryinc.cursor-mcp\settings.json`

**Alternative locations to check:**
- `%APPDATA%\Cursor\User\settings.json`
- Look for any file named `mcp_settings.json` or similar in the Cursor directory

### 2. Add the MCP Server Configuration

Copy this exact configuration into your Cursor MCP settings file:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "node",
      "args": ["E:/mySqlMcp/dist/index.js"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "admin",
        "MYSQL_DATABASE": "bistrainer"
      }
    }
  }
}
```

### 3. Restart Cursor

After adding the configuration:
1. Save the settings file
2. Completely close Cursor
3. Restart Cursor

### 4. Test the Connection

Once Cursor restarts, you should be able to use these MySQL tools in your conversations:

- **`connect_database`** - Connect to your database
- **`list_databases`** - Show all databases
- **`list_tables`** - Show tables in bistrainer database
- **`describe_table`** - Get table schema
- **`select_query`** - Run SELECT queries
- **`insert_data`** - Insert new records
- **`update_data`** - Update existing records
- **`delete_data`** - Delete records

### 5. Example Usage

Try asking Cursor:
- "Show me all tables in the bistrainer database"
- "Describe the structure of the users table"
- "Select the first 10 records from the products table"

## Troubleshooting

If the MCP server doesn't work:

1. **Check MySQL is running**: Make sure your MySQL server is running on localhost:3306
2. **Verify credentials**: Ensure user 'root' with password 'admin' can access the 'bistrainer' database
3. **Check file paths**: Make sure the path `E:/mySqlMcp/dist/index.js` is correct
4. **Cursor logs**: Check Cursor's developer console for any error messages

## Security Note

Your database password is stored in the configuration file. Make sure to:
- Keep your Cursor settings secure
- Consider creating a dedicated MySQL user with limited permissions for MCP access
- Don't share your configuration file with others

---

**Your MySQL MCP Server is now ready to use with Cursor! 🚀** 