-- EPCID Database Initialization Script
-- Creates extensions and initial setup for PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create demo user (password: 'secret')
-- BCrypt hash for 'secret'
INSERT INTO users (id, email, hashed_password, full_name, is_active, is_verified, created_at, updated_at)
VALUES (
    'user-demo-001',
    'demo@epcid.health',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    'Demo User',
    true,
    true,
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Create demo child
INSERT INTO children (id, user_id, name, date_of_birth, gender, medical_conditions, allergies, medications, created_at, updated_at)
VALUES (
    'child-demo-001',
    'user-demo-001',
    'Emma (Demo)',
    NOW() - INTERVAL '3 years',
    'female',
    '["asthma"]',
    '["peanuts"]',
    '["albuterol inhaler"]',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Grant privileges (adjust as needed for your security requirements)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO epcid;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO epcid;
