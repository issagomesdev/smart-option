import { z } from "zod";

export const loginDto = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
  remember: z.boolean().optional().default(false),
});

export type LoginDto = z.infer<typeof loginDto>;

export const refreshTokenDto = z.object({
  refreshToken: z.string().min(1, "refreshToken é obrigatório"),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenDto>;
