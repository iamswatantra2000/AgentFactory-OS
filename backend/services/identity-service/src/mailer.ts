import nodemailer from 'nodemailer';

export type AuthMail = {
  verification(email: string, token: string): Promise<void>;
  passwordReset(email: string, token: string): Promise<void>;
};

export function createAuthMail(config: {
  host: string;
  port: number;
  secure: boolean;
  from: string;
  appBaseUrl: string;
  user?: string;
  password?: string;
}): AuthMail {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.user && config.password
      ? { auth: { user: config.user, pass: config.password } }
      : {}),
  });
  const base = config.appBaseUrl.replace(/\/$/, '');
  return {
    async verification(email, token) {
      const link = `${base}/verify-email#token=${token}`;
      await transport.sendMail({
        from: config.from,
        to: email,
        subject: 'Verify your AgentFactory OS email',
        text: `Confirm your email to use AgentFactory OS. This link expires in 24 hours.\n\n${link}\n\nIf you did not create an account, ignore this email.`,
        html: `<p>Confirm your email to use AgentFactory OS.</p><p><a href="${link}">Verify email</a></p><p>This link expires in 24 hours. If you did not create an account, ignore this email.</p>`,
      });
    },
    async passwordReset(email, token) {
      const link = `${base}/reset-password#token=${token}`;
      await transport.sendMail({
        from: config.from,
        to: email,
        subject: 'Reset your AgentFactory OS password',
        text: `Use this link to reset your AgentFactory OS password. It expires in 30 minutes.\n\n${link}\n\nIf you did not request this, ignore this email.`,
        html: `<p>Use this link to reset your AgentFactory OS password.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request this, ignore this email.</p>`,
      });
    },
  };
}
