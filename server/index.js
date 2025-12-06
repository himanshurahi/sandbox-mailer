import express from 'express';
import cors from 'cors';
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// In-memory storage
const emails = [];
const errors = [];

// Configuration with defaults
let config = {
  rateLimit: {
    enabled: true,
    maxPerSecond: 1,
  },
  latency: {
    enabled: false,
    minMs: 0,
    maxMs: 0,
  },
};

// Rate limiting state
let lastEmailTime = 0;
let emailsInCurrentSecond = 0;

// Reset rate limit counter every second
setInterval(() => {
  emailsInCurrentSecond = 0;
}, 1000);

// Helper to simulate latency
const simulateLatency = () => {
  if (!config.latency.enabled) return Promise.resolve();
  
  const delay = Math.floor(
    Math.random() * (config.latency.maxMs - config.latency.minMs + 1) + config.latency.minMs
  );
  
  return new Promise(resolve => setTimeout(resolve, delay));
};

// Check rate limit
const checkRateLimit = () => {
  if (!config.rateLimit.enabled) return { allowed: true };
  
  const now = Date.now();
  const timeSinceLastEmail = now - lastEmailTime;
  
  if (emailsInCurrentSecond >= config.rateLimit.maxPerSecond) {
    return {
      allowed: false,
      code: 421, // SMTP: Service not available, try again later
      message: `421 4.7.0 Rate limit exceeded: Maximum ${config.rateLimit.maxPerSecond} email(s) per second allowed. Please retry after 1 second.`,
      retryAfter: Math.ceil(1000 - (now % 1000)),
    };
  }
  
  return { allowed: true };
};

// Create SMTP error with proper response code
const createSmtpError = (code, message) => {
  const error = new Error(message);
  error.responseCode = code;
  return error;
};


// Create SMTP server
const smtpServer = new SMTPServer({
  secure: false,
  authOptional: true,
  disabledCommands: ['STARTTLS'],
  
  onConnect(session, callback) {
    console.log(`📬 Connection from ${session.remoteAddress}`);
    callback();
  },
  
  onAuth(auth, session, callback) {
    // Accept any authentication
    callback(null, { user: auth.username });
  },
  
  async onData(stream, session, callback) {
    const fromAddress = session.envelope.mailFrom?.address || 'unknown';
    const toAddresses = session.envelope.rcptTo?.map(r => r.address) || [];
    
    try {
      // Check rate limit FIRST
      const rateLimitCheck = checkRateLimit();
      if (!rateLimitCheck.allowed) {
        const errorRecord = {
          id: uuidv4(),
          type: 'rate_limit',
          code: rateLimitCheck.code,
          message: rateLimitCheck.message,
          timestamp: new Date().toISOString(),
          from: fromAddress,
          to: toAddresses,
        };
        errors.unshift(errorRecord);
        if (errors.length > 50) errors.pop();
        
        console.log(`❌ Rate limit exceeded for ${fromAddress}`);
        
        // Consume the stream before returning error
        stream.on('data', () => {});
        stream.on('end', () => {
          callback(createSmtpError(rateLimitCheck.code, rateLimitCheck.message));
        });
        return;
      }
      
      // Simulate latency
      await simulateLatency();
      
      // Parse the email
      const parsed = await simpleParser(stream);
      
      // Process attachments with full data
      const attachments = parsed.attachments?.map(a => ({
        id: uuidv4(),
        filename: a.filename || 'unnamed',
        contentType: a.contentType || 'application/octet-stream',
        size: a.size || 0,
        content: a.content.toString('base64'), // Store as base64
        cid: a.cid || null, // Content-ID for inline images
      })) || [];
      
      const email = {
        id: uuidv4(),
        from: parsed.from?.text || fromAddress,
        to: parsed.to?.text || toAddresses.join(', '),
        cc: parsed.cc?.text || '',
        bcc: parsed.bcc?.text || '',
        subject: parsed.subject || '(no subject)',
        text: parsed.text || '',
        html: parsed.html || '',
        attachments: attachments,
        headers: Object.fromEntries(parsed.headers),
        receivedAt: new Date().toISOString(),
        size: parsed.text?.length || 0,
      };
      
      emails.unshift(email);
      emailsInCurrentSecond++;
      lastEmailTime = Date.now();
      
      // Keep only last 100 emails
      if (emails.length > 100) {
        emails.pop();
      }
      
      console.log(`✅ Email received: "${email.subject}" from ${email.from}`);
      callback();
    } catch (err) {
      console.error('Error processing email:', err);
      const errorRecord = {
        id: uuidv4(),
        type: 'server_error',
        code: 451,
        message: `451 4.3.0 Server error: ${err.message}`,
        timestamp: new Date().toISOString(),
        from: fromAddress,
        to: toAddresses,
      };
      errors.unshift(errorRecord);
      if (errors.length > 50) errors.pop();
      
      callback(createSmtpError(451, `451 4.3.0 Server error: ${err.message}`));
    }
  },
});

// API Routes

// Get all emails
app.get('/api/emails', (req, res) => {
  res.json(emails);
});

// Get single email (without attachment content for lighter response)
app.get('/api/emails/:id', (req, res) => {
  const email = emails.find(e => e.id === req.params.id);
  if (!email) {
    return res.status(404).json({ error: 'Email not found' });
  }
  // Return email with attachment metadata only (not content)
  const emailResponse = {
    ...email,
    attachments: email.attachments.map(a => ({
      id: a.id,
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
      cid: a.cid,
    })),
  };
  res.json(emailResponse);
});

// Download attachment
app.get('/api/emails/:emailId/attachments/:attachmentId', (req, res) => {
  const email = emails.find(e => e.id === req.params.emailId);
  if (!email) {
    return res.status(404).json({ error: 'Email not found' });
  }
  
  const attachment = email.attachments.find(a => a.id === req.params.attachmentId);
  if (!attachment) {
    return res.status(404).json({ error: 'Attachment not found' });
  }
  
  const buffer = Buffer.from(attachment.content, 'base64');
  
  res.setHeader('Content-Type', attachment.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
});

// Get attachment as inline (for preview)
app.get('/api/emails/:emailId/attachments/:attachmentId/inline', (req, res) => {
  const email = emails.find(e => e.id === req.params.emailId);
  if (!email) {
    return res.status(404).json({ error: 'Email not found' });
  }
  
  const attachment = email.attachments.find(a => a.id === req.params.attachmentId);
  if (!attachment) {
    return res.status(404).json({ error: 'Attachment not found' });
  }
  
  const buffer = Buffer.from(attachment.content, 'base64');
  
  res.setHeader('Content-Type', attachment.contentType);
  res.setHeader('Content-Disposition', `inline; filename="${attachment.filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
});

// Delete email
app.delete('/api/emails/:id', (req, res) => {
  const index = emails.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Email not found' });
  }
  emails.splice(index, 1);
  res.json({ success: true });
});

// Delete all emails
app.delete('/api/emails', (req, res) => {
  emails.length = 0;
  res.json({ success: true });
});

// Get errors
app.get('/api/errors', (req, res) => {
  res.json(errors);
});

// Clear errors
app.delete('/api/errors', (req, res) => {
  errors.length = 0;
  res.json({ success: true });
});

// Get config
app.get('/api/config', (req, res) => {
  res.json(config);
});

// Update config
app.put('/api/config', (req, res) => {
  const { rateLimit, latency } = req.body;
  
  if (rateLimit) {
    config.rateLimit = { ...config.rateLimit, ...rateLimit };
  }
  
  if (latency) {
    config.latency = { ...config.latency, ...latency };
  }
  
  console.log('📝 Config updated:', config);
  res.json(config);
});

// Get stats
app.get('/api/stats', (req, res) => {
  res.json({
    totalEmails: emails.length,
    totalErrors: errors.length,
    emailsInCurrentSecond,
    config,
  });
});

// Start servers
const HTTP_PORT = 8025;
const SMTP_PORT = 2525;

smtpServer.listen(SMTP_PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   📧  SANDBOX MAILER                                       ║
║                                                            ║
║   SMTP Server: localhost:${SMTP_PORT}                          ║
║   Web UI:      http://localhost:${HTTP_PORT}                    ║
║                                                            ║
║   Laravel .env configuration:                              ║
║   ─────────────────────────────                            ║
║   MAIL_MAILER=smtp                                         ║
║   MAIL_HOST=127.0.0.1                                      ║
║   MAIL_PORT=${SMTP_PORT}                                       ║
║   MAIL_USERNAME=null                                       ║
║   MAIL_PASSWORD=null                                       ║
║   MAIL_ENCRYPTION=null                                     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

app.listen(HTTP_PORT, () => {
  console.log(`🌐 Web UI running at http://localhost:${HTTP_PORT}`);
});

