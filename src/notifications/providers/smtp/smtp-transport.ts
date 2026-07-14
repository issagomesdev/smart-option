import nodemailer from "nodemailer";
import { env } from "../../../config/env";

/** Transporter único SMTP — TLS implícito quando a porta é 465, timeout de conexão/socket para não travar o processo em caso de host indisponível. */
export const smtpTransport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
  connectionTimeout: 10_000,
  socketTimeout: 10_000,
});
