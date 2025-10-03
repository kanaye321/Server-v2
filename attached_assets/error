
import nodemailer from 'nodemailer';
import { storage } from './storage';
import { promises as fs } from 'fs';
import { join } from 'path';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailLog {
  timestamp: string;
  to: string;
  subject: string;
  status: 'success' | 'failed';
  error?: string;
  messageId?: string;
}

const EMAIL_LOGS_DIR = join(process.cwd(), 'LOGS');
const EMAIL_LOG_FILE = 'email_notifications.log';

async function ensureEmailLogsDirectory() {
  try {
    await fs.access(EMAIL_LOGS_DIR);
  } catch {
    await fs.mkdir(EMAIL_LOGS_DIR, { recursive: true });
  }
}

async function logEmailEvent(log: EmailLog) {
  await ensureEmailLogsDirectory();
  const filepath = join(EMAIL_LOGS_DIR, EMAIL_LOG_FILE);
  const logEntry = `[${log.timestamp}] [${log.status.toUpperCase()}] To: ${log.to} | Subject: ${log.subject}${log.messageId ? ` | MessageID: ${log.messageId}` : ''}${log.error ? ` | Error: ${log.error}` : ''}\n`;
  await fs.appendFile(filepath, logEntry);
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  async initialize() {
    try {
      const settings = await storage.getSystemSettings();
      
      if (!settings?.mailHost || !settings?.mailFromAddress) {
        console.log('Email not configured - skipping email service initialization');
        return false;
      }

      this.transporter = nodemailer.createTransport({
        host: settings.mailHost,
        port: parseInt(settings.mailPort || '587'),
        secure: settings.mailPort === '465',
        auth: {
          user: settings.mailUsername || settings.mailFromAddress,
          pass: settings.mailPassword || ''
        }
      });

      // Verify connection
      await this.transporter.verify();
      console.log('✅ Email service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.transporter = null;
      return false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      console.log('📧 Email service not initialized - attempting to initialize...');
      const initialized = await this.initialize();
      if (!initialized) {
        console.log('❌ Cannot send email - service not configured. Please configure email settings in System Setup.');
        await logEmailEvent({
          timestamp: new Date().toISOString(),
          to: options.to,
          subject: options.subject,
          status: 'failed',
          error: 'Email service not configured'
        });
        return false;
      }
    }

    try {
      const settings = await storage.getSystemSettings();
      
      console.log(`📧 Sending email...`);
      console.log(`   From: ${settings?.mailFromAddress}`);
      console.log(`   To: ${options.to}`);
      console.log(`   Subject: ${options.subject}`);
      
      const info = await this.transporter!.sendMail({
        from: `"${settings?.siteName || 'SRPH-MIS'}" <${settings?.mailFromAddress}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, '')
      });

      console.log(`✅ Email sent successfully to ${options.to}`);
      console.log(`   Message ID: ${info.messageId}`);
      console.log(`   Response: ${info.response}`);
      
      await logEmailEvent({
        timestamp: new Date().toISOString(),
        to: options.to,
        subject: options.subject,
        status: 'success',
        messageId: info.messageId
      });
      
      return true;
    } catch (error: any) {
      console.error('❌ Failed to send email:', error.message);
      if (error.code) {
        console.error(`   Error code: ${error.code}`);
      }
      if (error.command) {
        console.error(`   Failed command: ${error.command}`);
      }
      
      await logEmailEvent({
        timestamp: new Date().toISOString(),
        to: options.to,
        subject: options.subject,
        status: 'failed',
        error: error.message
      });
      
      return false;
    }
  }

  async sendIamExpirationNotification(data: {
    accounts: Array<{
      requestor: string;
      knoxId: string;
      permission: string;
      cloudPlatform: string;
      endDate: string;
      approvalId: string;
    }>;
  }) {
    try {
      const settings = await storage.getSystemSettings();
      
      if (!settings?.notifyOnIamExpiration) {
        console.log('📧 IAM expiration notifications are disabled');
        return false;
      }
      
      if (!settings?.companyEmail) {
        console.log('❌ No admin email configured for notifications');
        return false;
      }

      console.log(`📧 Preparing to send IAM expiration notifications`);
      console.log(`📧 ${data.accounts.length} expired IAM account(s)`);

      // Send individual notifications to each account owner
      let ownerNotificationsSent = 0;
      let adminNotificationsSent = 0;

      for (const account of data.accounts) {
        try {
          const ownerEmail = `${account.knoxId}@samsung.com`;
          
          console.log(`📧 Processing notifications for ${account.knoxId}...`);
          
          // Send to account owner
          const ownerResult = await this.sendIamExpirationOwnerNotification(account);
          if (ownerResult) {
            ownerNotificationsSent++;
            console.log(`✅ Owner notification sent to ${ownerEmail}`);
          } else {
            console.log(`⚠️ Failed to send owner notification to ${ownerEmail}`);
          }

          // Send to admin for each account
          const adminSubject = `[SRPH-MIS] IAM Account Expiration Alert - ${account.knoxId}`;
          
          const adminHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 800px; margin: 0 auto; padding: 20px; }
                .header { background-color: #ef4444; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
                .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th { background-color: #f3f4f6; padding: 10px; border: 1px solid #e5e7eb; text-align: left; }
                td { padding: 10px; border: 1px solid #e5e7eb; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h2>⚠️ IAM Account Expiration Alert</h2>
                </div>
                <div class="content">
                  <p><strong>The following IAM account has expired and requires attention:</strong></p>
                  <table>
                    <thead>
                      <tr>
                        <th>Requestor</th>
                        <th>Knox ID</th>
                        <th>Permission</th>
                        <th>Platform</th>
                        <th>End Date</th>
                        <th>Approval ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>${account.requestor}</td>
                        <td>${account.knoxId}</td>
                        <td>${account.permission}</td>
                        <td>${account.cloudPlatform}</td>
                        <td>${account.endDate}</td>
                        <td style="font-weight: bold; color: #ef4444;">${account.approvalId}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p><strong>Action Required:</strong></p>
                  <ul>
                    <li>Review and update expired account</li>
                    <li>Contact requestor for extension if needed</li>
                    <li>Remove access if no longer required</li>
                    <li>Update status to "Expired - Notified" after notification</li>
                  </ul>
                  <p><strong>Note:</strong> Notification has been sent to ${ownerEmail}</p>
                  <p>This is an automated notification from SRPH-MIS.</p>
                </div>
                <div class="footer">
                  <p>SRPH Management Information System</p>
                  <p>This email was sent automatically. Please do not reply.</p>
                </div>
              </div>
            </body>
            </html>
          `;

          const adminResult = await this.sendEmail({
            to: settings.companyEmail,
            subject: adminSubject,
            html: adminHtml
          });

          if (adminResult) {
            adminNotificationsSent++;
            console.log(`✅ Admin notification sent to ${settings.companyEmail} for ${account.knoxId}`);
          } else {
            console.log(`⚠️ Failed to send admin notification to ${settings.companyEmail} for ${account.knoxId}`);
          }
        } catch (accountError) {
          console.error(`❌ Failed to send notifications for ${account.knoxId}:`, accountError);
        }
      }

      console.log(`📧 SUMMARY: Total notifications sent - ${ownerNotificationsSent} to owners, ${adminNotificationsSent} to admin`);

      return ownerNotificationsSent > 0 || adminNotificationsSent > 0;
    } catch (error) {
      console.error('❌ Error sending IAM expiration notification:', error);
      return false;
    }
  }

  async sendIamExpirationOwnerNotification(account: {
    requestor: string;
    knoxId: string;
    permission: string;
    cloudPlatform: string;
    endDate: string;
    approvalId: string;
  }) {
    try {
      const settings = await storage.getSystemSettings();
      
      if (!this.transporter) {
        console.log('📧 Email service not initialized - skipping owner notification');
        return false;
      }

      const ownerEmail = `${account.knoxId}@samsung.com`;
      
      // Calculate removal date (7 days from now)
      const removalDate = new Date();
      removalDate.setDate(removalDate.getDate() + 7);
      const removalDateStr = removalDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      // Use custom template from settings or default
      const subject = settings?.iamExpirationEmailSubject || 'IAM Account Access Expiration Notice';
      
      // Default template if none is configured
      const defaultTemplate = `Hi,

Please be advised that your requested access is now expired and will be removed on {removalDate}.

Kindly let us know if you still require access or if we can now proceed with the removal.

https://confluence.sec.samsung.net/pages/viewpage.action?pageId=454565479&spaceKey=SRPHCOMMONC&title=AWS%2BApproval%2BGuide

Account Details:
- Requestor: {requestor}
- Knox ID: {knoxId}
- Permission/IAM/SCOP: {permission}
- Cloud Platform: {cloudPlatform}
- Expiration Date: {endDate}
- Approval ID: {approvalId}

If you need to extend your access, please submit a new request through the proper channels.`;

      // Use the custom template from settings, or fall back to default
      let emailBody = settings?.iamExpirationEmailBody && settings.iamExpirationEmailBody.trim() !== '' 
        ? settings.iamExpirationEmailBody 
        : defaultTemplate;

      console.log('📧 Using email template:', emailBody.substring(0, 100) + '...');

      // Replace placeholders with actual values
      emailBody = emailBody
        .replace(/{removalDate}/g, removalDateStr)
        .replace(/{requestor}/g, account.requestor)
        .replace(/{knoxId}/g, account.knoxId)
        .replace(/{permission}/g, account.permission)
        .replace(/{cloudPlatform}/g, account.cloudPlatform)
        .replace(/{endDate}/g, account.endDate)
        .replace(/{approvalId}/g, account.approvalId);

      // Convert plain text to HTML with proper formatting
      const emailBodyHtml = emailBody
        .split('\n')
        .map(line => {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
            return `<p><a href="${trimmedLine}" style="color: #2563eb; text-decoration: none;">${trimmedLine}</a></p>`;
          }
          return trimmedLine ? `<p>${line}</p>` : '<br>';
        })
        .join('\n');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ef4444; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            a { color: #2563eb; text-decoration: none; }
            code { background-color: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
            p { margin: 0.5em 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>⚠️ ${subject}</h2>
            </div>
            <div class="content">
              ${emailBodyHtml}
              <p style="margin-top: 20px; font-style: italic; color: #6b7280;">This is an automated notification from SRPH-MIS.</p>
            </div>
            <div class="footer">
              <p>SRPH Management Information System</p>
              <p>This email was sent automatically. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      console.log(`📧 Sending IAM expiration email to ${ownerEmail} with subject: ${subject}`);

      const result = await this.sendEmail({
        to: ownerEmail,
        subject,
        html
      });

      return result;
    } catch (error) {
      console.error('❌ Error sending IAM owner notification:', error);
      return false;
    }
  }

  async sendVmExpirationNotification(data: {
    vms: Array<{
      vmName: string;
      knoxId: string;
      requestor: string;
      department: string;
      endDate: string;
      approvalNumber: string;
    }>;
  }) {
    try {
      const settings = await storage.getSystemSettings();
      
      if (!settings?.notifyOnVmExpiration) {
        console.log('📧 VM expiration notifications are disabled');
        return false;
      }
      
      if (!settings?.companyEmail) {
        console.log('❌ No admin email configured for notifications');
        return false;
      }

      console.log(`📧 Preparing to send VM expiration notification to: ${settings.companyEmail}`);
      console.log(`📧 ${data.vms.length} expired VM(s)`);

      const subject = `[SRPH-MIS] VM Expiration Alert - ${data.vms.length} Virtual Machine(s)`;
      
      const vmsHtml = data.vms.map(vm => `
        <tr>
          <td style="padding: 10px; border: 1px solid #e5e7eb;">${vm.vmName}</td>
          <td style="padding: 10px; border: 1px solid #e5e7eb;">${vm.knoxId || 'N/A'}</td>
          <td style="padding: 10px; border: 1px solid #e5e7eb;">${vm.requestor}</td>
          <td style="padding: 10px; border: 1px solid #e5e7eb;">${vm.department || 'N/A'}</td>
          <td style="padding: 10px; border: 1px solid #e5e7eb;">${vm.endDate}</td>
          <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #ef4444;">${vm.approvalNumber || 'N/A'}</td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ef4444; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th { background-color: #f3f4f6; padding: 10px; border: 1px solid #e5e7eb; text-align: left; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>⚠️ Virtual Machine Expiration Alert</h2>
            </div>
            <div class="content">
              <p><strong>The following virtual machines have reached their end date and require attention:</strong></p>
              <table>
                <thead>
                  <tr>
                    <th>VM Name</th>
                    <th>Knox ID</th>
                    <th>Requestor</th>
                    <th>Department</th>
                    <th>End Date</th>
                    <th>Approval Number</th>
                  </tr>
                </thead>
                <tbody>
                  ${vmsHtml}
                </tbody>
              </table>
              <p><strong>Action Required:</strong></p>
              <ul>
                <li>Review and update expired VMs</li>
                <li>Contact requestors for extension if needed</li>
                <li>Decommission VMs if no longer required</li>
                <li>Update status to "Overdue - Notified" after notification</li>
              </ul>
              <p>This is an automated notification from SRPH-MIS.</p>
            </div>
            <div class="footer">
              <p>SRPH Management Information System</p>
              <p>This email was sent automatically. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const result = await this.sendEmail({
        to: settings.companyEmail,
        subject,
        html
      });

      if (result) {
        console.log(`✅ VM expiration notification sent successfully to ${settings.companyEmail}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Error sending VM expiration notification:', error);
      return false;
    }
  }

  async sendModificationNotification(data: {
    action: string;
    itemType: string;
    itemName: string;
    userName: string;
    details: string;
    timestamp: string;
  }) {
    try {
      const settings = await storage.getSystemSettings();
      
      // Check if notifications are enabled
      if (!settings?.enableAdminNotifications) {
        console.log('📧 Email notifications are disabled in system settings');
        return false;
      }
      
      if (!settings?.companyEmail) {
        console.log('❌ No admin email configured for notifications');
        return false;
      }

      console.log(`📧 Preparing to send email notification to: ${settings.companyEmail}`);
      console.log(`📧 Notification type: ${data.action} - ${data.itemType}`);

      const subject = `[SRPH-MIS] ${data.action.toUpperCase()} - ${data.itemType}`;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
            .details { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #2563eb; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            .action-badge { display: inline-block; padding: 5px 10px; border-radius: 3px; font-weight: bold; }
            .action-create { background-color: #10b981; color: white; }
            .action-update { background-color: #f59e0b; color: white; }
            .action-delete { background-color: #ef4444; color: white; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🔔 System Modification Alert</h2>
            </div>
            <div class="content">
              <p>A modification has been made in the system:</p>
              <div class="details">
                <p><strong>Action:</strong> <span class="action-badge action-${data.action.toLowerCase()}">${data.action.toUpperCase()}</span></p>
                <p><strong>Item Type:</strong> ${data.itemType}</p>
                <p><strong>Item Name:</strong> ${data.itemName}</p>
                <p><strong>Modified By:</strong> ${data.userName}</p>
                <p><strong>Details:</strong> ${data.details}</p>
                <p><strong>Timestamp:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
              </div>
              <p>This is an automated notification from SRPH-MIS.</p>
            </div>
            <div class="footer">
              <p>SRPH Management Information System</p>
              <p>This email was sent automatically. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const result = await this.sendEmail({
        to: settings.companyEmail,
        subject,
        html
      });

      if (result) {
        console.log(`✅ Email notification sent successfully to ${settings.companyEmail}`);
      } else {
        console.log(`⚠️ Email notification failed to send`);
      }

      return result;
    } catch (error) {
      console.error('❌ Error sending modification notification:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
