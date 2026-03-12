import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import crypto from "crypto";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { createClient } from '@sanity/client';

dotenv.config();

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

// Sanity Client setup
const sanityProjectId = process.env.VITE_SANITY_PROJECT_ID;
const sanityToken = process.env.VITE_SANITY_WRITE_TOKEN;
const sanityDataset = process.env.VITE_SANITY_DATASET || 'production';

const sanityClient = sanityProjectId && sanityToken
  ? createClient({
      projectId: sanityProjectId,
      dataset: sanityDataset,
      useCdn: false,
      apiVersion: '2023-05-03',
      token: sanityToken,
    })
  : null;

// Removed initDb as we are now using Supabase and schema is managed externally.

const app = express();
app.use(express.json());

// Middleware to check if Supabase is configured
app.use((req, res, next) => {
  if (!supabase && req.path.startsWith('/api') && req.path !== '/api/health') {
    // For non-critical routes, return empty results instead of 500
    const emptyRoutes = ['/api/notifications', '/api/jobs/pending', '/api/jobs/cleaner', '/api/jobs/homeowner'];
    if (emptyRoutes.some(route => req.path.startsWith(route))) {
      return res.json([]);
    }
    
    return res.status(500).json({ 
      error: "Supabase not configured", 
      message: "Please add VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY to environment variables in Settings." 
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
async function createNotification(message: string, targetRole?: string, targetUserId?: string) {
  if (!supabase) {
    console.warn("[Notification] Supabase not configured, skipping notification creation.");
    return;
  }
  try {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    const { error: insertError } = await supabase
      .from('Notifications')
      .insert({
        id,
        target_user_id: targetUserId || null,
        target_role: targetRole || null,
        message,
        created_at: createdAt
      });

    if (insertError) throw insertError;
    
    console.log(`[Notification] Created: ${message} for ${targetRole || targetUserId || 'everyone'}`);

    // Send external notifications based on preferences
    let usersToNotify: any[] = [];
    if (targetUserId) {
      const { data: user, error: userError } = await supabase
        .from('Users')
        .select('contact_email, phone_number, preferences')
        .eq('id', targetUserId)
        .single();
      
      if (user && !userError) usersToNotify.push(user);
    } else if (targetRole) {
      const { data: users, error: usersError } = await supabase
        .from('Users')
        .select('contact_email, phone_number, preferences')
        .eq('role_designation', targetRole);
      
      if (users && !usersError) usersToNotify = users;
    }

    for (const user of usersToNotify) {
      const prefs = user.preferences ? JSON.parse(user.preferences) : {};
      
      // Only send external notifications if the main toggle is ON
      if (prefs.notifications) {
        if (prefs.email_notifications && user.contact_email) {
          await sendEmail(user.contact_email, "New Notification - CleanApp", message);
        }
        
        if (prefs.sms_notifications && user.phone_number) {
          await sendSMS(user.phone_number, message);
        }
      }
    }
  } catch (err) {
    console.error("[Notification] Error creating notification:", err);
  }
}

app.get("/api/notifications/:userId", async (req, res) => {
  try {
    const { data: user, error: userError } = await supabase
      .from('Users')
      .select('role_designation')
      .eq('id', req.params.userId)
      .maybeSingle();
    
    if (userError || !user) {
      // If user not found, return empty notifications instead of 404
      // This handles stale sessions gracefully
      return res.json([]);
    }

    const { data: notifications, error: notifyError } = await supabase
      .from('Notifications')
      .select('*')
      .or(`target_user_id.eq.${req.params.userId},target_role.eq.${user.role_designation},and(target_user_id.is.null,target_role.is.null)`)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (notifyError) throw notifyError;
    
    res.json(notifications);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/notifications/read-all/:userId", async (req, res) => {
  try {
    const { data: user, error: userError } = await supabase
      .from('Users')
      .select('role_designation')
      .eq('id', req.params.userId)
      .single();
    
    if (userError || !user) return res.status(404).json({ error: "User not found" });

    const { error: updateError } = await supabase
      .from('Notifications')
      .update({ is_read: 1 })
      .or(`target_user_id.eq.${req.params.userId},target_role.eq.${user.role_designation}`);
    
    if (updateError) throw updateError;
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/notifications/:id/read", async (req, res) => {
  try {
    const { error } = await supabase
      .from('Notifications')
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
      .from('Users')
      .select('id, full_name, contact_email, phone_number, is_approved, created_at, bio, profile_picture, cv, is_deleted')
      .eq('role_designation', 'cleaner')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const processed = applications.map(app => ({
      ...app,
      is_deleted: app.is_deleted || 0
    }));

    res.json(processed);
  } catch (err) {
    next(err);
  }
});

// Simple Auth
app.post("/api/auth/register", async (req, res) => {
  const { email, password, role, full_name, phone_number, address, bio, profile_picture, cv } = req.body;
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
      .from('Users')
      .select('id, is_approved, role_designation, is_deleted, password')
      .eq('contact_email', email)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existingUser) {
      if (existingUser.role_designation === 'cleaner' && (existingUser.is_approved === 0 || existingUser.is_approved === 2 || (existingUser.is_deleted ?? 0) === 1)) {
        // Allow re-application by updating the existing record and resetting is_deleted
        const passwordToSet = password === "RE-SUBMISSION" ? existingUser.password : password;
        
        const { error: updateError } = await supabase
          .from('Users')
          .update({
            password: passwordToSet,
            full_name,
            phone_number,
            address: address || null,
            bio: bio || null,
            profile_picture: profile_picture || null,
            cv: cv || null,
            is_approved: 0,
            is_deleted: 0,
            created_at: new Date().toISOString()
          })
          .eq('id', existingUser.id);

        if (updateError) throw updateError;
        
        createNotification(`New cleaner application (re-submission) received from ${full_name} (${email})`, 'admin');
        return res.json({ id: existingUser.id, role: 'cleaner', email, full_name, profile_picture, cv, loyalty_subscription_tier: 'none', is_approved: false });
      } else {
        return res.status(400).json({ error: "An account with this email already exists. Please try logging in instead." });
      }
    }

    const id = crypto.randomUUID();
    const is_approved = role === 'cleaner' ? 0 : 1;
    const created_at = new Date().toISOString();
    
    const { error: insertError } = await supabase
      .from('Users')
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
        created_at
      });

    if (insertError) throw insertError;
    
    if (role === 'cleaner') {
      createNotification(`New cleaner application received from ${full_name} (${email})`, 'admin');
    }
    
    res.json({ id, role, email, full_name, profile_picture, loyalty_subscription_tier: 'none', is_approved: !!is_approved });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    const { data: user, error } = await supabase
      .from('Users')
      .select('*')
      .or(`contact_email.eq.${email},phone_number.eq.${email}`)
      .eq('password', password)
      .eq('is_deleted', 0)
      .maybeSingle();

    if (error) throw error;

    if (user) {
      res.json({ id: user.id, role: user.role_designation, email: user.contact_email, full_name: user.full_name, loyalty_subscription_tier: user.loyalty_subscription_tier, is_approved: !!user.is_approved });
    } else {
      res.status(401).json({ error: "Invalid credentials or account deactivated" });
    }
  } catch (err) {
    next(err);
  }
});

async function getCleanerStats(cleanerId: string) {
  // Get recent 20 ratings for rolling average
  const { data: recentJobs, error: recentError } = await supabase
    .from('Jobs')
    .select('rating')
    .eq('cleaner_id', cleanerId)
    .not('rating', 'is', null)
    .order('scheduled_date', { ascending: false })
    .limit(20);

  if (recentError) throw recentError;

  const rollingRating = recentJobs.length > 0 
    ? recentJobs.reduce((acc, job) => acc + (job.rating || 0), 0) / recentJobs.length 
    : 0;

  // Get total completed jobs and total reviews
  const { data: statsJobs, error: statsError } = await supabase
    .from('Jobs')
    .select('id, rating')
    .eq('cleaner_id', cleanerId)
    .eq('job_lifecycle_status', 'completed');

  if (statsError) throw statsError;

  const totalJobs = statsJobs.length;
  const totalReviews = statsJobs.filter(j => j.rating !== null).length;

  // Get abandoned count
  const { data: user, error: userError } = await supabase
    .from('Users')
    .select('abandoned_count')
    .eq('id', cleanerId)
    .single();

  if (userError) throw userError;

  const abandonedCount = user?.abandoned_count || 0;

  let level = "Starter";
  let split = 40;

  if (totalJobs >= 101 && rollingRating >= 4.6) {
    level = "Elite";
    split = 65;
  } else if (totalJobs >= 61 && rollingRating >= 4.5) {
    level = "Expert";
    split = 55;
  } else if (totalJobs >= 31 && rollingRating >= 4.4) {
    level = "Advanced";
    split = 50;
  } else if (totalJobs >= 11 && rollingRating >= 4.2) {
    level = "Pro";
    split = 45;
  }

  return { averageRating: rollingRating, totalReviews, totalJobs, level, split, abandonedCount };
}

app.get("/api/customers/:id/notes", async (req, res, next) => {
  try {
    const { data: notes, error } = await supabase
      .from('CustomerNotes')
      .select(`
        *,
        Users!CustomerNotes_author_id_fkey (
          full_name
        )
      `)
      .eq('customer_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const processed = notes.map((note: any) => ({
      ...note,
      author_name: note.Users?.full_name
    }));

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
      .from('CustomerNotes')
      .insert({
        id,
        customer_id: req.params.id,
        author_id,
        content,
        created_at
      });

    if (error) throw error;
    
    res.json({ id, customer_id: req.params.id, author_id, content, created_at });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/customer-notes/:id", async (req, res, next) => {
  try {
    const { author_id, user_role } = req.body;
    
    let query = supabase.from('CustomerNotes').delete().eq('id', req.params.id);

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
      .from('Users')
      .select('id, contact_email, role_designation, full_name, phone_number, bio, address, cv, is_approved, is_deleted, created_at, profile_picture')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const processed = users.map(u => ({
      ...u,
      is_deleted: u.is_deleted || 0
    }));

    res.json(processed);
  } catch (err) {
    next(err);
  }
});

app.post("/api/admin/users/:id/approve", async (req, res, next) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { error } = await supabase
      .from('Users')
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
      .from('Users')
      .update({ is_deleted: 0 })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Admin endpoints
app.post("/api/admin/cleaners/:id/sync-sanity", async (req, res) => {
  const userRole = req.headers["x-user-role"];
  if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

  if (!sanityClient) {
    return res.status(500).json({ error: "Sanity client not configured on server. Check VITE_SANITY_PROJECT_ID and VITE_SANITY_WRITE_TOKEN." });
  }

  try {
    const cleanerId = req.params.id;
    const { data: cleaner, error } = await supabase
      .from('Users')
      .select('*')
      .eq('id', cleanerId)
      .eq('role_designation', 'cleaner')
      .single();

    if (error || !cleaner) {
      return res.status(404).json({ error: "Cleaner not found" });
    }

    // Use a deterministic ID based on email to avoid duplicates
    const sanityId = `cleaner-${cleaner.contact_email.replace(/[^a-zA-Z0-9]/g, '-')}`;

    const result = await sanityClient.createOrReplace({
      _id: sanityId,
      _type: 'cleaner',
      name: cleaner.full_name,
      email: cleaner.contact_email,
      phone: cleaner.phone_number || '',
      role: cleaner.role_designation || 'Cleaner',
      bio: cleaner.bio || '',
    });

    res.json({ success: true, result });
  } catch (err: any) {
    console.error("Sanity Sync Error:", err);
    res.status(500).json({ error: err.message || "Failed to sync to Sanity" });
  }
});

app.delete("/api/admin/cleaners/:email/sync-sanity", async (req, res) => {
  const userRole = req.headers["x-user-role"];
  if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

  if (!sanityClient) {
    return res.status(500).json({ error: "Sanity client not configured" });
  }

  try {
    const email = req.params.email;
    const query = `*[_type == "cleaner" && email == $email]`;
    const matches = await sanityClient.fetch(query, { email });

    if (matches && matches.length > 0) {
      for (const match of matches) {
        await sanityClient.delete(match._id);
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Sanity Delete Error:", err);
    res.status(500).json({ error: err.message || "Failed to delete from Sanity" });
  }
});

app.get("/api/admin/cleaners", async (req, res, next) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { data: cleaners, error } = await supabase
      .from('Users')
      .select('id, contact_email, is_approved, is_deleted, full_name, phone_number, bio, abandoned_count, created_at, profile_picture, cv')
      .eq('role_designation', 'cleaner');

    if (error) throw error;

    const cleanersWithStats = await Promise.all(cleaners.map(async cleaner => {
      const stats = await getCleanerStats(cleaner.id);
      return { ...cleaner, ...stats, is_deleted: cleaner.is_deleted || 0 };
    }));

    res.json(cleanersWithStats);
  } catch (err) {
    next(err);
  }
});

app.get("/api/admin/bad-ratings", async (req, res) => {
  const userRole = req.headers["x-user-role"];
  if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

  const { data: badRatings, error } = await supabase
    .from('Jobs')
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
    .from('Jobs')
    .select(`
      *, 
      Properties (
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
      )
    `)
    .order('scheduled_date', { ascending: true });

  if (error) throw error;

  const processed = jobs.map((job: any) => ({
    ...job,
    square_feet: job.Properties?.square_feet,
    bedrooms: job.Properties?.bedrooms,
    bathrooms: job.Properties?.bathrooms,
    address: job.Properties?.address,
    homeowner_email: job.Homeowner?.contact_email,
    homeowner_name: job.Homeowner?.full_name,
    homeowner_picture: job.Homeowner?.profile_picture,
    cleaner_email: job.Cleaner?.contact_email,
    cleaner_name: job.Cleaner?.full_name,
    cleaner_picture: job.Cleaner?.profile_picture
  }));

  res.json(processed);
});

app.get("/api/admin/properties", async (req, res) => {
  const userRole = req.headers["x-user-role"];
  if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

  const { data: properties, error } = await supabase
    .from('Properties')
    .select(`
      *,
      Users!Properties_owner_id_fkey (
        contact_email
      )
    `);

  if (error) throw error;

  const processed = properties.map((prop: any) => ({
    ...prop,
    owner_email: prop.Users?.contact_email
  }));

  res.json(processed);
});

app.post("/api/admin/cleaners/:id/approve", async (req, res) => {
  const userRole = req.headers["x-user-role"];
  if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

  const { error, count } = await supabase
    .from('Users')
    .update({ is_approved: 1 })
    .eq('id', req.params.id)
    .eq('role_designation', 'cleaner')
    .select();

  if (error) throw error;

  if (count && count > 0) {
    createNotification("Your cleaner application has been approved! You can now start claiming jobs.", undefined, req.params.id);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: "Could not approve cleaner" });
  }
});

app.post("/api/admin/cleaners/:id/reject", async (req, res) => {
  const userRole = req.headers["x-user-role"];
  if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

  const { error, count } = await supabase
    .from('Users')
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
    .from('Properties')
    .select('*')
    .eq('owner_id', req.params.userId);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(properties);
});

app.post("/api/properties", async (req, res) => {
  const { owner_id, address, square_feet, bedrooms, bathrooms, living_rooms, windows, offices } = req.body;
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  
  const { error } = await supabase
    .from('Properties')
    .insert({
      id,
      owner_id,
      address: address || null,
      square_feet,
      bedrooms,
      bathrooms,
      living_rooms,
      windows,
      offices: offices || 0,
      created_at
    });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ id, owner_id, address, square_feet, bedrooms, bathrooms, living_rooms, windows, offices, created_at });
});

// Jobs
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
    const status = special_instructions ? 'pending_quote' : 'pending_claim';
    const created_at = new Date().toISOString();
    
    const { error } = await supabase
      .from('Jobs')
      .insert({
        id,
        property_id: property_id || null,
        homeowner_id: homeowner_id || null,
        scheduled_date,
        scheduled_end_date: scheduled_end_date || null,
        calculated_base_price,
        final_transaction_price,
        job_lifecycle_status: status,
        special_instructions: special_instructions || null,
        window_cleaning: window_cleaning ? 1 : 0,
        oven_cleaning: oven_cleaning ? 1 : 0,
        deep_cleaning: deep_cleaning ? 1 : 0,
        frequency: frequency || 'none',
        created_at
      });

    if (error) throw error;
    res.json({ id });
  } catch (err: any) {
    console.error("Error creating job:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/jobs/pending", async (req, res, next) => {
  try {
    const { data: jobs, error } = await supabase
      .from('Jobs')
      .select(`
        *,
        Properties (
          square_feet,
          bedrooms,
          bathrooms,
          address
        ),
        Users!Jobs_homeowner_id_fkey (
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
        square_feet: job.Properties?.square_feet,
        bedrooms: job.Properties?.bedrooms,
        bathrooms: job.Properties?.bathrooms,
        address: "Available after claiming",
        homeowner_email: job.Users?.contact_email,
        homeowner_name: job.Users?.full_name,
        homeowner_picture: job.Users?.profile_picture,
        homeowner_preferences: JSON.stringify({
          ...JSON.parse(job.Users?.preferences || '{}'),
          entry_instructions: "Available 24h before cleaning",
          has_pets: "Available 24h before cleaning"
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
      .from('Jobs')
      .select(`
        *,
        Properties (
          square_feet,
          bedrooms,
          bathrooms,
          address
        ),
        Users!Jobs_homeowner_id_fkey (
          contact_email,
          full_name,
          profile_picture,
          preferences
        )
      `)
      .eq('cleaner_id', req.params.cleanerId)
      .neq('job_lifecycle_status', 'cancelled');

    if (error) throw error;

    const now = new Date();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    const processedJobs = jobs.map((job: any) => {
      const scheduledDate = new Date(job.specific_date || job.scheduled_date);
      const timeDiff = scheduledDate.getTime() - now.getTime();
      const isWithin24h = timeDiff < twentyFourHours;

      const baseJob = {
        ...job,
        square_feet: job.Properties?.square_feet,
        bedrooms: job.Properties?.bedrooms,
        bathrooms: job.Properties?.bathrooms,
        homeowner_email: job.Users?.contact_email,
        homeowner_name: job.Users?.full_name,
        homeowner_picture: job.Users?.profile_picture,
      };

      if (!isWithin24h) {
        // Mask sensitive information
        return {
          ...baseJob,
          address: "Available 24h before cleaning",
          homeowner_preferences: JSON.stringify({
            ...JSON.parse(job.Users?.preferences || '{}'),
            entry_instructions: "Available 24h before cleaning",
            has_pets: "Available 24h before cleaning"
          })
        };
      }
      return {
        ...baseJob,
        address: job.Properties?.address,
        homeowner_preferences: job.Users?.preferences
      };
    });

    res.json(processedJobs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/jobs/homeowner/:homeownerId", async (req, res) => {
  try {
    const { data: jobs, error } = await supabase
      .from('Jobs')
      .select(`
        *,
        Properties (
          square_feet,
          bedrooms,
          bathrooms,
          address
        ),
        Cleaner:cleaner_id (
          full_name,
          profile_picture
        )
      `)
      .eq('homeowner_id', req.params.homeownerId);

    if (error) throw error;

    const processed = jobs.map((job: any) => ({
      ...job,
      square_feet: job.Properties?.square_feet,
      bedrooms: job.Properties?.bedrooms,
      bathrooms: job.Properties?.bathrooms,
      address: job.Properties?.address,
      cleaner_name: job.Cleaner?.full_name,
      cleaner_picture: job.Cleaner?.profile_picture
    }));

    res.json(processed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/jobs/homeowner/:homeownerId/last", async (req, res) => {
  try {
    const { data: job, error } = await supabase
      .from('Jobs')
      .select(`
        *,
        Properties (
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
        square_feet: job.Properties?.square_feet,
        bedrooms: job.Properties?.bedrooms,
        bathrooms: job.Properties?.bathrooms,
        address: job.Properties?.address
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
      .from('Jobs')
      .select('job_lifecycle_status')
      .eq('id', req.params.id)
      .single();

    if (fetchError) throw fetchError;
    if (job.job_lifecycle_status !== 'pending_claim') {
      return res.status(400).json({ error: "Job already claimed or not found" });
    }

    const { error: updateError } = await supabase
      .from('Jobs')
      .update({ 
        cleaner_id, 
        specific_date: specific_date || null, 
        job_lifecycle_status: 'claimed_scheduled', 
        is_abandoned: 0 
      })
      .eq('id', req.params.id);

    if (updateError) throw updateError;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs/:id/abandon", async (req, res) => {
  const { cleaner_id } = req.body;
  console.log(`[Abandon] Attempting to abandon job ${req.params.id} by cleaner ${cleaner_id}`);
  
  try {
    const { data: job, error: fetchError } = await supabase
      .from('Jobs')
      .select('*')
      .eq('id', req.params.id)
      .eq('cleaner_id', cleaner_id)
      .single();
    
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
      .from('Jobs')
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
      const { data: user } = await supabase.from('Users').select('abandoned_count').eq('id', cleaner_id).single();
      await supabase.from('Users').update({ abandoned_count: (user?.abandoned_count || 0) + 1 }).eq('id', cleaner_id);
    }

    // Create notifications
    await createNotification(`Cleaner has abandoned job ${req.params.id}. It is now back on the marketplace.`, 'admin');
    await createNotification(`A job has become available again in the marketplace!`, 'cleaner');
    await createNotification(`The cleaner who claimed your job on ${job.specific_date || job.scheduled_date} has had to cancel. Your job is back on the marketplace for other cleaners to claim.`, undefined, job.homeowner_id);

    console.log(`[Abandon] Successfully abandoned job ${req.params.id}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`[Abandon] Error: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/jobs/:id/complete", async (req, res) => {
  try {
    const { cleaner_id } = req.body;
    
    // Get current cleaner stats to determine split
    const stats = await getCleanerStats(cleaner_id);
    const splitPercentage = stats.split / 100;

    // Get job price
    const { data: job, error: fetchError } = await supabase
      .from('Jobs')
      .select('final_transaction_price')
      .eq('id', req.params.id)
      .eq('cleaner_id', cleaner_id)
      .single();
    
    if (fetchError || !job) {
      return res.status(400).json({ error: "Job not found" });
    }

    const payout = job.final_transaction_price * splitPercentage;

    const { error: updateError } = await supabase
      .from('Jobs')
      .update({ 
        job_lifecycle_status: 'completed', 
        cleaner_payout: payout 
      })
      .eq('id', req.params.id)
      .eq('cleaner_id', cleaner_id)
      .eq('job_lifecycle_status', 'claimed_scheduled');

    if (updateError) throw updateError;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs/:id/pay", async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin" && userRole !== "homeowner") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { error } = await supabase
      .from('Jobs')
      .update({ paid: 1 })
      .eq('id', req.params.id)
      .eq('job_lifecycle_status', 'completed');

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
      .from('Jobs')
      .update({ cleaner_paid: 1 })
      .eq('id', req.params.id)
      .eq('job_lifecycle_status', 'completed');

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/jobs/:id/approve-quote", async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { error: updateError } = await supabase
      .from('Jobs')
      .update({ job_lifecycle_status: 'pending_claim' })
      .eq('id', req.params.id)
      .eq('job_lifecycle_status', 'pending_quote');

    if (updateError) throw updateError;

    const { data: job } = await supabase
      .from('Jobs')
      .select('homeowner_id')
      .eq('id', req.params.id)
      .single();

    if (job) {
      await createNotification("Your custom quote has been approved and is now available for cleaners to claim.", undefined, job.homeowner_id);
    }
    await createNotification("A new custom job is available in the marketplace!", 'cleaner');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/jobs/:id/reject-quote", async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const { error: updateError } = await supabase
      .from('Jobs')
      .update({ job_lifecycle_status: 'cancelled' })
      .eq('id', req.params.id)
      .eq('job_lifecycle_status', 'pending_quote');

    if (updateError) throw updateError;

    const { data: job } = await supabase
      .from('Jobs')
      .select('homeowner_id')
      .eq('id', req.params.id)
      .single();

    if (job) {
      await createNotification("Your custom quote request has been declined. Please contact support for more information.", undefined, job.homeowner_id);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs/:id/cancel", async (req, res) => {
  try {
    const { homeowner_id } = req.body;
    console.log(`[Cancel] Request for Job ${req.params.id} by homeowner ${homeowner_id}`);
    
    const { data: job, error: fetchError } = await supabase
      .from('Jobs')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
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
      await supabase.from('Jobs').update({ job_lifecycle_status: 'cancelled' }).eq('id', req.params.id);
      return res.json({ success: true, message: "Job cancelled (no valid date found)" });
    }

    const parts = targetDateStr.split('-');
    if (parts.length !== 3) {
      console.log(`[Cancel] Non-standard date format: ${targetDateStr}, allowing cancellation`);
      await supabase.from('Jobs').update({ job_lifecycle_status: 'cancelled' }).eq('id', req.params.id);
      return res.json({ success: true });
    }

    const [y, m, d] = parts.map(Number);
    const targetDate = new Date(y, m - 1, d);
    const now = new Date();
    
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const timeDiff = targetDate.getTime() - now.getTime();
    
    console.log(`[Cancel] Target Date: ${targetDateStr}, Now: ${now.toISOString()}, Diff: ${timeDiff}ms`);

    if (timeDiff < twentyFourHours && job.cleaner_id) {
      console.log(`[Cancel] Cancellation blocked: within 24h and claimed`);
      return res.status(400).json({ error: "Cancellations for claimed jobs must be made at least 24 hours in advance" });
    }

    const { error: updateError } = await supabase
      .from('Jobs')
      .update({ job_lifecycle_status: 'cancelled' })
      .eq('id', req.params.id);

    if (updateError) throw updateError;

    console.log(`[Cancel] Job marked as cancelled`);

    await createNotification(`Job ${req.params.id} has been cancelled by the homeowner.`, 'admin');
    if (job.cleaner_id) {
      await createNotification(`Job ${req.params.id} that you claimed has been cancelled by the homeowner.`, undefined, job.cleaner_id);
    }
    res.json({ success: true, message: "Booking removed successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs/:id/rate", async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (rating < 1 || rating > 5) return res.status(400).json({ error: "Invalid rating" });
    
    const { error } = await supabase
      .from('Jobs')
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

app.get("/api/cleaners/:id/rating", async (req, res) => {
  const stats = await getCleanerStats(req.params.id);
  res.json(stats);
});

app.get("/api/cleaners/:id/reviews", async (req, res) => {
  try {
    const { data: reviews, error } = await supabase
      .from('Jobs')
      .select(`
        id,
        rating,
        review_comment,
        scheduled_date,
        Users!Jobs_homeowner_id_fkey (
          contact_email
        )
      `)
      .eq('cleaner_id', req.params.id)
      .not('rating', 'is', null)
      .order('scheduled_date', { ascending: false });

    if (error) throw error;

    const processed = reviews.map((r: any) => ({
      ...r,
      homeowner_email: r.Users?.contact_email
    }));

    res.json(processed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/cleaners/leaderboard/all", async (req, res) => {
  try {
    const { data: cleaners, error } = await supabase
      .from('Users')
      .select(`
        id,
        contact_email,
        full_name,
        profile_picture,
        Jobs!Jobs_cleaner_id_fkey (
          rating
        )
      `)
      .eq('role_designation', 'cleaner')
      .eq('is_approved', 1)
      .or('is_deleted.is.null,is_deleted.eq.0');

    if (error) throw error;

    const cleanersWithPoints = cleaners.map((cleaner: any) => {
      let totalPoints = 0;
      cleaner.Jobs?.forEach((job: any) => {
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
      .from('Feedback')
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
      .from('Feedback')
      .select(`
        *,
        Users!Feedback_user_id_fkey (
          contact_email,
          full_name,
          role_designation
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const processed = feedback.map((f: any) => ({
      ...f,
      user_email: f.Users?.contact_email,
      user_name: f.Users?.full_name,
      user_role: f.Users?.role_designation
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
      .from('Feedback')
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
        .from('Users')
        .select('id, role_designation, contact_email, loyalty_subscription_tier, full_name, phone_number, bio, address, profile_picture, preferences')
        .eq('id', req.params.id)
        .single();

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
      const { data: oldUser } = await supabase.from('Users').select('preferences').eq('id', req.params.id).single();
      const oldPrefs = oldUser?.preferences ? JSON.parse(oldUser.preferences) : {};
      const newPrefs = preferences ? JSON.parse(preferences) : {};
      
      const { error } = await supabase
        .from('Users')
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
        await createNotification("You have successfully enabled notifications! You will now receive updates about your bookings.", undefined, req.params.id);
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
        .from('Users')
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
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error", message: err.message });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: "spa",
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
