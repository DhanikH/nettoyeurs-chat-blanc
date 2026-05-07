import express from "express";
import { createServer as createViteServer } from "vite";
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import crypto from "crypto";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { randomBytes } from "crypto";
import Stripe from "stripe";
import { parseISO, parse } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

dotenv.config();

// Fallback for crypto.randomUUID if not available (Node < 14.17)
if (!crypto.randomUUID) {
  (crypto as any).randomUUID = () => {
    return ([1e7] as any + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) =>
      (c ^ randomBytes(1)[0] & 15 >> c / 4).toString(16)
    );
  };
}

// Utility function to mask sensitive data
function maskSensitiveData(data: string, type: 'name' | 'email' | 'phone' | 'address'): string {
  if (!data) return data;
  switch (type) {
    case 'name':
      return data.split(' ').map(n => n[0] + 'xxx').join(' ');
    case 'email':
      const [local, domain] = data.split('@');
      return local[0] + 'xxx' + '@' + domain;
    case 'phone':
      return 'xxx-xxx-' + data.slice(-4);
    case 'address':
      const parts = data.split(' ');
      return 'X' + 'x'.repeat(parts[0].length - 1) + ' ' + parts.slice(1).map(p => 'X' + 'x'.repeat(p.length - 1)).join(' ');
    default:
      return data;
  }
}

// Supabase Client setup
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.warn("MISSING: VITE_SUPABASE_URL is not defined in environment variables.");
}
if (!supabaseServiceKey) {
  console.warn("MISSING: VITE_SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables.");
}

const supabase = (supabaseUrl && supabaseServiceKey)
  ? createSupabaseClient(supabaseUrl, supabaseServiceKey)
  : null;

// Stripe setup
let stripeClient: Stripe | null = null;
const getStripe = () => {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      console.warn("MISSING: STRIPE_SECRET_KEY is not defined in environment variables.");
      return null;
    }
    stripeClient = new Stripe(key, {
      apiVersion: '2023-10-16' as any,
    });
  }
  return stripeClient;
};

// Removed initDb as we are now using Supabase and schema is managed externally.

const app = express();
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.path}`);
  next();
});

// Middleware to check if Supabase is configured
app.use((req, res, next) => {
  console.log(`Request path: ${req.path}, Supabase configured: ${!!supabase}`);
  if (!supabase && req.path.startsWith('/api') && req.path !== '/api/health') {
    // For non-critical routes, return empty results instead of 500
    const emptyRoutes = ['/api/notifications', '/api/jobs/pending', '/api/jobs/cleaner', '/api/jobs/homeowner'];
    if (emptyRoutes.some(route => req.path.startsWith(route))) {
      console.log(`Returning empty JSON for ${req.path}`);
      return res.json([]);
    }
    
    console.log(`Returning 500 for ${req.path}`);
    return res.status(500).json({ 
      error: "Supabase not configured", 
      message: "Please add VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY to environment variables in Settings." 
    });
  }
  next();
});

// Block state-changing requests for the demo user
app.use((req, res, next) => {
  const isDemoUser = req.headers['x-user-id'] === 'demo-admin-id';
  const isLoginRoute = req.path === '/api/auth/login';

  if (isDemoUser && req.method !== 'GET' && !isLoginRoute) {
    return res.status(403).json({ 
      error: "Action disabled in Demo Mode. You have read-only access to view the dashboard." 
    });
  }
  
  next();
});

// Email Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail(to: string, subject: string, text: string) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`[Email Mock] To: ${to}, Subject: ${subject}, Message: ${text}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    console.log(`[Email] Sent to ${to}`);
  } catch (err) {
    console.error("[Email] Error sending email:", err);
  }
}

async function sendSMS(to: string, message: string) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log(`[SMS Mock] To: ${to}, Message: ${message}`);
    return;
  }
  // This is where you would integrate with Twilio or another SMS provider
  // Example with Twilio (requires 'twilio' package):
  // const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await client.messages.create({ body: message, from: process.env.TWILIO_FROM_NUMBER, to });
  console.log(`[SMS] Sent to ${to}`);
}

// Helper to create notifications
async function createNotification(message: string, title: string, targetRole?: string, targetUserId?: string, type: string = 'info') {
  console.log(`[Notification] Creating: title='${title}', type='${typeof title}', message='${message}', targetRole='${targetRole}', targetUserId='${targetUserId}', type='${type}'`);
  if (!title) {
    console.error("[Notification] Title is missing! Arguments:", { message, title, targetRole, targetUserId, type });
    throw new Error("Title is missing in createNotification!");
  }
  if (!supabase) {
    console.warn("[Notification] Supabase not configured, skipping notification creation.");
    return;
  }
  try {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    const notificationData = {
        id,
        user_id: targetUserId || null,
        target_role: targetRole || null,
        message,
        title,
        type,
        created_at: createdAt
      };
    console.log("[Notification] Inserting:", notificationData);

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notificationData);

    if (insertError) throw insertError;
    
    console.log(`[Notification] Created: ${message} for ${targetRole || targetUserId || 'everyone'}`);

    // Send external notifications based on preferences
    let usersToNotify: any[] = [];
    if (targetUserId) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('contact_email, phone_number, preferences')
        .eq('id', targetUserId)
        .maybeSingle();
      
      if (user && !userError) usersToNotify.push(user);
    } else if (targetRole) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('contact_email, phone_number, preferences')
        .eq('role_designation', targetRole);
      
      if (users && !usersError) usersToNotify = users;
    }

    for (const user of usersToNotify) {
      let prefs: any = {};
      try {
      try {
        prefs = user.preferences ? JSON.parse(user.preferences) : {};
      } catch (e) {
        console.error("Error parsing user preferences:", e);
        prefs = {};
      }
      } catch (e) {
        console.error(`[Notification] Error parsing preferences for user ${user.id}:`, e);
      }
      
      // Only send external notifications if the main toggle is ON
      if (prefs && prefs.notifications) {
        /*
        if (prefs.email_notifications && user.contact_email) {
          sendEmail(user.contact_email, "New Notification - CleanApp", message);
        }
        */
        
        /*
        if (prefs.sms_notifications && user.phone_number) {
          sendSMS(user.phone_number, message);
        }
        */
      }
    }
  } catch (err) {
    console.error("[Notification] Error creating notification:", err instanceof Error ? err.message : JSON.stringify(err));
  }
}

app.get("/api/notifications", async (req, res) => {
  const userId = req.query.userId as string;
  if (!userId || userId === 'undefined') {
    console.log("[API] Missing userId");
    return res.status(400).json({ error: "Missing userId" });
  }

  if (userId === 'demo-admin-id') {
    return res.json([]);
  }

  console.log(`[API] Fetching notifications for user: ${userId}`);
  res.setHeader('Content-Type', 'application/json');
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role_designation')
      .eq('id', userId)
      .maybeSingle();
    
    if (userError || !user) {
      console.log(`[API] User not found or error: ${userError?.message}`);
      // If user not found, return empty notifications instead of 404
      // This handles stale sessions gracefully
      return res.json([]);
    }

    const { data: notifications, error: notifyError } = await supabase
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${userId},target_role.eq.${user.role_designation},and(user_id.is.null,target_role.is.null)`)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (notifyError) throw notifyError;
    
    console.log(`[API] Returning ${notifications?.length || 0} notifications for user: ${userId}`);
    res.json(notifications);
  } catch (err: any) {
    console.error("[API] Error in /api/notifications", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/notifications/read-all/:userId", async (req, res) => {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role_designation')
      .eq('id', req.params.userId)
      .maybeSingle();
    
    if (userError || !user) return res.status(404).json({ error: "User not found" });

    const { error: updateError } = await supabase
      .from('notifications')
      .update({ is_read: 1 })
      .or(`user_id.eq.${req.params.userId},target_role.eq.${user.role_designation}`);
    
    if (updateError) throw updateError;
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/notifications/:id/read", async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: 1 })
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/applications/history", async (req, res, next) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { data: applications, error } = await supabase
      .from('users')
      .select('id, full_name, contact_email, phone_number, is_approved, created_at, bio, profile_picture, cv, is_deleted')
      .eq('role_designation', 'cleaner')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const processed = applications.map(app => ({
      ...app,
      is_deleted: app.is_deleted || 0
    }));
    
    const isDemo = req.headers["x-user-id"] === "demo-admin-id";
    const processedMasked = isDemo ? processed.map(a => ({
      ...a,
      contact_email: maskSensitiveData(a.contact_email, 'email'),
      full_name: maskSensitiveData(a.full_name, 'name'),
      phone_number: maskSensitiveData(a.phone_number, 'phone'),
    })) : processed;

    res.json(processedMasked);
  } catch (err) {
    next(err);
  }
});

// Simple Auth
app.post("/api/auth/register", async (req, res) => {
  const { email, password, role, full_name, phone_number, address, bio, profile_picture, cv, preferences } = req.body;
  if (!email || !password || !role || !full_name || !phone_number) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Basic email validation
  if (!email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: "Please enter a valid email address" });
  }
  
  if (role === 'cleaner' && !cv) {
    return res.status(400).json({ error: "CV is required for cleaner applications" });
  }
  
  try {
    // Check if email already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, is_approved, role_designation, is_deleted, password')
      .eq('contact_email', email)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existingUser) {
      if (existingUser.role_designation === 'cleaner' && (existingUser.is_approved === 0 || existingUser.is_approved === 2 || (existingUser.is_deleted ?? 0) === 1)) {
        // Allow re-application by updating the existing record and resetting is_deleted
        const passwordToSet = password === "RE-SUBMISSION" ? existingUser.password : password;
        
        const { error: updateError } = await supabase
          .from('users')
          .update({
            password: passwordToSet,
            full_name,
            phone_number,
            address: address || null,
            bio: bio || null,
            profile_picture: profile_picture || null,
            cv: cv || null,
            preferences: preferences || null,
            is_approved: 0,
            is_deleted: 0,
            created_at: new Date().toISOString()
          })
          .eq('id', existingUser.id);

        if (updateError) throw updateError;
        
        createNotification(`New cleaner application (re-submission) received from ${full_name} (${email})`, 'New Application', 'admin');
        return res.json({ id: existingUser.id, role: 'cleaner', email, full_name, profile_picture, cv, loyalty_subscription_tier: 'none', is_approved: false });
      } else {
        return res.status(400).json({ error: "An account with this email already exists. Please try logging in instead." });
      }
    }

    const id = crypto.randomUUID();
    const is_approved = role === 'cleaner' ? 0 : 1;
    const created_at = new Date().toISOString();
    
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id,
        role_designation: role,
        contact_email: email,
        password,
        is_approved,
        full_name,
        phone_number,
        address: address || null,
        bio: bio || null,
        profile_picture: profile_picture || null,
        cv: cv || null,
        preferences: preferences || null,
        created_at
      });

    if (insertError) throw insertError;
    
    if (role === 'cleaner') {
      createNotification(`New cleaner application received from ${full_name} (${email})`, 'New Application', 'admin');
    }
    
    res.json({ id, role, email, full_name, profile_picture, loyalty_subscription_tier: 'none', is_approved: !!is_approved });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log(`Login attempt for ${email}`);

    // Temporary access restriction
    const blockedEmails = ['demo@whitecat.com', 'testcleaner2@whitecat.com', 'testowner2@whitecat.com', 'testcleaner2', 'testowner2'];
    if (blockedEmails.some(blocked => email.toLowerCase().includes(blocked.toLowerCase()))) {
      return res.status(403).json({ error: "Access temporarily disabled for this account." });
    }
    
    // Check for admin override
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        // Return a mock admin user
        return res.json({ 
            id: '11111111-1111-1111-1111-111111111111', 
            role: 'admin', 
            email: email, 
            full_name: 'Admin', 
            loyalty_subscription_tier: 'none', 
            is_approved: true 
        });
    }

    // Check for demo admin override
    if (email === 'demo@whitecat.com' && password === 'demo') {
        return res.json({ id: 'demo-admin-id', role: 'admin', email: 'demo@whitecat.com', full_name: 'Demo Buyer', loyalty_subscription_tier: 'none', is_approved: true });
    }

    if (!supabase) {
        console.error("Supabase client is not initialized");
        return res.status(500).json({ error: "Supabase client is not initialized" });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .or(`contact_email.eq.${email},phone_number.eq.${email}`)
      .eq('password', password)
      .eq('is_deleted', 0)
      .maybeSingle();

    if (error) {
        console.error(`Supabase login error: ${error.message} (Code: ${error.code}, Hint: ${error.hint})`);
        throw error;
    }

    if (user) {
      res.json({ id: user.id, role: user.role_designation, email: user.contact_email, full_name: user.full_name, loyalty_subscription_tier: user.loyalty_subscription_tier, is_approved: !!user.is_approved });
    } else {
      res.status(401).json({ error: "Invalid credentials or account deactivated" });
    }
  } catch (err: any) {
    console.error("Login error:", err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err, null, 2) : String(err)));
    next(err);
  }
});

async function getCleanerStats(cleanerId: string, abandonedCount?: number) {
  // Get all completed jobs for the cleaner
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, rating, scheduled_date')
    .eq('cleaner_id', cleanerId)
    .eq('job_lifecycle_status', 'completed')
    .order('scheduled_date', { ascending: false });

  if (jobsError) throw jobsError;

  // Rolling rating (last 20 rated jobs)
  const ratedRecentJobs = jobs.filter(job => job.rating !== null).slice(0, 20);
  const rollingRating = ratedRecentJobs.length > 0 
    ? ratedRecentJobs.reduce((acc, job) => acc + job.rating, 0) / ratedRecentJobs.length 
    : 0;

  const totalJobs = jobs.length;
  const totalReviews = jobs.filter(j => j.rating !== null).length;

  let finalAbandonedCount = abandonedCount;
  if (finalAbandonedCount === undefined) {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('abandoned_count')
      .eq('id', cleanerId)
      .maybeSingle();
    if (userError) throw userError;
    finalAbandonedCount = user?.abandoned_count || 0;
  }

  let level = "Starter";
  let split = 45;

  if (totalJobs >= 61 && rollingRating >= 4.6) {
    level = "Elite";
    split = 60;
  } else if (totalJobs >= 26 && rollingRating >= 4.5) {
    level = "Master";
    split = 56;
  } else if (totalJobs >= 11 && rollingRating >= 4.4) {
    level = "Expert";
    split = 52;
  } else if (totalJobs >= 3 && rollingRating >= 4.3) {
    level = "Intermediate";
    split = 48;
  }

  return { averageRating: rollingRating, totalReviews, totalJobs, level, split, abandonedCount: finalAbandonedCount };
}

app.get("/api/customers/:id/notes", async (req, res, next) => {
  try {
    const { data: notes, error } = await supabase
      .from('customernotes')
      .select(`
        *,
        users!fk_author (
          full_name
        )
      `)
      .eq('customer_id', req.params.id)
      .order('created_at', { ascending: false });

    console.log(`[Notes] Fetched ${notes?.length || 0} notes for customer ${req.params.id}`);
    if (error) {
      console.error(`[Notes] Error fetching notes: ${error.message}`);
      throw error;
    }

    const processed = notes.map((note: any) => ({
      ...note,
      content: note.note_content,
      author_name: note.users?.full_name
    }));

    console.log(`[Notes] Processed ${processed.length} notes`);
    res.json(processed);
  } catch (err) {
    next(err);
  }
});

app.post("/api/customers/:id/notes", async (req, res, next) => {
  try {
    const { author_id, content } = req.body;
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();
    
    const { error } = await supabase
      .from('customernotes')
      .insert({
        id,
        customer_id: req.params.id,
        author_id,
        note_content: content,
        created_at
      });

    console.log(`[Notes] Added note for customer ${req.params.id} by author ${author_id}`);
    if (error) {
      console.error(`[Notes] Error adding note: ${error.message}`);
      throw error;
    }
    
    res.json({ id, customer_id: req.params.id, author_id, content, created_at });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/customer-notes/:id", async (req, res, next) => {
  try {
    const { author_id, user_role } = req.body;
    
    let query = supabase.from('customernotes').delete().eq('id', req.params.id);

    if (user_role !== 'admin') {
      query = query.eq('author_id', author_id);
    }

    const { error, count } = await query.select();

    if (error) throw error;

    if (count && count > 0) {
      res.json({ success: true });
    } else {
      res.status(403).json({ error: "Unauthorized or note not found" });
    }
  } catch (err) {
    next(err);
  }
});

app.get("/api/admin/users/all", async (req, res, next) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { data: users, error } = await supabase
      .from('users')
      .select('id, contact_email, role_designation, full_name, phone_number, bio, address, cv, is_approved, is_deleted, created_at, profile_picture')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const processed = users.map(u => ({
      ...u,
      is_deleted: u.is_deleted || 0
    }));

    const isDemo = req.headers["x-user-id"] === "demo-admin-id";
    const processedMasked = isDemo ? processed.map(u => ({
      ...u,
      contact_email: maskSensitiveData(u.contact_email, 'email'),
      full_name: maskSensitiveData(u.full_name, 'name'),
      phone_number: maskSensitiveData(u.phone_number, 'phone'),
      address: u.address ? maskSensitiveData(u.address, 'address') : null,
    })) : processed;

    res.json(processedMasked);
  } catch (err) {
    next(err);
  }
});

app.post("/api/admin/users/:id/approve", async (req, res, next) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { error } = await supabase
      .from('users')
      .update({ is_approved: 1 })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.post("/api/admin/users/:id/restore", async (req, res, next) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { error } = await supabase
      .from('users')
      .update({ is_deleted: 0 })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.post("/api/jobs/:id/accept-quote", async (req, res) => {
  try {
    const { error } = await supabase
      .from('jobs')
      .update({ job_lifecycle_status: 'pending_claim' })
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs/:id/reject-quote", async (req, res) => {
  try {
    const updateData = { job_lifecycle_status: 'homeowner_rejected' };
    console.log("[Admin] Rejecting job", req.params.id, "with data:", updateData);

    const { error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/jobs/:id/update-quote", async (req, res) => {
  try {
    const { calculated_base_price } = req.body;
    
    if (calculated_base_price === undefined) {
      return res.status(400).json({ error: "Missing calculated_base_price" });
    }

    const { error } = await supabase
      .from('jobs')
      .update({ calculated_base_price })
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error("[API ERROR] Error in /api/jobs/:id/update-quote", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/jobs/:id/update-date", async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { new_date } = req.body;

    // Get the current job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('scheduled_date, special_instructions')
      .eq('id', req.params.id)
      .single();

    if (jobError) throw jobError;

    // Parse special_instructions
    let instructions: any = {};
    try {
      instructions = JSON.parse(job.special_instructions || "{}");
    } catch (e) {
      console.error("Error parsing special_instructions", e);
    }

    // Store original_scheduled_date if not already set
    if (!(instructions as any).original_scheduled_date) {
      (instructions as any).original_scheduled_date = job.scheduled_date;
    }
    (instructions as any).last_modified_date = new_date;

    const { error } = await supabase
      .from('jobs')
      .update({ 
        scheduled_date: new_date,
        special_instructions: JSON.stringify(instructions)
      })
      .eq('id', req.params.id);
    
    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/jobs/:id/toggle-completed", async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    // Get current job status
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('job_lifecycle_status')
      .eq('id', req.params.id)
      .single();

    if (jobError) throw jobError;

    const newStatus = job.job_lifecycle_status === 'completed' ? 'claimed_scheduled' : 'completed';

    const { error } = await supabase
      .from('jobs')
      .update({ job_lifecycle_status: newStatus })
      .eq('id', req.params.id);
    
    if (error) throw error;

    res.json({ success: true, newStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/admin/jobs/:id/update-all", async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { final_transaction_price, final_cleaner_payout, custom_bonus } = req.body;

    const updateData: any = {};
    if (final_transaction_price !== undefined) updateData.final_transaction_price = final_transaction_price;
    if (final_cleaner_payout !== undefined) updateData.final_cleaner_payout = final_cleaner_payout;
    if (custom_bonus !== undefined) updateData.custom_bonus = custom_bonus;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const { error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', req.params.id);
    
    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    console.error("[API ERROR] Error in /api/admin/jobs/:id/update-all", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/jobs/:id/remove-cleaner", async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { strike } = req.body;

    // Get the cleaner_id first
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('cleaner_id')
      .eq('id', req.params.id)
      .single();

    if (jobError) throw jobError;

    const { error } = await supabase
      .from('jobs')
      .update({ cleaner_id: null, job_lifecycle_status: 'pending_claim' })
      .eq('id', req.params.id);
    
    if (error) throw error;

    if (strike && job.cleaner_id) {
        const { data: user } = await supabase.from('users').select('abandoned_count').eq('id', job.cleaner_id).maybeSingle();
        await supabase.from('users').update({ abandoned_count: (user?.abandoned_count || 0) + 1 }).eq('id', job.cleaner_id);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin endpoints
app.get("/api/admin/charges", async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { data, error } = await supabase
      .from('charges')
      .select('*, users(full_name, contact_email)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/charges/:id/pay", async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { error } = await supabase
      .from('charges')
      .update({ status: 'paid' })
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/cleaners", async (req, res, next) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { data: cleaners, error } = await supabase
      .from('users')
      .select('id, contact_email, is_approved, is_deleted, full_name, phone_number, bio, abandoned_count, created_at, profile_picture, cv')
      .eq('role_designation', 'cleaner');

    if (error) throw error;

    const cleanersWithStats = await Promise.all(cleaners.map(async cleaner => {
      const stats = await getCleanerStats(cleaner.id, cleaner.abandoned_count);
      return { ...cleaner, ...stats, is_deleted: cleaner.is_deleted || 0 };
    }));

    const isDemo = req.headers["x-user-id"] === "demo-admin-id";
    const processedCleaners = isDemo ? cleanersWithStats.map(c => ({
      ...c,
      contact_email: maskSensitiveData(c.contact_email, 'email'),
      full_name: maskSensitiveData(c.full_name, 'name'),
      phone_number: maskSensitiveData(c.phone_number, 'phone'),
    })) : cleanersWithStats;

    res.json(processedCleaners);
  } catch (err) {
    next(err);
  }
});

app.get("/api/admin/bad-ratings", async (req, res) => {
  const userRole = req.headers["x-user-role"];
  if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

  const { data: badRatings, error } = await supabase
    .from('jobs')
    .select(`
      id, 
      rating, 
      review_comment, 
      scheduled_date,
      Cleaner:cleaner_id (
        contact_email,
        full_name,
        profile_picture
      ),
      Homeowner:homeowner_id (
        contact_email,
        full_name,
        profile_picture
      )
    `)
    .lte('rating', 3)
    .order('scheduled_date', { ascending: false });

  if (error) throw error;

  const processed = badRatings.map((job: any) => ({
    ...job,
    cleaner_email: job.Cleaner?.contact_email,
    cleaner_name: job.Cleaner?.full_name,
    cleaner_picture: job.Cleaner?.profile_picture,
    homeowner_email: job.Homeowner?.contact_email,
    homeowner_name: job.Homeowner?.full_name,
    homeowner_picture: job.Homeowner?.profile_picture
  }));

  res.json(processed);
});

app.get("/api/admin/jobs", async (req, res) => {
  const userRole = req.headers["x-user-role"];
  if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select(`
      *, 
      properties (
        square_feet, 
        bedrooms, 
        bathrooms,
        address
      ),
      Homeowner:homeowner_id (
        contact_email,
        full_name,
        profile_picture
      ),
      Cleaner:cleaner_id (
        contact_email,
        full_name,
        profile_picture
      ),
      job_media(*)
    `)
    .order('scheduled_date', { ascending: true });

  if (error) throw error;

  const processed = jobs.map((job: any) => ({
    ...job,
    square_feet: job.properties?.square_feet,
    bedrooms: job.properties?.bedrooms,
    bathrooms: job.properties?.bathrooms,
    address: job.properties?.address,
    homeowner_email: job.Homeowner?.contact_email,
    homeowner_name: job.Homeowner?.full_name,
    homeowner_picture: job.Homeowner?.profile_picture,
    cleaner_email: job.Cleaner?.contact_email,
    cleaner_name: job.Cleaner?.full_name,
    cleaner_picture: job.Cleaner?.profile_picture
  }));

  const isDemo = req.headers["x-user-id"] === "demo-admin-id";
  const processedMasked = isDemo ? processed.map((j: any) => ({
      ...j,
      homeowner_email: maskSensitiveData(j.homeowner_email, 'email'),
      homeowner_name: maskSensitiveData(j.homeowner_name, 'name'),
      cleaner_email: maskSensitiveData(j.cleaner_email, 'email'),
      cleaner_name: maskSensitiveData(j.cleaner_name, 'name'),
      address: maskSensitiveData(j.address, 'address'),
  })) : processed;

  res.json(processedMasked);
});

app.delete("/api/properties/:id", async (req, res, next) => {
  try {
    const { owner_id } = req.body;
    // console.log("[DELETE] req.body:", req.body);
    if (!owner_id) {
        return res.status(400).json({ error: "Missing owner_id" });
    }
    // console.log(`[DELETE] Property ID: ${req.params.id}, Owner ID: ${owner_id}`);
    
    // Delete associated jobs first
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id')
      .eq('property_id', req.params.id);
      
    if (jobs && jobs.length > 0) {
        const jobIds = jobs.map((j: any) => j.id);
        // Delete job assignments
        await supabase
            .from('JobAssignments')
            .delete()
            .in('job_id', jobIds);
            
        // Delete jobs
        await supabase
            .from('jobs')
            .delete()
            .in('id', jobIds);
    }

    // Delete associated subscriptions
    await supabase
        .from('subscriptions')
        .delete()
        .eq('property_id', req.params.id);

    const { error, data } = await supabase
      .from('properties')
      .delete()
      .eq('id', req.params.id)
      .eq('owner_id', owner_id)
      .select();

    // console.log(`[DELETE] Result: error=${JSON.stringify(error)}, data=${JSON.stringify(data)}`);

    if (error) throw error;
    
    if (!data || data.length === 0) {
        return res.status(404).json({ error: "Property not found or unauthorized" });
    }
    
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.put("/api/properties/:id", async (req, res, next) => {
  try {
    console.log("[PUT] /api/properties/:id req.body:", req.body);
    const { owner_id, address, postal_code, square_feet, bedrooms, bathrooms, living_rooms, kitchens, offices, preferred_time, has_pets, entry_instructions } = req.body;
    
    if (!owner_id) {
        return res.status(400).json({ error: "Missing owner_id" });
    }
    
    const { error, data } = await supabase
      .from('properties')
      .update({
        address: address || null,
        postal_code: postal_code || null,
        square_feet,
        bedrooms,
        bathrooms,
        living_rooms,
        kitchens,
        offices: offices || 0,
        preferred_time: preferred_time || null,
        has_pets: has_pets || false,
        entry_instructions: entry_instructions || null
      })
      .eq('id', req.params.id)
      .eq('owner_id', owner_id)
      .select();

    if (error) {
      console.error("[PUT] /api/properties/:id Supabase error (detailed):", JSON.stringify(error, null, 2));
      throw error;
    }
    
    if (!data || data.length === 0) {
        return res.status(404).json({ error: "Property not found or unauthorized" });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error("[PUT] /api/properties/:id Error:", err);
    next(err);
  }
});

app.get("/api/admin/properties", async (req, res) => {
  const userRole = req.headers["x-user-role"];
  if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

  const { data: properties, error } = await supabase
    .from('properties')
    .select(`
      *,
      users!properties_owner_id_fkey (
        contact_email
      )
    `);

  if (error) throw error;

  const processed = properties.map((prop: any) => ({
    ...prop,
    owner_email: prop.users?.contact_email
  }));

  const isDemo = req.headers["x-user-id"] === "demo-admin-id";
  const processedMasked = isDemo ? processed.map((p: any) => ({
    ...p,
    owner_email: maskSensitiveData(p.owner_email, 'email'),
    address: p.address ? maskSensitiveData(p.address, 'address') : null,
  })) : processed;

  res.json(processedMasked);
});

app.post("/api/admin/cleaners/:id/approve", async (req, res) => {
  const userRole = req.headers["x-user-role"];
  if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

  const { data: userData, error: fetchError } = await supabase
    .from('users')
    .select('contact_email, full_name')
    .eq('id', req.params.id)
    .single();

  if (fetchError) throw fetchError;

  const { data, error } = await supabase
    .from('users')
    .update({ is_approved: 1 })
    .eq('id', req.params.id)
    .eq('role_designation', 'cleaner')
    .select();

  if (error) throw error;

  if (data && data.length > 0) {
    createNotification("Your cleaner application has been approved! You can now start claiming jobs.", 'Application Approved', undefined, req.params.id);
    
    if (userData?.contact_email) {
      sendEmail(
        userData.contact_email,
        "Application Approved - Sparkle & Shine",
        `Hello ${userData.full_name || 'Cleaner'},\n\nCongratulations! Your application to join Sparkle & Shine has been approved. You can now log in to your dashboard and start claiming cleaning jobs.\n\nWelcome to the team!`
      );
    }
    
    res.json({ success: true });
  } else {
    res.status(400).json({ error: "Could not approve cleaner" });
  }
});

app.post("/api/admin/cleaners/:id/reject", async (req, res) => {
  const userRole = req.headers["x-user-role"];
  if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

  const { error, count } = await supabase
    .from('users')
    .update({ is_approved: 2 })
    .eq('id', req.params.id)
    .eq('role_designation', 'cleaner')
    .eq('is_approved', 0)
    .select();

  if (error) throw error;

  if (count && count > 0) {
    res.json({ success: true });
  } else {
    res.status(400).json({ error: "Could not reject cleaner" });
  }
});

// Properties
app.get("/api/properties/:userId", async (req, res) => {
  const { data: properties, error } = await supabase
    .from('properties')
    .select('*')
    .eq('owner_id', req.params.userId);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(properties);
});

app.post("/api/properties", async (req, res) => {
  const { owner_id, address, postal_code, square_feet, bedrooms, bathrooms, living_rooms, kitchens, offices, preferred_time, has_pets, entry_instructions } = req.body;
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  
  const { error } = await supabase
    .from('properties')
    .insert({
      id,
      owner_id,
      address: address || null,
      postal_code: postal_code || null,
      square_feet,
      bedrooms,
      bathrooms,
      living_rooms,
      kitchens,
      offices: offices || 0,
      preferred_time: preferred_time || null,
      has_pets: has_pets || false,
      entry_instructions: entry_instructions || null,
      created_at
    });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ id, owner_id, address, square_feet, bedrooms, bathrooms, living_rooms, kitchens, offices, entry_instructions, preferred_time, has_pets, created_at });
});

// Jobs
app.post("/api/test-payment", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 50, // 50 cents
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: any) {
    console.error("Error creating test payment:", err);
    res.status(500).json({ error: err.message });
  }
});


async function generateFutureJobs(originalJob: any, frequency: string, count: number = 4) {
  console.log(`[generateFutureJobs] Generating ${count} jobs for subscription ${originalJob.subscription_id}`);
  const { data: lastJob } = await supabase
    .from('jobs')
    .select('scheduled_date')
    .eq('subscription_id', originalJob.subscription_id)
    .order('scheduled_date', { ascending: false })
    .limit(1)
    .single();

  let lastDate = lastJob ? new Date(lastJob.scheduled_date) : new Date(originalJob.scheduled_date);
  console.log(`[generateFutureJobs] Last job date: ${lastDate}`);

  for (let i = 0; i < count; i++) {
    const nextDate = new Date(lastDate);
    if (frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
    else if (frequency === 'biweekly') nextDate.setDate(nextDate.getDate() + 14);
    else if (frequency === 'monthly') {
        const originalDay = lastDate.getDate();
        nextDate.setMonth(nextDate.getMonth() + 1);
        // If the day changed (e.g., Jan 31 -> Feb 28), set it back to the original day if possible
        if (nextDate.getDate() !== originalDay) {
            const daysInNewMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
            nextDate.setDate(Math.min(originalDay, daysInNewMonth));
        }
    }
    
    console.log(`[generateFutureJobs] Generating job for date: ${nextDate.toISOString()}`);
    
    // --- THE BULLETPROOF WHITELIST ---
    const cleanJobData = {
        id: crypto.randomUUID(),
        property_id: originalJob.property_id,
        homeowner_id: originalJob.homeowner_id,
        subscription_id: originalJob.subscription_id,
        scheduled_date: nextDate.toISOString(),
        scheduled_end_date: originalJob.scheduled_end_date || null,
        calculated_base_price: originalJob.calculated_base_price,
        final_transaction_price: originalJob.final_transaction_price,
        job_lifecycle_status: 'pending_claim',
        special_instructions: originalJob.special_instructions || null,
        window_cleaning: originalJob.window_cleaning || 0,
        oven_cleaning: originalJob.oven_cleaning || 0,
        deep_cleaning: originalJob.deep_cleaning || 0,
        frequency: originalJob.frequency,
        stripe_customer_id: originalJob.stripe_customer_id,
        payment_method_id: originalJob.payment_method_id,
        created_at: new Date().toISOString()
    };
    
    const { error } = await supabase.from('jobs').insert(cleanJobData);
    
    if (error) {
        console.error(`[generateFutureJobs] FATAL Database Error: ${error.message}`);
        throw new Error(`Failed to create future job: ${error.message}`);
    }
    lastDate = nextDate;
  }
}

app.post("/api/jobs", async (req, res) => {
  try {
    const { 
      property_id, 
      homeowner_id, 
      scheduled_date, 
      scheduled_end_date,
      calculated_base_price, 
      final_transaction_price, 
      special_instructions,
      window_cleaning,
      oven_cleaning,
      deep_cleaning,
      frequency
    } = req.body;
    const id = crypto.randomUUID();
    const parsedInstructions = special_instructions ? (typeof special_instructions === 'string' ? JSON.parse(special_instructions) : special_instructions) : {};
    console.log("DEBUG: special_instructions:", special_instructions, "parsed:", parsedInstructions);
    const status = (parsedInstructions.instructions && parsedInstructions.instructions.trim() !== '') ? 'pending_quote' : 'pending_claim';
    console.log("DEBUG: status:", status);
    const created_at = new Date().toISOString();
    
    // Fetch postal_code, entry_instructions, preferred_time, and has_pets
    const { data: property } = await supabase
      .from('properties')
      .select('postal_code, entry_instructions, preferred_time, has_pets')
      .eq('id', property_id)
      .single();
      
    const postal_code = property?.postal_code;
    const entry_instructions = property?.entry_instructions;
    const preferred_time = property?.preferred_time;
    const has_pets = property?.has_pets;
    
    // Merge entry_instructions, preferred_time, and has_pets into parsedInstructions
    parsedInstructions.entry_instructions = entry_instructions;
    parsedInstructions.preferred_time = preferred_time;
    parsedInstructions.has_pets = has_pets;
    
    // Check if user has a credit card linked
    const { data: user } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', homeowner_id)
      .single();

    if (!user || !user.stripe_customer_id) {
      return res.status(402).json({ error: "No payment method linked to account" });
    }

    const stripe = getStripe();
    let paymentMethodId = null;
    if (stripe) {
      try {
        const paymentMethods = await stripe.customers.listPaymentMethods(user.stripe_customer_id);
        if (paymentMethods.data.length === 0) {
          return res.status(402).json({ error: "No payment method linked to account" });
        }
        paymentMethodId = paymentMethods.data[0].id;
      } catch (err: any) {
        if (err.type === 'StripeInvalidRequestError' && err.code === 'resource_missing') {
            console.error(`Stripe customer ${user.stripe_customer_id} not found.`);
            await supabase.from('users').update({ stripe_customer_id: null }).eq('id', homeowner_id);
            return res.status(402).json({ error: "Payment method invalid, please re-link." });
        }
        throw err;
      }
    }
    
    let subscription_id = null;
    let discount = 0;
    let min_commit = 0;

    if (frequency && frequency !== 'none') {
      if (frequency === 'monthly') { min_commit = 4; }
      else if (frequency === 'biweekly') { min_commit = 8; }
      else if (frequency === 'weekly') { min_commit = 16; }

      // Check for existing active subscription for this property and frequency
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('homeowner_id', homeowner_id)
        .eq('property_id', property_id)
        .eq('frequency', frequency)
        .eq('status', 'active')
        .maybeSingle();

      if (existingSub) {
        subscription_id = existingSub.id;
      } else {
        // Create new subscription
        const subId = crypto.randomUUID();
        const { error: subError } = await supabase
          .from('subscriptions')
          .insert({
            id: subId,
            homeowner_id,
            property_id,
            frequency,
            completed_cleanings: 0,
            total_discount_received: 0,
            status: 'active',
            minimum_payments_required: min_commit
          });
        if (subError) throw subError;
        subscription_id = subId;
      }
    }

    const deposit_amount = final_transaction_price * 0.4;

    const { error } = await supabase
      .from('jobs')
      .insert({
        id,
        property_id: property_id || null,
        homeowner_id: homeowner_id || null,
        scheduled_date,
        scheduled_end_date: scheduled_end_date || null,
        calculated_base_price,
        final_transaction_price: final_transaction_price,
        job_lifecycle_status: status,
        special_instructions: JSON.stringify(parsedInstructions),
        homeowner_preferences: JSON.stringify(parsedInstructions),
        window_cleaning: window_cleaning ? 1 : 0,
        oven_cleaning: oven_cleaning ? 1 : 0,
        deep_cleaning: deep_cleaning ? 1 : 0,
        frequency: frequency || 'none',
        stripe_customer_id: user.stripe_customer_id,
        payment_method_id: paymentMethodId,
        subscription_id: subscription_id || null,
        created_at
      });

    if (error) throw error;

    if (subscription_id) {
        const { data: originalJob } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', id)
            .single();
        if (originalJob) {
            await generateFutureJobs(originalJob, frequency, 4);
        }
    }

    res.json({ id });
  } catch (err: any) {
    console.error("Error creating job:", err instanceof Error ? err.message : JSON.stringify(err));
    res.status(500).json({ error: err.message || "Failed to create job" });
  }
});

app.post("/api/jobs/cancel-subscription", async (req, res) => {
  try {
    console.log("req.body:", req.body);
    const { subscription_id, homeowner_id } = req.body;
    if (!subscription_id || !homeowner_id) {
      console.log("Missing subscription_id or homeowner_id:", req.body);
      return res.status(400).json({ error: "Subscription ID and Homeowner ID required" });
    }

    // Get subscription details
    console.log("Fetching subscription:", subscription_id, "for homeowner:", homeowner_id);
    if (!supabase) {
      console.error("Supabase client not initialized");
      return res.status(500).json({ error: "Supabase client not initialized" });
    }
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', subscription_id)
      .eq('homeowner_id', homeowner_id)
      .eq('status', 'active')
      .maybeSingle();
    
    if (subError) {
      console.error("Supabase error fetching subscription:", subError);
    }

    if (subError || !sub) {
      console.log("Subscription not found or not active");
      return res.status(404).json({ error: "Active subscription not found" });
    }
    console.log("Subscription found:", sub);

    // Define minimum commitments
    const minCommitments: Record<string, number> = {
      'monthly': 4,
      'biweekly': 8,
      'weekly': 16
    };

    const minRequired = minCommitments[sub.frequency] || 0;
    let fee = 0;

    if (sub.completed_cleanings < minRequired) {
      // Early cancellation - calculate fee (total discounts received)
      fee = sub.total_discount_received || 0;
    }

    // Cancel subscription
    console.log("Cancelling subscription:", subscription_id);
    const { error: cancelError } = await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', subscription_id);

    if (cancelError) {
      console.error("Supabase error cancelling subscription:", cancelError);
      throw cancelError;
    }
    console.log("Subscription cancelled successfully.");

    // Delete future, unclaimed jobs
    console.log("Deleting future, unclaimed jobs for subscription:", subscription_id);
    const { error: deleteError, count } = await supabase
      .from('jobs')
      .delete({ count: 'exact' })
      .eq('subscription_id', subscription_id)
      .eq('job_lifecycle_status', 'pending_claim');

    if (deleteError) {
      console.error("Supabase error deleting jobs:", deleteError);
      throw deleteError;
    }
    console.log("Deleted", count, "jobs.");

    // If there's a fee, log it and charge it
    if (fee > 0) {
      const chargeId = crypto.randomUUID();
      
      // Get user's stripe customer id
      const { data: user } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('id', homeowner_id)
        .single();
        
      let status = 'pending';
      if (user && user.stripe_customer_id) {
        const stripe = getStripe();
        if (stripe) {
          try {
            await stripe.paymentIntents.create({
              amount: Math.round(fee * 100),
              currency: 'cad',
              customer: user.stripe_customer_id,
              off_session: true,
              confirm: true,
              description: `Pricing adjustment fee for subscription ${subscription_id}`
            });
            status = 'paid';
          } catch (err) {
            console.error("[CancelSub] Stripe charge failed:", err);
            status = 'failed';
          }
        }
      }

      await supabase
        .from('charges')
        .insert({
          id: chargeId,
          user_id: homeowner_id,
          subscription_id: subscription_id,
          amount: fee,
          reason: `Pricing Adjustment Fee for early cancellation of ${sub.frequency} plan (${sub.completed_cleanings}/${minRequired} cleanings completed)`,
          status: status
        });

      // Also create a notification for the user
      await createNotification(
        `Your ${sub.frequency} subscription has been cancelled. An early cancellation fee of $${fee.toFixed(2)} has been applied to your account.`,
        'Subscription Cancelled',
        'homeowner',
        homeowner_id
      );
    } else {
      await createNotification(
        `Your ${sub.frequency} subscription has been cancelled successfully.`,
        'Subscription Cancelled',
        'homeowner',
        homeowner_id
      );
    }

    res.json({ success: true, fee });
  } catch (err: any) {
    console.error("Error cancelling subscription:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/subscriptions/homeowner/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, properties(address)')
      .eq('homeowner_id', req.params.id)
      .eq('status', 'active');
    
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/sync-old-subscriptions", async (req, res) => {
  try {
    console.log("[Sync] Starting subscription backfill...");
    
    // 1. Get all active subscriptions
    const { data: subs, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'active');
      
    if (subError) throw subError;
    
    let syncedCount = 0;

    // 2. Loop through each subscription
    for (const sub of subs) {
      // Find the most recent job for this subscription to use as the template clone
      const { data: latestJob, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('subscription_id', sub.id)
        .order('scheduled_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestJob) {
         // Check if future jobs already exist so we don't accidentally double-book
         const now = new Date().toISOString();
         const { count } = await supabase
            .from('jobs')
            .select('*', { count: 'exact', head: true })
            .eq('subscription_id', sub.id)
            .gt('scheduled_date', now);

         if (count === 0) {
             console.log(`[Sync] Generating 4 future jobs for subscription ${sub.id}`);
             // Trigger our updated clone function
             await generateFutureJobs(latestJob, sub.frequency, 4);
             syncedCount++;
         } else {
             console.log(`[Sync] Subscription ${sub.id} already has ${count} future jobs. Skipping.`);
         }
      }
    }
    
    res.json({ 
      success: true, 
      message: `System synced successfully. Generated new schedules for ${syncedCount} old subscriptions.` 
    });
  } catch (err: any) {
    console.error("[Sync] Fatal Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/jobs/pending", async (req, res, next) => {
  try {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select(`
        *,
        properties (
          square_feet,
          bedrooms,
          bathrooms,
          address
        ),
        users!jobs_homeowner_id_fkey (
          contact_email,
          full_name,
          profile_picture,
          preferences
        )
      `)
      .eq('job_lifecycle_status', 'pending_claim');

    if (error) throw error;

    const processedJobs = jobs.map((job: any) => {
      // For pending jobs, always mask exact address and preferences
      return {
        ...job,
        square_feet: job.properties?.square_feet,
        bedrooms: job.properties?.bedrooms,
        bathrooms: job.properties?.bathrooms,
        address: job.properties?.address,
        homeowner_email: job.users?.contact_email,
        homeowner_name: job.users?.full_name,
        homeowner_picture: job.users?.profile_picture,
        homeowner_preferences: JSON.stringify({
          ...JSON.parse(job.users?.preferences || '{}'),
          entry_instructions: "Available 24h before cleaning",
          has_pets: "Hidden until claimed"
        })
      };
    });

    res.json(processedJobs);
  } catch (err) {
    next(err);
  }
});

app.get("/api/jobs/cleaner/:cleanerId", async (req, res) => {
  try {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select(`
        *,
        properties (
          square_feet,
          bedrooms,
          bathrooms,
          address,
          entry_instructions
        ),
        users!jobs_homeowner_id_fkey (
          contact_email,
          full_name,
          profile_picture,
          preferences
        ),
        jobassignments!inner(cleaner_id),
        job_media(*)
      `)
      .eq('jobassignments.cleaner_id', req.params.cleanerId)
      .neq('job_lifecycle_status', 'cancelled');

    if (error) throw error;

    if (!jobs) {
      return res.json([]);
    }

    const now = new Date();
    const thirtySixHours = 36 * 60 * 60 * 1000;

    const processedJobs = jobs.map((job: any) => {
      const dateStr = job.specific_date || job.scheduled_date;
      const scheduledDate = dateStr ? new Date(dateStr) : new Date();
      const timeDiff = scheduledDate.getTime() - now.getTime();
      const isWithin36h = timeDiff < thirtySixHours;

      let instructions: any = {};
      try {
        instructions = JSON.parse(job.special_instructions || '{}');
      } catch (e) {
        console.error(`[API] Error parsing special_instructions for job ${job.id}:`, e);
      }
      
      const baseJob = {
        ...job,
        square_feet: job.properties?.square_feet,
        bedrooms: job.properties?.bedrooms,
        bathrooms: job.properties?.bathrooms,
        entry_instructions: job.properties?.entry_instructions,
        homeowner_email: job.users?.contact_email,
        homeowner_name: job.users?.full_name,
        homeowner_picture: job.users?.profile_picture,
        job_media: job.job_media || [],
        time_frame: (instructions as any).time_frame,
      };

      if (!isWithin36h) {
        // Mask sensitive information
        return {
          ...baseJob,
          address: job.properties?.address,
          homeowner_preferences: JSON.stringify({
            ...JSON.parse(job.users?.preferences || '{}'),
            entry_instructions: "Available 36h before cleaning",
            has_pets: "Hidden until 36h before cleaning"
          })
        };
      }
      return {
        ...baseJob,
        address: job.properties?.address,
        homeowner_preferences: job.users?.preferences
      };
    });

    res.json(processedJobs);
  } catch (err: any) {
    console.error("[API] Error in /api/jobs/cleaner/:cleanerId", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/jobs/homeowner/:homeownerId", async (req, res) => {
  try {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select(`
        *,
        properties (
          square_feet,
          bedrooms,
          bathrooms,
          address
        ),
        Cleaner:cleaner_id (
          full_name,
          profile_picture,
          bio
        )
      `)
      .eq('homeowner_id', req.params.homeownerId);

    if (error) throw error;

    const processed = jobs.map((job: any) => ({
      ...job,
      square_feet: job.properties?.square_feet,
      bedrooms: job.properties?.bedrooms,
      bathrooms: job.properties?.bathrooms,
      address: job.properties?.address,
      cleaner_name: job.Cleaner?.full_name,
      cleaner_picture: job.Cleaner?.profile_picture,
      cleaner_bio: job.Cleaner?.bio
    }));

    res.json(processed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/jobs/homeowner/:homeownerId/last", async (req, res) => {
  try {
    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        *,
        properties (
          square_feet,
          bedrooms,
          bathrooms,
          address
        )
      `)
      .eq('homeowner_id', req.params.homeownerId)
      .neq('job_lifecycle_status', 'cancelled')
      .order('scheduled_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (job) {
      res.json({
        ...job,
        square_feet: job.properties?.square_feet,
        bedrooms: job.properties?.bedrooms,
        bathrooms: job.properties?.bathrooms,
        address: job.properties?.address
      });
    } else {
      res.json(null);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs/:id/claim", async (req, res) => {
  try {
    const { cleaner_id, specific_date } = req.body;
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('job_lifecycle_status, final_transaction_price')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!job || (job.job_lifecycle_status !== 'pending_claim' && job.job_lifecycle_status !== 'claimed')) {
      return res.status(400).json({ error: "Job already claimed or not found" });
    }

    // Check existing assignments
    const { data: assignments, error: assignError } = await supabase
      .from('jobassignments')
      .select('cleaner_id')
      .eq('job_id', req.params.id);
    
    if (assignError) throw assignError;

    // Check if cleaner already assigned
    if (assignments.some(a => a.cleaner_id === cleaner_id)) {
        return res.status(400).json({ error: "Cleaner already assigned" });
    }

    const capacity = job.final_transaction_price >= 350 ? 2 : 1;
    if (assignments.length >= capacity) {
        return res.status(400).json({ error: "Job capacity reached" });
    }

    // Assign cleaner
    const { error: assignInsertError } = await supabase
      .from('jobassignments')
      .insert({ job_id: req.params.id, cleaner_id });
    
    if (assignInsertError) throw assignInsertError;

    // Update job with cleaner_id
    const { error: updateCleanerError } = await supabase
      .from('jobs')
      .update({ cleaner_id: cleaner_id })
      .eq('id', req.params.id);
    if (updateCleanerError) throw updateCleanerError;

    // If capacity reached, update job status
    if (assignments.length + 1 >= capacity) {
        const { error: updateError } = await supabase
          .from('jobs')
          .update({ 
            specific_date: specific_date || null, 
            job_lifecycle_status: 'claimed_scheduled', 
            is_abandoned: 0 
          })
          .eq('id', req.params.id);
        if (updateError) throw updateError;
    } else {
        // Just update status to 'claimed' if not already
        if (job.job_lifecycle_status === 'pending_claim') {
            await supabase.from('jobs').update({ job_lifecycle_status: 'claimed' }).eq('id', req.params.id);
        }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs/:id/release", async (req, res) => {
  const { cleaner_id } = req.body;
  console.log(`[Release] Attempting to release job ${req.params.id} by cleaner ${cleaner_id}`);
  
  try {
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', req.params.id)
      .eq('cleaner_id', cleaner_id)
      .maybeSingle();
    
    if (fetchError || !job) {
      console.log(`[Release] Job not found or not assigned to cleaner: ${req.params.id}`);
      throw new Error("Job not found or not assigned to you");
    }

    // Reset job
    const { error: updateJobError } = await supabase
      .from('jobs')
      .update({ 
        cleaner_id: null, 
        specific_date: null, 
        job_lifecycle_status: 'pending_claim', 
        is_abandoned: 0 // Not an abandonment
      })
      .eq('id', req.params.id);

    if (updateJobError) throw updateJobError;

    // Create notifications
    await createNotification(`Job ${req.params.id} has been released back to the marketplace.`, 'Job Released', 'admin');
    await createNotification(`A job has become available again in the marketplace!`, 'New Job Available', 'cleaner');
    await createNotification(`Your assignment for job ${req.params.id} has been removed.`, 'Job Assignment Removed', undefined, cleaner_id);

    console.log(`[Release] Successfully released job ${req.params.id}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`[Release] Error: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/jobs/:id/abandon", async (req, res) => {
  const { cleaner_id } = req.body;
  console.log(`[Abandon] Attempting to abandon job ${req.params.id} by cleaner ${cleaner_id}`);
  
  try {
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', req.params.id)
      .eq('cleaner_id', cleaner_id)
      .maybeSingle();
    
    if (fetchError || !job) {
      console.log(`[Abandon] Job not found or not assigned: ${req.params.id}`);
      throw new Error("Job not found or not assigned to you");
    }

    if (job.job_lifecycle_status !== 'claimed_scheduled') {
      console.log(`[Abandon] Job status is ${job.job_lifecycle_status}, cannot abandon.`);
      throw new Error(`Cannot abandon job in status: ${job.job_lifecycle_status}`);
    }

    // Reset job
    const { error: updateJobError } = await supabase
      .from('jobs')
      .update({ 
        cleaner_id: null, 
        specific_date: null, 
        job_lifecycle_status: 'pending_claim', 
        is_abandoned: 1 
      })
      .eq('id', req.params.id);

    if (updateJobError) throw updateJobError;

    // Increment abandoned count
    const { error: updateUserError } = await supabase.rpc('increment_abandoned_count', { user_id: cleaner_id });
    // If RPC not available, we can do a manual update
    if (updateUserError) {
      const { data: user } = await supabase.from('users').select('abandoned_count').eq('id', cleaner_id).maybeSingle();
      await supabase.from('users').update({ abandoned_count: (user?.abandoned_count || 0) + 1 }).eq('id', cleaner_id);
    }

    // Create notifications
    await createNotification(`Cleaner has abandoned job ${req.params.id}. It is now back on the marketplace.`, 'Job Abandoned', 'admin');
    await createNotification(`A job has become available again in the marketplace!`, 'New Job Available', 'cleaner');
    await createNotification(`The cleaner who claimed your job on ${job.specific_date || job.scheduled_date} has had to cancel. Your job is back on the marketplace for other cleaners to claim.`, 'Job Cancelled', undefined, job.homeowner_id);

    console.log(`[Abandon] Successfully abandoned job ${req.params.id}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`[Abandon] Error: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

import { addonData } from './src/constants.js';

// ... (existing code)

app.post("/api/jobs/:id/update-payout", async (req, res) => {
  const { payout } = req.body;
  const { id } = req.params;
  try {
    const { error } = await supabase.from('jobs').update({ final_cleaner_payout: payout }).eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating payout:", err);
    res.status(500).json({ error: "Failed to update payout" });
  }
});

app.post("/api/jobs/:id/bonus", async (req, res) => {
  const { bonus } = req.body;
  const { id } = req.params;
  try {
    const { error } = await supabase.from('jobs').update({ custom_bonus: bonus }).eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("Error adding bonus:", err);
    res.status(500).json({ error: "Failed to add bonus" });
  }
});

app.post("/api/jobs/:id/complete", async (req, res) => {
  try {
    const { cleaner_id, addonTimes } = req.body;
    
    // Get all cleaners for the job
    const { data: assignments, error: assignError } = await supabase
      .from('jobassignments')
      .select('cleaner_id')
      .eq('job_id', req.params.id);
    
    if (assignError) throw assignError;
    if (!assignments || assignments.length === 0) {
        return res.status(400).json({ error: "No cleaners assigned to this job" });
    }

    console.log("[API] Completing job:", req.params.id);
    // Get job price
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError) {
      console.error("[API] Error fetching job:", fetchError);
      throw fetchError;
    }
    if (!job) {
      console.error("[API] Job not found:", req.params.id);
      throw new Error("Job not found");
    }

    let finalAddonPrice = 0;
    if (addonTimes) {
      let specialInstructions: any = {};
      try {
        specialInstructions = job.special_instructions ? JSON.parse(job.special_instructions) : {};
      } catch (e) {
        console.error("Error parsing special_instructions:", e);
      }
      const selectedAddons = specialInstructions.selected_addons || [];
      
      for (const addonId of selectedAddons) {
        const addon = addonData.find(a => a.id === addonId);
        if (addon && addonTimes[addonId]) {
          const minutes = addonTimes[addonId];
          const roundedUnits = Math.ceil(minutes / 30);
          finalAddonPrice += roundedUnits * (addon.pricePerHour / 2);
        }
      }
    }

    const finalTransactionPrice = (job.calculated_base_price || 0) + finalAddonPrice;

    // Update job status and prices
    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        job_lifecycle_status: 'pending_invoice',
        final_addon_price: finalAddonPrice,
        final_transaction_price: finalTransactionPrice
      })
      .eq('id', req.params.id);

    if (updateError) throw updateError;

    res.json({ success: true });
  } catch (err: any) {
    console.error("[API ERROR]", err);
    res.status(500).json({ error: err.message || "Failed to complete job" });
  }
});

app.post("/api/jobs/:id/invoice", async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Update job status to 'completed'
    const { error: updateError } = await supabase
      .from('jobs')
      .update({ job_lifecycle_status: 'completed', paid: 0 })
      .eq('id', id);
    
    if (updateError) throw updateError;
    
    res.json({ success: true });
  } catch (err: any) {
    console.error("[API] Error in /api/jobs/:id/invoice", err);
    res.status(500).json({ error: err.message || "Failed to send invoice" });
  }
});

app.post("/api/create-payment-intent", async (req, res) => {
  try {
    const { jobId } = req.body;
    const stripe = getStripe();
    
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured" });
    }

    if (!supabase) {
      return res.status(500).json({ error: "Database is not configured" });
    }

    // Get job details to calculate amount
    const { data: job, error } = await supabase
      .from('jobs')
      .select('final_transaction_price')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const baseQuote = job.final_transaction_price;
    const taxes = baseQuote * 0.14975;
    const subtotal = baseQuote + taxes;
    const finalCharge = (subtotal + 0.30) / (1 - 0.029);
    const processingFee = finalCharge - subtotal;
    const amountInCents = Math.round(finalCharge * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'cad',
      metadata: { jobId },
      payment_method_types: ['card'],
    });

    res.json({ 
      clientSecret: paymentIntent.client_secret,
      breakdown: {
        baseQuote,
        taxes,
        processingFee,
        totalCharge: finalCharge
      }
    });
  } catch (err: any) {
    console.error("Error creating payment intent:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/create-setup-intent", async (req, res) => {
  try {
    const targetUserId = req.body.userId || req.body.homeowner_id;
    const stripe = getStripe();
    if (!stripe) {
      console.error("Stripe not configured");
      return res.status(500).json({ error: "Stripe not configured" });
    }

    // Get or create Stripe customer
    const { data: user, error: userError } = await supabase.from('users').select('stripe_customer_id').eq('id', targetUserId).maybeSingle();
    if (userError) {
      console.error("Error fetching user:", userError);
      return res.status(500).json({ error: "Failed to fetch user: " + userError.message });
    }
    
    let customerId = user?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { userId: targetUserId } });
      customerId = customer.id;
      await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', targetUserId);
    }

    const setupIntent = await stripe.setupIntents.create({ 
      customer: customerId,
      payment_method_types: ['card']
    });
    res.json({ clientSecret: setupIntent.client_secret });
  } catch (err: any) {
    console.error("Error in create-setup-intent:", err.message || err);
    res.status(500).json({ error: "Failed to create setup intent: " + (err.message || err) });
  }
});

app.get("/api/payment-methods", async (req, res) => {
  try {
    const { homeowner_id } = req.query;
    const stripe = getStripe();
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });

    const { data: user } = await supabase.from('users').select('stripe_customer_id').eq('id', homeowner_id).single();
    if (!user?.stripe_customer_id) return res.json([]);

    try {
      console.log("Listing payment methods for customer:", user.stripe_customer_id);
      const paymentMethods = await stripe.customers.listPaymentMethods(user.stripe_customer_id, { type: 'card' });
      console.log("Payment methods found:", paymentMethods.data.length);
      res.json(paymentMethods.data);
    } catch (err: any) {
      if (err.type === 'StripeInvalidRequestError' && err.code === 'resource_missing') {
        console.warn("Stripe customer not found, returning empty list:", user.stripe_customer_id);
        res.json([]);
      } else {
        throw err;
      }
    }
  } catch (err: any) {
    console.error("Error listing payment methods:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/payment-methods/:id", async (req, res) => {
  try {
    const { homeowner_id } = req.body;
    const { id } = req.params;
    const stripe = getStripe();
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });

    const { data: user } = await supabase.from('users').select('stripe_customer_id').eq('id', homeowner_id).single();
    if (!user?.stripe_customer_id) return res.status(404).json({ error: "User not found" });

    await stripe.paymentMethods.detach(id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting payment method:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/jobs/:jobId/media/:mediaId", async (req, res) => {
  try {
    const { jobId, mediaId } = req.params;
    
    // 1. Fetch the media record to get the file URL/name
    const { data: media, error: fetchError } = await supabase
      .from('job_media')
      .select('url')
      .eq('id', mediaId)
      .eq('job_id', jobId)
      .single();
    
    if (fetchError) throw fetchError;
    if (!media) return res.status(404).json({ error: "Media not found" });

    // 2. Extract file name from URL (assuming URL structure: .../job-media/jobId/category/fileName)
    const urlParts = media.url.split('/');
    const fileName = `${jobId}/${urlParts[urlParts.length - 2]}/${urlParts[urlParts.length - 1]}`;

    // 3. Delete from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('job-media')
      .remove([fileName]);
    
    if (storageError) throw storageError;

    // 4. Delete from Supabase DB
    const { error: dbError } = await supabase
      .from('job_media')
      .delete()
      .eq('id', mediaId)
      .eq('job_id', jobId);
    
    if (dbError) throw dbError;
    
    res.status(204).send();
  } catch (err) {
    console.error("Error deleting media:", err);
    res.status(500).json({ error: "Failed to delete media" });
  }
});

app.post("/api/jobs/:id/pay", async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin" && userRole !== "homeowner") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!supabase) {
      return res.status(500).json({ error: "Database is not configured" });
    }

    const { paymentIntentId, amount } = req.body;

    // Update job status and get homeowner_id
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .update({ paid: 1 })
      .eq('id', req.params.id)
      .eq('job_lifecycle_status', 'completed')
      .select('homeowner_id')
      .single();

    if (jobError) throw jobError;

    // Log payment if info provided
    if (paymentIntentId && amount && job) {
      const { error: payError } = await supabase
        .from('payments')
        .insert({
          job_id: req.params.id,
          user_id: job.homeowner_id,
          stripe_payment_intent_id: paymentIntentId,
          amount: amount,
          status: 'succeeded'
        });
      
      if (payError) {
        console.error("Error logging payment to Supabase:", payError);
        // We don't fail the whole request if logging fails, but we log it
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Error in /api/jobs/:id/pay:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs/:id/mark-paid", async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { error } = await supabase
      .from('jobs')
      .update({ paid: 1 })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs/:id/pay-cleaner", async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { error } = await supabase
      .from('jobs')
      .update({ cleaner_paid: 1 })
      .eq('id', req.params.id)
      .eq('job_lifecycle_status', 'completed');

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/debug/job-statuses", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('job_lifecycle_status');
    if (error) throw error;
    const statuses = [...new Set(data.map(j => j.job_lifecycle_status))];
    res.json({ statuses });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/jobs/:id/approve-quote", async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { price } = req.body;
    if (!price) return res.status(400).json({ error: "Price is required" });

    const updateData = { job_lifecycle_status: 'pending_homeowner_approval', final_transaction_price: price };
    console.log("[Admin] Updating job", req.params.id, "with data:", updateData);

    const { error: updateError } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('job_lifecycle_status', 'pending_quote');

    if (updateError) throw updateError;

    const { data: job } = await supabase
      .from('jobs')
      .select('homeowner_id')
      .eq('id', req.params.id)
      .maybeSingle();

    if (job) {
      await createNotification("Your custom quote has been approved and is now available for cleaners to claim.", 'Quote Approved', undefined, job.homeowner_id);
    }
    await createNotification("A new custom job is available in the marketplace!", 'New Job Available', 'cleaner');
    res.json({ success: true });
  } catch (err: any) {
    console.error("[Admin] Error in approve-quote:", err);
    if (err.details) console.error("[Admin] Error details:", err.details);
    if (err.hint) console.error("[Admin] Error hint:", err.hint);
    if (err.message) console.error("[Admin] Error message:", err.message);
    res.status(500).json({ error: err.message || "An unknown error occurred" });
  }
});

app.post("/api/admin/jobs/:id/reject-quote", async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { error: updateError } = await supabase
      .from('jobs')
      .update({ job_lifecycle_status: 'cancelled' })
      .eq('id', req.params.id)
      .eq('job_lifecycle_status', 'pending_quote');

    if (updateError) throw updateError;

    const { data: job } = await supabase
      .from('jobs')
      .select('homeowner_id')
      .eq('id', req.params.id)
      .maybeSingle();

    if (job) {
      await createNotification("Your custom quote request has been declined. Please contact support for more information.", 'Quote Declined', undefined, job.homeowner_id);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/jobs/:id/charge-fee", async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError || !job) return res.status(404).json({ error: "Job not found" });

    const fee = job.final_transaction_price * 0.4;
    const stripe = getStripe();
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });

    const { data: payment } = await supabase
      .from('payments')
      .select('stripe_payment_intent_id')
      .eq('job_id', job.id)
      .single();

    if (!payment || !payment.stripe_payment_intent_id) return res.status(404).json({ error: "Payment not found" });

    const pi = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
    if (!pi.customer || !pi.payment_method) return res.status(400).json({ error: "No payment method found" });

    await stripe.paymentIntents.create({
      amount: Math.round(fee * 100),
      currency: 'cad',
      customer: pi.customer as string,
      payment_method: pi.payment_method as string,
      off_session: true,
      confirm: true,
      description: `Admin fee for Job ${job.id}: Inaccurate description/needs deep clean`
    });

    res.json({ success: true, message: "Fee charged successfully" });
  } catch (err) {
    console.error(`[AdminCharge] Error charging:`, err);
    res.status(500).json({ error: "Failed to charge fee" });
  }
});

app.post("/api/jobs/:id/cancel", async (req, res) => {
  try {
    const { homeowner_id } = req.body;
    console.log(`[Cancel] Request for Job ${req.params.id} by homeowner ${homeowner_id}`);
    
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    
    if (fetchError || !job) {
      console.log(`[Cancel] Job not found: ${req.params.id}`);
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.homeowner_id !== homeowner_id) {
      console.log(`[Cancel] Unauthorized: Job owner ${job.homeowner_id} !== requester ${homeowner_id}`);
      return res.status(403).json({ error: "Unauthorized: You do not own this booking" });
    }

    if (job.job_lifecycle_status === 'completed' || job.job_lifecycle_status === 'cancelled') {
      return res.status(400).json({ error: "Job cannot be cancelled in its current status" });
    }

    const targetDateStr = job.specific_date || job.scheduled_date;
    if (!targetDateStr || targetDateStr === 'Invalid Date') {
      console.log(`[Cancel] No valid target date found for job ${req.params.id}: ${targetDateStr}`);
      await supabase.from('jobs').update({ job_lifecycle_status: 'cancelled' }).eq('id', req.params.id);
      return res.json({ success: true, message: "Job cancelled (no valid date found)" });
    }

    // --- BULLETPROOF MONTREAL TIMEZONE MATH ---
    // 1. Strip extra data and default to 9:00 AM if no specific time was provided
    const cleanDateStr = targetDateStr.includes('T') ? targetDateStr.substring(0, 19) : `${targetDateStr}T09:00:00`;

    // 2. Grab the exact current time in Montreal right now
    const nowMontrealStr = new Date().toLocaleString('en-US', { timeZone: 'America/Toronto', hour12: false });
    const nowMontreal = new Date(nowMontrealStr);

    // 3. Parse the target cleaning date (Assuming the database string is Montreal time)
    const targetMontreal = new Date(cleanDateStr.replace('T', ' '));

    const thirtySixHours = 36 * 60 * 60 * 1000;
    
    // 4. Calculate the exact difference
    const timeDiff = targetMontreal.getTime() - nowMontreal.getTime();
    // ------------------------------------------
    
    console.log(`[Cancel] Target Date: ${targetMontreal.toISOString()}, Now: ${nowMontreal.toISOString()}, Diff: ${timeDiff}ms`);

    let penalty_status = 'none';

    if (timeDiff > 0 && timeDiff <= thirtySixHours && job.cleaner_id) {
        console.log(`[Cancel] Late cancellation: ${timeDiff}ms <= 36h and cleaner ${job.cleaner_id} assigned`);
        // Late cancellation
        const fee = job.final_transaction_price * 0.4;
        
        const stripe = getStripe();
        if (stripe) {
            try {
                const customerId = job.stripe_customer_id;
                let paymentMethodId = job.payment_method_id;
                
                if (!customerId) {
                    // Fallback to user table
                    const { data: user, error: userError } = await supabase
                        .from('users')
                        .select('stripe_customer_id')
                        .eq('id', job.homeowner_id)
                        .single();
                    
                    if (userError || !user?.stripe_customer_id) {
                        throw new Error("No Stripe customer found for user");
                    }
                    
                    // Try to get payment method from payments table if not in job
                    if (!paymentMethodId) {
                        const { data: payment } = await supabase
                            .from('payments')
                            .select('stripe_payment_intent_id')
                            .eq('job_id', job.id)
                            .maybeSingle();

                        if (payment && payment.stripe_payment_intent_id) {
                            const pi = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
                            paymentMethodId = pi.payment_method as string;
                        }
                    }

                    // If not in PI, get default from customer
                    if (!paymentMethodId) {
                        const customer = await stripe.customers.retrieve(user.stripe_customer_id) as any;
                        if (customer && !customer.deleted) {
                            paymentMethodId = (customer.invoice_settings?.default_payment_method as string) || (customer.default_source as string);
                        }
                    }
                }

                if (paymentMethodId) {
                    console.log(`[Cancel] Charging customer ${customerId} with PM ${paymentMethodId} for fee ${fee}`);
                    await stripe.paymentIntents.create({
                        amount: Math.round(fee * 100),
                        currency: 'cad',
                        customer: customerId,
                        payment_method: paymentMethodId,
                        off_session: true,
                        confirm: true,
                        description: `Late cancellation fee for Job ${job.id}`
                    });
                    console.log(`[Cancel] Charge successful`);
                    penalty_status = 'charged';
                } else {
                    console.log(`[Cancel] No payment method found`);
                    penalty_status = 'failed_no_payment_method';
                }
            } catch (err) {
                console.error("[Cancel] Stripe charge failed:", err);
                penalty_status = 'failed';
            }
        } else {
            penalty_status = 'failed_no_stripe';
        }
    }

    const { error: updateError } = await supabase
      .from('jobs')
      .update({ 
        job_lifecycle_status: 'cancelled',
        penalty_status: penalty_status
      })
      .eq('id', req.params.id);

    if (updateError) throw updateError;

    console.log(`[Cancel] Job marked as cancelled`);

    await createNotification(`Job ${req.params.id} has been cancelled by the homeowner.`, 'Booking Cancelled', 'admin');
    if (job.cleaner_id) {
      await createNotification(`Job ${req.params.id} that you claimed has been cancelled by the homeowner.`, 'Booking Cancelled', undefined, job.cleaner_id);
    }
    const response: any = { success: true, message: "Booking removed successfully" };
    if (penalty_status === 'failed' || penalty_status === 'failed_no_payment_method' || penalty_status === 'failed_no_stripe') {
        response.warning = "Booking cancelled, but the cancellation fee could not be processed. Please check your payment method.";
    }
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs/:id/rate", async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (rating < 1 || rating > 5) return res.status(400).json({ error: "Invalid rating" });
    
    const { error } = await supabase
      .from('jobs')
      .update({ 
        rating, 
        review_comment: comment || null 
      })
      .eq('id', req.params.id)
      .eq('job_lifecycle_status', 'completed');

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs/:id/postpone", async (req, res) => {
  try {
    const { new_date, subscription_id } = req.body;
    
    // 1. Get original job date
    const { data: job, error: jobFetchError } = await supabase
      .from('jobs')
      .select('scheduled_date')
      .eq('id', req.params.id)
      .single();
    
    if (jobFetchError || !job) throw jobFetchError || new Error("Job not found");

    const originalDate = new Date(job.scheduled_date);
    const newDate = new Date(new_date);
    const diffTime = newDate.getTime() - originalDate.getTime();

    // 2. Get all future jobs for the subscription
    const { data: futureJobs, error: futureJobsError } = await supabase
      .from('jobs')
      .select('id, scheduled_date')
      .eq('subscription_id', subscription_id)
      .gt('scheduled_date', job.scheduled_date);
    
    if (futureJobsError) throw futureJobsError;

    // 3. Update all future jobs
    for (const futureJob of futureJobs) {
      const futureDate = new Date(futureJob.scheduled_date);
      const newFutureDate = new Date(futureDate.getTime() + diffTime);
      await supabase
        .from('jobs')
        .update({ scheduled_date: newFutureDate.toISOString() })
        .eq('id', futureJob.id);
    }

    // 4. Update current job date
    const { error: jobError } = await supabase
      .from('jobs')
      .update({ scheduled_date: new_date })
      .eq('id', req.params.id);
    
    if (jobError) throw jobError;

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/cleaners/:id/rating", async (req, res) => {
  const stats = await getCleanerStats(req.params.id);
  res.json(stats);
});

app.get("/api/cleaners/:id/reviews", async (req, res) => {
  try {
    const { data: reviews, error } = await supabase
      .from('jobs')
      .select(`
        id,
        rating,
        review_comment,
        scheduled_date,
        users!jobs_homeowner_id_fkey (
          contact_email
        )
      `)
      .eq('cleaner_id', req.params.id)
      .not('rating', 'is', null)
      .order('scheduled_date', { ascending: false });

    if (error) throw error;

    const processed = reviews.map((r: any) => ({
      ...r,
      homeowner_email: r.users?.contact_email
    }));

    res.json(processed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/cleaners/leaderboard/all", async (req, res) => {
  try {
    const { data: cleaners, error } = await supabase
      .from('users')
      .select(`
        id,
        contact_email,
        full_name,
        profile_picture,
        jobs!jobs_cleaner_id_fkey (
          rating
        )
      `)
      .eq('role_designation', 'cleaner')
      .eq('is_approved', 1)
      .or('is_deleted.is.null,is_deleted.eq.0');

    if (error) throw error;

    const cleanersWithPoints = cleaners.map((cleaner: any) => {
      let totalPoints = 0;
      cleaner.jobs?.forEach((job: any) => {
        if (job.rating === 5) totalPoints += 5;
        else if (job.rating === 4) totalPoints += 3;
        else if (job.rating === 3) totalPoints += 1;
        else if (job.rating === 1) totalPoints -= 1;
      });
      return { ...cleaner, totalPoints };
    });

    const cleanersWithStats = await Promise.all(cleanersWithPoints.map(async cleaner => {
      const stats = await getCleanerStats(cleaner.id);
      return { ...cleaner, ...stats };
    }));

    const filteredCleaners = cleanersWithStats.filter(c => c.totalReviews > 0);

    filteredCleaners.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.totalReviews - a.totalReviews;
    });

    res.json(filteredCleaners);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Feedback API
app.post("/api/feedback", async (req, res) => {
  try {
    const { user_id, page_url, content } = req.body;
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();
    
    const { error } = await supabase
      .from('feedback')
      .insert({
        id,
        user_id: user_id || null,
        page_url,
        content,
        created_at
      });

    if (error) throw error;
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/feedback", async (req, res) => {
  try {
    const requesterRole = req.headers["x-user-role"];
    if (requesterRole !== 'admin') {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { data: feedback, error } = await supabase
      .from('feedback')
      .select(`
        *,
        users!feedback_user_id_fkey (
          contact_email,
          full_name,
          role_designation
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const processed = feedback.map((f: any) => ({
      ...f,
      user_email: f.users?.contact_email,
      user_name: f.users?.full_name,
      user_role: f.users?.role_designation
    }));
    
    res.json(processed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/feedback/:id/resolve", async (req, res) => {
  try {
    const requesterRole = req.headers["x-user-role"];
    if (requesterRole !== 'admin') {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { error } = await supabase
      .from('feedback')
      .update({ status: 'resolved' })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  const PORT = 3000;

  // User Management
  app.get("/api/users/:id", async (req, res) => {
    try {
      // Security check: Only the user themselves or an admin can access this data
      const requesterId = req.headers["x-user-id"];
      const requesterRole = req.headers["x-user-role"];
      
      if (requesterId !== req.params.id && requesterRole !== 'admin') {
        return res.status(403).json({ error: "Unauthorized access" });
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('id, role_designation, contact_email, loyalty_subscription_tier, full_name, phone_number, bio, address, profile_picture, preferences')
        .eq('id', req.params.id)
        .maybeSingle();

      if (error) throw error;

      if (user) {
        res.json(user);
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Internal server error", message: err.message });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      // Security check: Only the user themselves or an admin can update this data
      const requesterId = req.headers["x-user-id"];
      const requesterRole = req.headers["x-user-role"];
      
      if (requesterId !== req.params.id && requesterRole !== 'admin') {
        return res.status(403).json({ error: "Unauthorized access" });
      }

      const { full_name, phone_number, bio, address, profile_picture, cv, preferences } = req.body;
      
      // Check if notifications were just enabled
      const { data: oldUser } = await supabase.from('users').select('preferences').eq('id', req.params.id).maybeSingle();
      const oldPrefs = oldUser?.preferences ? JSON.parse(oldUser.preferences) : {};
      const newPrefs = preferences ? JSON.parse(preferences) : {};
      
      const { error } = await supabase
        .from('users')
        .update({ 
          full_name, 
          phone_number, 
          bio, 
          address, 
          profile_picture, 
          cv, 
          preferences 
        })
        .eq('id', req.params.id);
      
      if (error) throw error;

      // If notifications were toggled from false to true
      if (!oldPrefs.notifications && newPrefs.notifications) {
        await createNotification("You have successfully enabled notifications! You will now receive updates about your bookings.", 'Notifications Enabled', undefined, req.params.id);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "Internal server error", message: err.message });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      // Security check: Only the user themselves or an admin can delete this account
      const requesterId = req.headers["x-user-id"];
      const requesterRole = req.headers["x-user-role"];
      
      if (requesterId !== req.params.id && requesterRole !== 'admin') {
        return res.status(403).json({ error: "Unauthorized access" });
      }

      // Soft delete: Mark as deleted instead of removing from database
      const { error } = await supabase
        .from('users')
        .update({ is_deleted: 1 })
        .eq('id', req.params.id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete user error:", err);
      res.status(500).json({ error: "Internal server error", message: err.message });
    }
  });

  // 404 for API routes
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const status = err.status || err.statusCode || 500;
    console.error(`[Error ${status}] ${req.method} ${req.path}:`, err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err, null, 2) : String(err)));
    
    res.status(status).json({ 
      error: status === 500 ? "Internal server error" : (err.message || "An error occurred"), 
      message: err.message,
      status
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: "spa",
      plugins: [react(), tailwindcss()],
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
