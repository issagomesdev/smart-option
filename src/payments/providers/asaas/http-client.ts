import axios from "axios";
import { env } from "../../../config/env";

/**
 * Cliente HTTP único para a API da Asaas. A Asaas autentica via header
 * `access_token` (não `Authorization: Bearer`, diferente da maioria dos
 * gateways) — centralizar isso aqui evita que cada sub-service reimplemente
 * a autenticação.
 */
export const asaasHttpClient = axios.create({
  baseURL: env.ASAAS_BASE_URL,
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
    access_token: env.ASAAS_API_KEY,
  },
});
