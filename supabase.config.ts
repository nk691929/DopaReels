// filepath: c:\Users\nk691\OneDrive\Desktop\React Project\Registeration-project\supabase.config.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://xwctdqytbdunhmyqsmrq.supabase.co'; // Replace with your Supabase API URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3Y3RkcXl0YmR1bmhteXFzbXJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NTI5NzUsImV4cCI6MjA2MDUyODk3NX0.1iT6jPtpaJbIMRlDh1BqgO0Hmn1yGyKD80UZ4iJaO94'; // Replace with your Supabase Anon Key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  storage: {
    bucket: 'videos',
    public: true
  },
  global: {
    headers: {
      'x-client-info': 'supabase-js-react-native'
    }
  }
});