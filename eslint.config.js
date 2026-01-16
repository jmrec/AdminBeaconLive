import jsdoc from "eslint-plugin-jsdoc";
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import flowPlugin from "eslint-plugin-ft-flow";
import hermesParser from "hermes-eslint";

export default defineConfig([
    js.configs.recommended,
    flowPlugin.configs.recommended,
    {
        files: ["**/*.js"],
        plugins: {
            jsdoc,
            "ft-flow": flowPlugin,
        },
        languageOptions: {
            parser: hermesParser,
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
                supabase: "readonly",
                L: "readonly",
                Chart: "readonly",
                jspdf: "readonly"
            }
        },
        rules: {
            // Requirement Rules
            "jsdoc/require-description": "error",
            "jsdoc/require-param-type": "error",
            "jsdoc/require-returns-type": "error",
            
            // Validation Rules (The "Error-Avoidance" Core)
            "jsdoc/check-param-names": "error",
            "jsdoc/check-tag-names": "warn",
            "jsdoc/check-types": "error",
            "jsdoc/no-undefined-types": "error",
            "jsdoc/require-returns-check": "error",
            "jsdoc/valid-types": "error",
            
            // Syncing Code and Docs
            "jsdoc/check-alignment": "warn", // Fixes whitespace issues
            "jsdoc/check-property-names": "error", // For @property in @typedef

            "ft-flow/no-primitive-constructor-types": "error",
            "ft-flow/type-id-match": ["error", "^([A-Z][a-z0-9]*)+Type$"],
        },
    },
]);