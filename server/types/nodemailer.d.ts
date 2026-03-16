declare module "nodemailer" {
  export interface SendMailOptions {
    from: string;
    to: string;
    replyTo?: string;
    subject: string;
    text: string;
    html: string;
  }

  export interface TransportOptions {
    host: string;
    port: number;
    secure?: boolean;
    requireTLS?: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  }

  export interface Transporter {
    sendMail(options: SendMailOptions): Promise<unknown>;
  }

  export interface NodemailerModule {
    createTransport(options: TransportOptions): Transporter;
  }

  const nodemailer: NodemailerModule;
  export default nodemailer;
}
