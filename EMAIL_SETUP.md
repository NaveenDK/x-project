# Email Notification Setup

This guide will help you set up email notifications for pending posts in your X Post Manager.

## 🎯 **What You'll Get**

- **Email notifications** when new posts are generated
- **Beautiful HTML emails** with post content and approval link
- **Instant alerts** so you never miss a post to approve

## 📧 **Setup Steps**

### **Step 1: Gmail App Password**

1. **Go to** [Google Account Settings](https://myaccount.google.com/)
2. **Click "Security"** in the left sidebar
3. **Enable 2-Factor Authentication** (if not already enabled)
4. **Go to "App passwords"**
5. **Select "Mail"** and "Other (Custom name)"
6. **Name it** "X Post Manager"
7. **Copy the generated password** (16 characters)

### **Step 2: Add Environment Variables**

Add these to your `.env` file:

```bash
# Email Notifications (Optional)
EMAIL_USER=your.email@gmail.com
EMAIL_PASS=your-16-char-app-password
EMAIL_TO=your.email@gmail.com
```

### **Step 3: Test Email Notifications**

1. **Restart your web server**:
   ```bash
   npm run web
   ```

2. **Generate a test post**:
   - Go to `http://localhost:3031`
   - Click "🤖 Generate Post from Topics"
   - Check your email for the notification

## 🎨 **Email Preview**

You'll receive emails that look like this:

```
🐦 X Post Manager - New Post Ready

Generated Content:
Use Claude Code or Cursor to accelerate debugging: paste your stack trace 
and prompt it to explain the error and suggest a fix. It often spots issues 
faster than manual inspection. Let AI handle the grunt work so you can focus 
on design and logic.

Topic: code with cursor or claude code
Generated: 8/9/2025, 2:58:04 PM
Status: Pending Approval

[🎯 Review & Approve Post] (button)
```

## 🔧 **Configuration Options**

### **Custom Email Service**

To use a different email service (not Gmail), modify the transporter in `src/web-server.ts`:

```typescript
const emailTransporter = nodemailer.createTransport({
  host: 'your-smtp-host.com',
  port: 587,
  secure: false,
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
})
```

### **Multiple Recipients**

To send to multiple email addresses, separate them with commas:

```bash
EMAIL_TO=email1@gmail.com,email2@gmail.com
```

## 🚨 **Troubleshooting**

### **Common Issues**

**"Invalid login" error:**
- Make sure you're using an **App Password**, not your regular Gmail password
- Verify 2-Factor Authentication is enabled
- Check that the email address is correct

**No emails received:**
- Check your spam folder
- Verify `EMAIL_TO` is set correctly
- Check the console logs for email errors

**Gmail blocking emails:**
- Enable "Less secure app access" (not recommended)
- Use App Passwords instead (recommended)

## ✅ **Success Indicators**

**When working correctly, you'll see:**
```
INFO: Email notification sent
  postId: "1754708284758"
  email: "your.email@gmail.com"
```

**And receive emails with:**
- ✅ **Post content** preview
- ✅ **Topic information**
- ✅ **Direct link** to approve/reject
- ✅ **Professional styling**

## 🎉 **You're All Set!**

**Now when posts are generated:**
1. **System creates** AI post automatically
2. **Email notification** sent immediately
3. **You click** the approval link in email
4. **Review and approve** the post
5. **Post goes live** on X!

**No more checking the UI constantly - emails will notify you when it's time to approve posts!** 🚀 