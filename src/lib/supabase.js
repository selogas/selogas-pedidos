import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pasllyqgczegpvquaxvb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhc2xseXFnY3plZ3B2cXVheHZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MzE3MzIsImV4cCI6MjA5MzAwNzczMn0.XEz01HOL7g0ziWtMullK1TU7tdFGWFiNDZA8H041p_w'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
