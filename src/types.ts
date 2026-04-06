export interface PythonParameter {
  name: string;
  annotation: string | null;
  defaultValue: string | null;
  kind: string;
}

export interface PythonFunction {
  name: string;
  line: number;
  decorators: string[];
  parameters: PythonParameter[];
  returns: string | null;
  docstring: string | null;
  visibility: "public" | "private";
}

export interface PythonClass {
  name: string;
  line: number;
  bases: string[];
  decorators: string[];
  docstring: string | null;
  methods: PythonFunction[];
}

export interface PythonModuleAnalysis {
  path: string;
  moduleName: string;
  docstring: string | null;
  imports: string[];
  classes: PythonClass[];
  functions: PythonFunction[];
}

export interface OutlineSection {
  title: string;
  bullets: string[];
}

export interface SberDocOutline {
  moduleName: string;
  recommendedTitle: string;
  sections: OutlineSection[];
}

export interface ValidationIssue {
  code: string;
  level: "error" | "warning";
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}
