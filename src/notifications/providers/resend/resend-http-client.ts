import axios from "axios";
import { env } from "../../../config/env";

/** Cliente HTTP único para a API HTTP oficial do Resend — autentica via `Authorization: Bearer`. */
export const resendHttpClient = axios.create({
  baseURL: "https://api.resend.com",
  timeout: 10_000,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
  },
});
