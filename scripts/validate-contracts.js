import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = process.cwd();
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(root, file), "utf8"));
}

function validateInstance(schemaFile, instanceFile) {
  const schema = readJson(schemaFile);
  const instance = readJson(instanceFile);
  const validator = ajv.compile(schema);
  const ok = validator(instance);
  if (!ok) {
    console.error(`Contract validation failed: ${instanceFile}`);
    console.error(JSON.stringify(validator.errors, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${instanceFile}`);
}

validateInstance("schemas/business-context.schema.json", "contexts/kollabor8.context.v1.json");

const skillFiles = fs.readdirSync(path.resolve(root, "skills"))
  .filter((name) => name.endsWith(".json"))
  .sort();

for (const name of skillFiles) {
  validateInstance("schemas/skill.schema.json", `skills/${name}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`Validated 1 business context and ${skillFiles.length} skill contract(s).`);
