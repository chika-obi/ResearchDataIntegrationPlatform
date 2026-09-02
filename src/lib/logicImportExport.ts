import { Question, QuestionLogicRule, SurveyLogicFlowExport, LogicDefinitionItem, LogicImportResult } from '../types';

/**
 * Builds the exportable JSON object for the questionnaire's logic flow.
 */
export function buildLogicFlowExportData(
  questions: Question[],
  surveyTitle: string = 'Questionnaire'
): SurveyLogicFlowExport {
  const logicDefinitions: LogicDefinitionItem[] = [];

  questions.forEach((q) => {
    if (q.logicRule && q.logicRule.enabled && q.logicRule.branches && q.logicRule.branches.length > 0) {
      logicDefinitions.push({
        questionId: q.id,
        questionNumber: q.number,
        variableName: q.variableName,
        questionTitle: q.title,
        logicRule: JSON.parse(JSON.stringify(q.logicRule))
      });
    }
  });

  return {
    schemaType: 'rdip_questionnaire_logic_flow',
    formatVersion: '1.0',
    exportDate: new Date().toISOString(),
    surveyTitle,
    surveyVersion: '2026.1',
    description: `Exported branching logic rules and IF-THEN-ELSE execution graph for ${surveyTitle}`,
    rulesCount: logicDefinitions.length,
    logicDefinitions
  };
}

/**
 * Triggers a browser download of the logic flow JSON configuration file.
 */
export function downloadLogicFlowJSON(
  questions: Question[],
  surveyTitle: string = 'Questionnaire'
): void {
  const exportData = buildLogicFlowExportData(questions, surveyTitle);
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const sanitizedTitle = surveyTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'survey';
  const fileName = `${sanitizedTitle}-logic-flow-${new Date().toISOString().slice(0, 10)}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validates and parses JSON text or parsed object for logic flow definition schema.
 */
export function validateLogicFlowJSON(rawInput: string | any): {
  valid: boolean;
  data?: SurveyLogicFlowExport;
  error?: string;
} {
  let parsed: any;
  try {
    if (typeof rawInput === 'string') {
      parsed = JSON.parse(rawInput);
    } else {
      parsed = rawInput;
    }
  } catch (err: any) {
    return {
      valid: false,
      error: `Invalid JSON syntax: ${err.message || 'Unable to parse JSON file'}`
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'JSON root must be an object.' };
  }

  // Handle standard logic flow package
  if (Array.isArray(parsed.logicDefinitions)) {
    // Validate each definition
    for (let i = 0; i < parsed.logicDefinitions.length; i++) {
      const item = parsed.logicDefinitions[i];
      if (!item.variableName && !item.questionId) {
        return {
          valid: false,
          error: `Logic definition item at index [${i}] is missing 'variableName' or 'questionId'.`
        };
      }
      if (!item.logicRule || typeof item.logicRule !== 'object') {
        return {
          valid: false,
          error: `Logic definition for item ${item.variableName || item.questionId} is missing a valid 'logicRule' object.`
        };
      }
    }

    return {
      valid: true,
      data: {
        schemaType: 'rdip_questionnaire_logic_flow',
        formatVersion: parsed.formatVersion || '1.0',
        exportDate: parsed.exportDate || new Date().toISOString(),
        surveyTitle: parsed.surveyTitle || 'Imported Logic Flow',
        surveyVersion: parsed.surveyVersion,
        description: parsed.description,
        rulesCount: parsed.logicDefinitions.length,
        logicDefinitions: parsed.logicDefinitions
      }
    };
  }

  // Also support full questionnaire array if user imports a full questionnaire export
  if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0].variableName || parsed[0].id)) {
    const extractedDefinitions: LogicDefinitionItem[] = [];
    parsed.forEach((q: any) => {
      if (q.logicRule && q.logicRule.branches) {
        extractedDefinitions.push({
          questionId: q.id,
          questionNumber: q.number,
          variableName: q.variableName,
          questionTitle: q.title,
          logicRule: q.logicRule
        });
      }
    });

    return {
      valid: true,
      data: {
        schemaType: 'rdip_questionnaire_logic_flow',
        formatVersion: '1.0',
        exportDate: new Date().toISOString(),
        surveyTitle: 'Imported Full Questionnaire Logic',
        rulesCount: extractedDefinitions.length,
        logicDefinitions: extractedDefinitions
      }
    };
  }

  return {
    valid: false,
    error: "JSON format unrecognized. Expected a valid 'logicDefinitions' array or question collection."
  };
}

/**
 * Applies imported logic definitions onto existing questionnaire questions.
 */
export function applyImportedLogicFlow(
  existingQuestions: Question[],
  importedConfig: SurveyLogicFlowExport,
  mode: 'merge' | 'replace' = 'merge'
): { updatedQuestions: Question[]; result: LogicImportResult } {
  const matchedVariables: string[] = [];
  const unmatchedVariables: string[] = [];
  const warnings: string[] = [];

  // Create a fast lookup map for imported logic by variableName (primary) and questionId (secondary)
  const logicByVar = new Map<string, QuestionLogicRule>();
  const logicById = new Map<string, QuestionLogicRule>();

  importedConfig.logicDefinitions.forEach((def) => {
    if (def.variableName) {
      logicByVar.set(def.variableName.toLowerCase().trim(), def.logicRule);
    }
    if (def.questionId) {
      logicById.set(def.questionId, def.logicRule);
    }
  });

  const updatedQuestions = existingQuestions.map((q) => {
    const varKey = q.variableName?.toLowerCase().trim();
    const importedRule = (varKey && logicByVar.get(varKey)) || logicById.get(q.id);

    if (importedRule) {
      matchedVariables.push(q.variableName || q.id);
      return {
        ...q,
        logicRule: JSON.parse(JSON.stringify(importedRule))
      };
    } else if (mode === 'replace') {
      // Clear out existing logic if replace mode is selected
      const { logicRule, ...rest } = q;
      return {
        ...rest,
        logicRule: { enabled: false, branches: [] }
      };
    }
    return q;
  });

  // Find which imported items could not find a matching variable in current questionnaire
  importedConfig.logicDefinitions.forEach((def) => {
    const varKey = def.variableName?.toLowerCase().trim();
    const found = existingQuestions.some(
      (q) => (varKey && q.variableName?.toLowerCase().trim() === varKey) || q.id === def.questionId
    );
    if (!found) {
      unmatchedVariables.push(def.variableName || def.questionId || 'Unknown item');
    }
  });

  if (unmatchedVariables.length > 0) {
    warnings.push(
      `${unmatchedVariables.length} rule(s) could not find matching variable names in current questionnaire (${unmatchedVariables.slice(0, 3).join(', ')}${unmatchedVariables.length > 3 ? '...' : ''}).`
    );
  }

  return {
    updatedQuestions,
    result: {
      success: true,
      matchedCount: matchedVariables.length,
      unmatchedVariables,
      totalImportedRules: importedConfig.logicDefinitions.length,
      warnings
    }
  };
}
