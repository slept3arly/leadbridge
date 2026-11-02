import express from "express";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import leads from "./data/leads.js";

const app = express();
const port = Number(process.env.PORT) || 4001;
const apiKey = process.env.MOCK_API_KEY || "local-leadbridge-test-key";
const pageSize = 5;

function getPage(req, res) {
  const rawPage = req.query.page ?? "1";
  const page = Number(rawPage);
  if (!Number.isInteger(page) || page < 1) {
    res.status(400).json({
      error: {
        code: "INVALID_PAGE",
        message: "The page query parameter must be a positive integer.",
      },
    });
    return null;
  }

  const totalRecords = leads.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const start = (page - 1) * pageSize;
  return {
    data: leads.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

app.get("/api/leads", (req, res) => {
  const result = getPage(req, res);
  if (result) res.json(result);
});

app.get("/api/leads-auth", (req, res) => {
  if (req.get("x-api-key") !== apiKey) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "A valid x-api-key header is required.",
      },
    });
  }

  const result = getPage(req, res);
  if (result) res.json(result);
});

app.get("/api/leads-error", (_req, res) => {
  res.status(500).json({
    error: {
      code: "MOCK_UPSTREAM_FAILURE",
      message: "This endpoint intentionally simulates an upstream server error.",
    },
  });
});

export function startServer() {
  return app.listen(port, "0.0.0.0", () => {
    console.log(`Mock REST API listening at http://0.0.0.0:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startServer();
}

export default app;
