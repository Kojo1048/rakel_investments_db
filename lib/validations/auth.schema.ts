import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(3).max(50).trim(),
  password: z.string().min(6).max(100),
});

export const PASSWORD_RULES = {
  minLength: 10,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecial: /[^a-zA-Z0-9]/,
};

const strongPassword = z
  .string()
  .min(PASSWORD_RULES.minLength, `Password must be at least ${PASSWORD_RULES.minLength} characters`)
  .max(100)
  .regex(PASSWORD_RULES.hasUppercase, 'Password must contain at least one uppercase letter')
  .regex(PASSWORD_RULES.hasLowercase, 'Password must contain at least one lowercase letter')
  .regex(PASSWORD_RULES.hasNumber, 'Password must contain at least one number')
  .regex(PASSWORD_RULES.hasSpecial, 'Password must contain at least one special character');

export const RegisterSchema = z
  .object({
    username: z
      .string()
      .min(3)
      .max(50)
      .trim()
      .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores'),
    email:         z.string().email(),
    password:      strongPassword,
    confirmPassword: z.string(),
    fullName:      z.string().min(2).max(100).trim(),
    requestedRole: z.enum(['STAFF', 'COMPANY_ADMIN'], {
      errorMap: () => ({ message: 'Role must be Staff or Company Admin' }),
    }),
    // companyId is ONLY required for COMPANY_ADMIN — the refine below enforces this
    companyId: z.string().min(1).optional(),
    reason:    z.string().max(500).optional(),
    // staffModules removed — all Staff share the same unified Upload Hub
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path:    ['confirmPassword'],
  })
  .refine(
    data => data.requestedRole !== 'COMPANY_ADMIN' || !!data.companyId,
    { message: 'Company Admin must select a company', path: ['companyId'] }
  );

export type LoginInput  = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
