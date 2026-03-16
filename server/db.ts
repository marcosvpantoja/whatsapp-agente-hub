import mysql, { type Pool, type PoolConnection, type QueryResult } from "mysql2/promise";
import { env } from "./env.js";

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: false,
  charset: "utf8mb4",
  supportBigNumbers: true,
  dateStrings: true,
});

export type DbExecutor = Pick<Pool, "execute"> | Pick<PoolConnection, "execute">;

export async function withTransaction<T>(callback: (connection: PoolConnection) => Promise<T>) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
