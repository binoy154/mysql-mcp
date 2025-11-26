// =============================================================================
// PRODUCTION-ONLY SECURITY MODULE
// =============================================================================
// This module only activates when environment is 'production'
// All other environments (local/staging/preproduction) are unchanged

// Sensitive column patterns to filter in production only
const PRODUCTION_SENSITIVE_PATTERNS = [
  // PII Data
  /(sin|ssn|social_insurance|social_security)/i,
  /(birth.*date|date.*birth|dob)/i,  // Catches fldBirthDate, birth_date, dateOfBirth, etc.
  /(credit.*card|card.*number|cc_number)/i,
  /(passport|driver.*license|license.*number)/i,
  
  // Personal Information  
  /(personal.*phone|home.*phone|mobile.*phone|phone)/i,
  /(personal.*address|home.*address|address)/i,
  /(medical.*record|health.*record)/i,
  
  // Financial Data
  /(bank.*account|account.*number|routing.*number)/i,
  /(salary|wage|income)/i,
  
  // Authentication Data
  /(password|pwd|secret|token|api.*key)/i,
  /(private.*key|certificate)/i,
];

// Simple data masking functions
class ProductionDataMasker {
  static maskEmail(email: string): string {
    if (!email || typeof email !== 'string' || !email.includes('@')) return email;
    const [username, domain] = email.split('@');
    return `${username.substring(0, 2)}***@${domain}`;
  }

  static maskPhone(phone: string): string {
    if (!phone || typeof phone !== 'string') return phone;
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      return `${digits.substring(0, 3)}-***-${digits.substring(digits.length - 4)}`;
    }
    return '***-***-****';
  }

  static maskGeneric(value: any): string {
    if (value === null || value === undefined) return value;
    return '*****';  // Simple constant masking - no data leakage
  }

  static maskSensitiveValue(columnName: string, value: any): any {
    if (value === null || value === undefined) return value;
    
    const strValue = String(value);
    
    if (/email/i.test(columnName)) {
      return this.maskEmail(strValue);
    }
    if (/phone/i.test(columnName)) {
      return this.maskPhone(strValue);
    }
    
    return this.maskGeneric(strValue);
  }
}

export class ProductionSecurityFilter {
  private isProduction: boolean;

  constructor(environment: string) {
    this.isProduction = environment.toLowerCase() === 'production';
  }

  // Only filter if in production environment
  isSensitiveColumn(columnName: string): boolean {
    if (!this.isProduction) return false; // No filtering for non-production
    
    return PRODUCTION_SENSITIVE_PATTERNS.some(pattern => 
      pattern.test(columnName)
    );
  }

  // Filter query results - only in production
  filterResults(results: any[]): any[] {
    if (!this.isProduction || !Array.isArray(results)) {
      return results; // No filtering for non-production
    }

    return results.map(row => {
      if (typeof row !== 'object' || row === null) return row;

      const filteredRow: any = {};
      
      for (const [key, value] of Object.entries(row)) {
        if (this.isSensitiveColumn(key)) {
          // Mask instead of removing - keeps context for LLM
          filteredRow[key] = ProductionDataMasker.maskSensitiveValue(key, value);
        } else {
          filteredRow[key] = value;
        }
      }

      return filteredRow;
    });
  }

  // Filter table schema - only in production
  filterTableSchema(schema: any[]): any[] {
    if (!this.isProduction) return schema; // No filtering for non-production
    
    return schema.map(column => {
      if (this.isSensitiveColumn(column.Field)) {
        return {
          ...column,
          Type: '[SENSITIVE - MASKED IN PRODUCTION]',
          IsSensitive: true
        };
      }
      return column;
    });
  }



  // Check if query would access sensitive data - only in production
  wouldAccessSensitiveData(query: string): boolean {
    if (!this.isProduction) return false;
    
    const queryLower = query.toLowerCase();
    return PRODUCTION_SENSITIVE_PATTERNS.some(pattern => 
      pattern.test(queryLower)
    );
  }

  // Get security status message
  getSecurityStatus(): string {
    if (this.isProduction) {
      return '🔒 PRODUCTION MODE: Sensitive data protection active';
    }
    return '🔓 DEVELOPMENT MODE: No data filtering (full access)';
  }
}

// Export for use in main index.ts
export { ProductionDataMasker };

