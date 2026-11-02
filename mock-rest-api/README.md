# LeadBridge Mock REST API

A small, standalone Express service with static fictional leads for testing REST connector configuration. It has no database and does not depend on LeadBridge code.

## Installation

```bash
cd mock-rest-api
npm install
```

## Environment

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4001` | Local HTTP port |
| `MOCK_API_KEY` | built-in local fallback | API key required by `/api/leads-auth`; override it for isolated local tests and never use it elsewhere |

You can copy `.env.example` to `.env` and change the key, or set the variables in your shell. The current server binds to `0.0.0.0` and is intended only for local testing; use a trusted network and stop it when finished.

## Start

```bash
npm start
```

For automatic restart while editing:

```bash
npm run dev
```

The API listens on port `4001` by default. From the same network namespace, request it at `http://localhost:4001`.

## Endpoints

All successful lead endpoints return the same envelope:

```json
{
  "data": [{
    "id": "mock-lead-1001",
    "name": "Avery Bennett",
    "email": "avery.bennett@example.test",
    "phone": "+1-202-555-0101",
    "company": "Northstar Analytics",
    "requirement": "Interested in consolidating sales reporting across three regional teams."
  }],
  "pagination": {
    "page": 1,
    "pageSize": 5,
    "totalRecords": 18,
    "totalPages": 4,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### `GET /api/leads?page=1`

Returns five records per page from the fixed 18-record data set. `page` is one-based. Invalid page values return HTTP 400.

```bash
curl 'http://localhost:4001/api/leads?page=2'
```

### `GET /api/leads-auth?page=1`

Requires the `x-api-key` request header. Missing or incorrect keys return HTTP 401.

```bash
curl 'http://localhost:4001/api/leads-auth?page=1' \
  -H 'x-api-key: <MOCK_API_KEY>'
```

### `GET /api/leads-error`

Always returns HTTP 500 with a JSON error body for failure-handling tests.

```bash
curl -i 'http://localhost:4001/api/leads-error'
```

Sample lead data lives in `data/leads.js`. A few records intentionally omit optional contact fields. All endpoints use this same static data set.
