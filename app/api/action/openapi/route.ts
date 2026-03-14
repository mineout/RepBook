import { NextResponse } from "next/server";

const buildSchema = (origin: string) => ({
  openapi: "3.1.0",
  info: {
    title: "RepBook Read-only Action API",
    version: "1.0.0",
    description: "Read-only endpoints for ChatGPT Custom GPT using expiring share tokens.",
  },
  servers: [
    {
      url: origin,
    },
  ],
  paths: {
    "/api/action/sessions": {
      get: {
        operationId: "getSessions",
        summary: "Get recent workout sessions",
        parameters: [
          { name: "token", in: "query", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 20 } },
          { name: "offset", in: "query", required: false, schema: { type: "integer", minimum: 0 } },
          { name: "muscleGroup", in: "query", required: false, schema: { type: "string" } },
          { name: "exerciseName", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Session list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sessions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          performedAt: { type: "string" },
                          muscleGroup: { type: "string" },
                          exerciseName: { type: "string" },
                          note: { type: ["string", "null"] },
                          setCount: { type: "integer" },
                          totalVolume: { type: "number" },
                        },
                      },
                    },
                    hasMore: { type: "boolean" },
                  },
                },
              },
            },
          },
          "400": { description: "Missing token" },
          "401": { description: "Invalid token" },
          "403": { description: "Expired token" },
        },
      },
    },
    "/api/action/summary": {
      get: {
        operationId: "getSummary",
        summary: "Get current vs previous month summary",
        parameters: [{ name: "token", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Monthly summary",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    current: {
                      type: "object",
                      properties: {
                        dayCount: { type: "integer" },
                        totalVolume: { type: "number" },
                      },
                    },
                    previous: {
                      type: "object",
                      properties: {
                        dayCount: { type: "integer" },
                        totalVolume: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Missing token" },
          "401": { description: "Invalid token" },
          "403": { description: "Expired token" },
        },
      },
    },
    "/api/action/exercises": {
      get: {
        operationId: "getExercises",
        summary: "Get exercise names",
        parameters: [
          { name: "token", in: "query", required: true, schema: { type: "string" } },
          { name: "q", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Exercise names",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    exercises: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Missing token" },
          "401": { description: "Invalid token" },
          "403": { description: "Expired token" },
        },
      },
    },
  },
});

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildSchema(origin));
}
