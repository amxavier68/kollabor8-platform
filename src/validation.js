import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

function loadSchema(name) {
  const file = path.resolve(process.cwd(), "schemas", name);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const validators = {
  event: ajv.compile(loadSchema("pulse-event.schema.json")),
  evidence: ajv.compile(loadSchema("atlas-evidence.schema.json"))
};

export function validate(kind, value) {
  const validator = validators[kind];
  const ok = validator(value);
  return {
    ok: Boolean(ok),
    errors: ok ? [] : validator.errors.map((error) => ({
      path: error.instancePath || "/",
      message: error.message,
      keyword: error.keyword
    }))
  };
}
