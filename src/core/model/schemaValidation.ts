import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import bundleSchema from "../../../muselab.bundle.schema.json";
import mlvnSchema from "../../../muselab.mlvn.schema.json";
import promptsSchema from "../../../muselab.prompts.schema.json";
import storySchema from "../../../muselab.story.schema.json";
import {
  BUNDLE_SCHEMA_ID,
  MLVN_SCHEMA_ID,
  PROMPTS_SCHEMA_ID,
  STORY_SCHEMA_ID,
  collectFormatVersionWarnings,
  readManifestMetadata,
  type ManifestMetadata,
} from "./formatVersion";

export type ValidationResult = {
  valid: boolean;
  warnings: string[];
  metadata: ManifestMetadata;
};

let validator: Ajv2020 | null = null;

function getValidator(): Ajv2020 {
  if (validator) {
    return validator;
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addSchema(storySchema);
  ajv.addSchema(promptsSchema);
  ajv.addSchema(bundleSchema);
  ajv.addSchema(mlvnSchema);
  validator = ajv;
  return ajv;
}

function getValidateFn(schemaId: string): ValidateFunction | undefined {
  return getValidator().getSchema(schemaId);
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors?.length) {
    return [];
  }

  return errors.map((error) => {
    const path = error.instancePath || "(root)";
    const detail = error.message ?? "is invalid";
    return `${path}: ${detail}`;
  });
}

function mergeValidationResult(
  metadata: ManifestMetadata,
  expectedSchema: string | undefined,
  validate: ValidateFunction | undefined,
  data: unknown
): ValidationResult {
  const warnings = collectFormatVersionWarnings(metadata, expectedSchema);
  if (!validate) {
    warnings.push("Schema validator is unavailable.");
    return { valid: false, warnings, metadata };
  }

  const valid = validate(data) === true;
  if (!valid) {
    warnings.push(...formatAjvErrors(validate.errors));
  }

  return { valid, warnings, metadata };
}

export function validateStoryManifest(data: unknown): ValidationResult {
  const metadata = readManifestMetadata(data);
  return mergeValidationResult(
    metadata,
    STORY_SCHEMA_ID,
    getValidateFn(STORY_SCHEMA_ID),
    data
  );
}

export function validateLocalePrompts(data: unknown): ValidationResult {
  const metadata = readManifestMetadata(data);
  return mergeValidationResult(
    metadata,
    PROMPTS_SCHEMA_ID,
    getValidateFn(PROMPTS_SCHEMA_ID),
    data
  );
}

export function validateBundlePayload(data: unknown): ValidationResult {
  const metadata = readManifestMetadata(data);
  return mergeValidationResult(
    metadata,
    BUNDLE_SCHEMA_ID,
    getValidateFn(BUNDLE_SCHEMA_ID),
    data
  );
}

export function validateMlvnMetadata(data: unknown): ValidationResult {
  const metadata = readManifestMetadata(data);
  return mergeValidationResult(
    metadata,
    MLVN_SCHEMA_ID,
    getValidateFn(MLVN_SCHEMA_ID),
    data
  );
}

export function summarizeValidationWarnings(
  context: string,
  results: ValidationResult[]
): string[] {
  const messages: string[] = [];

  for (const result of results) {
    if (result.valid && result.warnings.length === 0) {
      continue;
    }

    const header = result.valid
      ? `${context} loaded with compatibility warnings:`
      : `${context} does not fully match the expected schema:`;

    messages.push(header, ...result.warnings.map((warning) => `- ${warning}`));
  }

  return messages;
}
