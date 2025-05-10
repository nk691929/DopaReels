import { supabase } from '../../supabase.config';

/**
 * Initialize user data in the database
 * 
 * This function:
 * 1. Gets the current user from Supabase Auth
 * 2. Checks if the user exists in the users table
 * 3. Creates a user record if it doesn't exist
 * 
 * It includes error handling for AuthSessionMissingError and other potential issues.
 */
export const initializeUser = async () => {
  try {
    // Add a small delay to allow auth to initialize
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    // Handle specific auth errors
    if (userError) {
      if (userError.message.includes('Auth session missing')) {
        console.log('No auth session available, skipping user initialization');
        return;
      }
      console.error('Error getting user:', userError);
      return;
    }
    
    // If no user, exit early
    if (!user) {
      console.log('No authenticated user found');
      return;
    }

    console.log('Initializing user data for:', user.id);

    // Check if user exists in users table
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking user:', fetchError);
      return;
    }

    // Create user record if it doesn't exist
    if (!existingUser) {
      console.log('Creating user record...');
      const { error: insertError } = await supabase
        .from('users')
        .insert([
          {
            id: user.id,
            email: user.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]);

      if (insertError) {
        console.error('Error creating user:', insertError);
        return;
      }
      console.log('User record created successfully');
    } else {
      console.log('User record already exists');
    }
  } catch (error) {
    // Handle any unexpected errors
    console.error('Error in initializeUser:', error);
  }
}; 