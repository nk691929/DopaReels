import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { supabase } from '../../supabase.config';

type Theme = 'light' | 'dark' | 'system';

type ThemeColors = {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  notification: string;
  white: string;
};

const lightColors: ThemeColors = {
  background: '#FFFFFF',
  card: '#F5F5F5',
  text: '#333333',
  textSecondary: '#666666',
  border: '#DDDDDD',
  primary: '#007AFF',
  notification: '#FF3B30',
  white: '#FFFFFF',
};

const darkColors: ThemeColors = {
  background: '#121212',
  card: '#1E1E1E',
  text: '#E0E0E0',
  textSecondary: '#A0A0A0',
  border: '#2C2C2C',
  primary: '#0A84FF',
  notification: '#FF453A',
  white: '#FFFFFF',
};

type ThemeContextType = {
  theme: Theme;
  colors: ThemeColors;
  toggleTheme: (newTheme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  colors: lightColors,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemTheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>('system');
  const [colors, setColors] = useState<ThemeColors>(lightColors);

  useEffect(() => {
    const fetchUserTheme = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return;

        const { data: settings, error: settingsError } = await supabase
          .from('user_settings')
          .select('theme')
          .eq('user_id', user.id)
          .single();

        if (settingsError) return;
        if (settings?.theme) {
          setTheme(settings.theme);
        }
      } catch (error) {
        console.error('Error fetching user theme:', error);
      }
    };

    fetchUserTheme();
  }, []);

  useEffect(() => {
    const effectiveTheme = theme === 'system' ? systemTheme : theme;
    setColors(effectiveTheme === 'dark' ? darkColors : lightColors);
  }, [theme, systemTheme]);

  const toggleTheme = async (newTheme: Theme) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      const { error: updateError } = await supabase
        .from('user_settings')
        .update({ theme: newTheme })
        .eq('user_id', user.id);

      if (updateError) throw updateError;
      setTheme(newTheme);
    } catch (error) {
      console.error('Error updating theme:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext); 