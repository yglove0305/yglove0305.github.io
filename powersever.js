#!/usr/bin/env node
"use strict";

const cluster = require("cluster");
const os = require("os");
const process = require("process");
const fs = require("fs");

if (cluster.isPrimary) {
  const numWorkers = process.argv[2] ? parseInt(process.argv[2]) : os.cpus().length;
  const basePort = process.argv[3] ? parseInt(process.argv[3]) : 3000;
  console.log(`Master process (${process.pid}) started. Creating ${numWorkers} workers.`);
  for (let i = 0; i < numWorkers; i++) {
    const workerPort = basePort + i;
    cluster.fork({ SERVER_PORT: workerPort });
  }
  cluster.on("exit", (worker, code, signal) => {
    console.error(`Worker (${worker.process.pid}) exited (code: ${code}, signal: ${signal}). Restarting.`);
    const workerPort = worker.process.env.SERVER_PORT;
    cluster.fork({ SERVER_PORT: workerPort });
  });
} else {
  const PORT = process.env.SERVER_PORT || 3000;
  const express = require("express");
  const helmet = require("helmet");
  const morgan = require("morgan");
  const rateLimit = require("express-rate-limit");
  const compression = require("compression");
  const cors = require("cors");
  const cookieParser = require("cookie-parser");
  const session = require("express-session");
  const multer = require("multer");
  const winston = require("winston");
  const { Server: SocketIOServer } = require("socket.io");

  const logger = winston.createLogger({
    transports: [new winston.transports.Console({ format: winston.format.simple() })]
  });

  const app = express();

  app.use(helmet());
  app.use(morgan("combined"));
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later.",
    standardHeaders: true,
    legacyHeaders: false
  }));
  app.use(compression());
  app.use(cors());
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: Boolean(process.env.SSL_KEY && process.env.SSL_CERT) }
  }));
  app.use((req, res, next) => {
    req.requestTime = new Date().toISOString();
    next();
  });

  const upload = multer({ dest: "uploads/" });

  app.get("/", (req, res) => {
    res.status(200).json({
      message: "Hello! This server boasts excellent performance and robust security.",
      processId: process.pid,
      port: PORT,
      requestTime: req.requestTime
    });
  });

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "OK",
      uptime: process.uptime(),
      processId: process.pid,
      timestamp: new Date()
    });
  });

  app.get("/api/v1/data", (req, res) => {
    res.status(200).json({
      users: [
        { id: 1, name: "Alice", role: "admin" },
        { id: 2, name: "Bob", role: "user" }
      ],
      count: 2
    });
  });

  const basicAuthMiddleware = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      res.setHeader("WWW-Authenticate", "Basic");
      return res.status(401).send("Authentication required.");
    }
    const base64Credentials = authHeader.split(" ")[1];
    if (!base64Credentials) {
      res.setHeader("WWW-Authenticate", "Basic");
      return res.status(400).send("Invalid authentication header.");
    }
    const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
    const [username, password] = credentials.split(":");
    const validUsername = process.env.ADMIN_USER || "admin";
    const validPassword = process.env.ADMIN_PASS || "password";
    if (username === validUsername && password === validPassword) {
      next();
    } else {
      res.setHeader("WWW-Authenticate", "Basic");
      return res.status(401).send("Unauthorized user.");
    }
  };

  app.get("/admin", basicAuthMiddleware, (req, res) => {
    res.status(200).json({
      message: "Welcome to the admin panel.",
      processId: process.pid,
      serverConfig: {
        port: PORT,
        sslEnabled: Boolean(process.env.SSL_KEY && process.env.SSL_CERT)
      }
    });
  });

  app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }
    res.status(200).json({
      message: "File uploaded successfully",
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size
      }
    });
  });

  app.get("/metrics", (req, res) => {
    res.status(200).json({
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      requestTime: req.requestTime
    });
  });

  app.get("/set-cookie", (req, res) => {
    res.cookie("session", "12345", { httpOnly: true });
    res.status(200).send("Cookie set");
  });

  app.use((req, res, next) => {
    res.status(404).json({ error: "Route not found." });
  });

  app.use((err, req, res, next) => {
    logger.error(`[Process ${process.pid}] Error: ${err}`);
    res.status(500).json({ error: "Internal server error." });
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error(`[Process ${process.pid}] Unhandled promise rejection: ${reason}`);
  });
  process.on("uncaughtException", (error) => {
    logger.error(`[Process ${process.pid}] Uncaught exception: ${error}`);
    process.exit(1);
  });

  let server;
  if (process.env.SSL_KEY && process.env.SSL_CERT) {
    try {
      const https = require("https");
      const sslOptions = {
        key: fs.readFileSync(process.env.SSL_KEY),
        cert: fs.readFileSync(process.env.SSL_CERT)
      };
      server = https.createServer(sslOptions, app);
      logger.info(`[Process ${process.pid}] SSL enabled: Running on port ${PORT}`);
    } catch (err) {
      logger.error("SSL configuration error:", err);
      process.exit(1);
    }
  } else {
    const http = require("http");
    server = http.createServer(app);
    logger.info(`[Process ${process.pid}] Running on port ${PORT} without SSL`);
  }

  server.listen(PORT, () => {
    logger.info(`[Process ${process.pid}] Server is listening on port ${PORT}`);
  });

  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  io.on("connection", (socket) => {
    logger.info(`[Process ${process.pid}] Socket connected: ${socket.id}`);
    socket.on("message", (msg) => {
      logger.info(`[Process ${process.pid}] Message from ${socket.id}: ${msg}`);
      socket.emit("message", `Echo: ${msg}`);
    });
    socket.on("disconnect", () => {
      logger.info(`[Process ${process.pid}] Socket disconnected: ${socket.id}`);
    });
  });

  const shutdown = () => {
    logger.info(`[Process ${process.pid}] Starting graceful shutdown...`);
    server.close(() => {
      logger.info(`[Process ${process.pid}] All connections closed. Exiting.`);
      process.exit(0);
    });
    setTimeout(() => {
      logger.error(`[Process ${process.pid}] Shutdown timeout. Forcing exit.`);
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
```
