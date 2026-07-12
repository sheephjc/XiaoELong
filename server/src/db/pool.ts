import { createPool } from "mysql2/promise";
import { env } from "../config/env.js";

export const pool = createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: 10,
  charset: "utf8mb4",
  timezone: "Z",
  dateStrings: true
});

pool.pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'", (error) => {
    if (error) {
      console.error("Failed to set MySQL session timezone to UTC.", error);
      connection.destroy();
    }
  });
});
