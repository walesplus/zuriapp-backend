require("dotenv").config();
const express = require("express");
const cors = require("cors");
const client = require("prom-client");
const products = require("./data/products");

const app = express();
const PORT = process.env.PORT || 5000;
const API_SECRET_KEY = process.env.API_SECRET_KEY;
const STORE_NAME = process.env.STORE_NAME || "My Store";

app.use(cors());
app.use(express.json());
// Prometheus monitoring
const register = new client.Registry();

client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpErrorsTotal = new client.Counter({
  name: "http_errors_total",
  help: "Total number of HTTP error responses",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

// Measure HTTP requests and response times
app.use((req, res, next) => {
  if (req.path === "/metrics") {
    return next();
  }

  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;

    const labels = {
      method: req.method,
      route: req.route?.path || "unmatched",
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);

    if (res.statusCode >= 400) {
      httpErrorsTotal.inc(labels);
    }
  });

  next();
});

// Prometheus metrics endpoint
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch  {
    res.status(500).end("Unable to collect metrics");
  }
});

const validateApiKey = (req, res, next) => {
  const key = req.headers["x-api-key"];
  if (!key || key !== API_SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized: invalid or missing API key" });
  }
  next();
};
// Health endpoint for Kubernetes readiness and liveness probes
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
// GET /api/store — store info
app.get("/api/store", (req, res) => {
  res.json({ name: STORE_NAME, totalProducts: products.length });
});

// GET /api/products — all products (optional ?category= filter)
app.get("/api/products", (req, res) => {
  const { category } = req.query;
  const result = category
    ? products.filter((p) => p.category === category)
    : products;
  res.json(result);
});

// GET /api/products/:id — single product
app.get("/api/products/:id", (req, res) => {
  const product = products.find((p) => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

// POST /api/cart/validate — validate cart items (protected route)
app.post("/api/cart/validate", validateApiKey, (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: "Invalid cart payload" });
  }

  const validated = items.map((item) => {
    const product = products.find((p) => p.id === item.id);
    if (!product) return { id: item.id, valid: false, reason: "Product not found" };
    if (product.stock < item.quantity)
      return { id: item.id, valid: false, reason: "Insufficient stock" };
    return {
      id: item.id,
      valid: true,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
      subtotal: product.price * item.quantity,
    };
  });

  const total = validated
    .filter((i) => i.valid)
    .reduce((sum, i) => sum + i.subtotal, 0);

  res.json({ items: validated, total });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Store: ${STORE_NAME}`);
});