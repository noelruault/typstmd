/**
 * Warning collector for unsupported/deferred markdown nodes.
 *
 * Collects warnings during MDAST→Typst transformation. Each warning
 * includes the node type and optional context for UI display.
 */

export interface Warning {
  nodeType: string;
  message: string;
}

export function createWarningCollector() {
  const warnings: Warning[] = [];

  return {
    warn(nodeType: string, message: string) {
      warnings.push({ nodeType, message });
    },

    getWarnings(): readonly Warning[] {
      return warnings;
    },

    clear() {
      warnings.length = 0;
    },
  };
}

export type WarningCollector = ReturnType<typeof createWarningCollector>;
